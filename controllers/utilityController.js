const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_AI = process.env.MODEL_AI;

async function queryOpenAI(userPrompt, options = {}) {
    return new Promise((resolve, reject) => {
        if (!OPENAI_API_KEY) {
            reject(new Error('OpenAI API key not configured'));
            return;
        }

        const {
            systemPrompt = '',
            model = MODEL_AI,
            maxTokens = 1000,
            temperature = 0.7,
            additionalContext = '',
            tools = [],
            tool_choice = tools.length > 0 ? 'auto' : undefined
        } = options;

        const messages = [];
        if (systemPrompt)      messages.push({ role: 'system', content: systemPrompt });
        if (additionalContext) messages.push({ role: 'user',   content: additionalContext });
        messages.push({ role: 'user', content: userPrompt });

        const requestBody = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            top_p: 0.8,
            ...(tools.length > 0 && { tools, tool_choice })
        };

        const requestData    = JSON.stringify(requestBody);
        const requestOptions = {
            hostname: 'models.github.ai',
            port: 443,
            path: '/inference/chat/completions',
            method: 'POST',
            headers: {
                'Authorization':  `Bearer ${OPENAI_API_KEY}`,
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const req = https.request(requestOptions, (res) => {
            let responseData = '';
            res.on('data',  (chunk) => { responseData += chunk; });
            res.on('end',   () => {
                try {
                    const json = JSON.parse(responseData);
                    if (json.error) { reject(new Error(`API Error: ${json.error.message}`)); return; }
                    if (!json.choices?.length) { reject(new Error('No response choices received')); return; }
                    resolve(json);
                } catch (e) {
                    reject(new Error(`Failed to parse JSON response: ${e.message}`));
                }
            });
        });

        req.on('error',   (e) => { reject(new Error(`Request failed: ${e.message}`)); });
        req.on('timeout', ()  => { req.destroy(); reject(new Error('Request timeout')); });
        req.setTimeout(90000);
        req.write(requestData);
        req.end();
    });
}

exports.getRideSafetyTips = async (req, res) => {
    try {
        const { city, temp, humidity, windSpeed, rideStatus, condition } = req.query;

        const contextParts = [];
        if (city)                  contextParts.push(`City: ${city}`);
        if (temp !== undefined)    contextParts.push(`Temperature: ${temp}°C`);
        if (humidity !== undefined) contextParts.push(`Humidity: ${humidity}%`);
        if (windSpeed !== undefined) contextParts.push(`Wind Speed: ${windSpeed} km/h`);
        if (rideStatus)            contextParts.push(`Ride Status: ${rideStatus}`);
        if (condition)             contextParts.push(`Weather Condition: ${condition}`);

        if (contextParts.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one parameter is required: city, temp, humidity, windSpeed, rideStatus, or condition.",
            });
        }

        const contextString = contextParts.join("\n");

        const systemPrompt = `
            You are an expert motorbike safety advisor.
            You MUST respond with ONLY a valid JSON object — no markdown, no explanation, no backticks.
            The JSON must follow this exact structure:
            {
                "riskLevel": "low" | "moderate" | "high",
                "riskWarning": "string or null",
                "tips": [
                    { "category": "string", "tip": "string" }
                ],
                "summary": "string"
            }
            Rules:
            - riskLevel must be exactly one of: low, moderate, high
            - tips must have 5 to 8 items
            - Each tip must be one concise sentence
            - Categories must be one of: Gear, Road Handling, Speed & Braking, Visibility, Awareness
            - riskWarning is required only when riskLevel is high, otherwise null
        `.trim();

        const userPrompt = `
            Based on these current conditions, generate motorbike safety tips:
            ${contextString}
        `.trim();

        const response = await queryOpenAI(userPrompt, {
            systemPrompt,
            maxTokens: 1000,
            temperature: 0.7,
        });

        const rawText = response.choices[0]?.message?.content ?? '';

        let parsedTips;
        try {
            // Strip any accidental markdown fences
            const jsonStart = rawText.indexOf('{');
            const jsonEnd   = rawText.lastIndexOf('}') + 1;
            parsedTips = JSON.parse(rawText.substring(jsonStart, jsonEnd));
        } catch {
            return res.status(502).json({
                success: false,
                message: "Failed to parse safety tips response.",
                raw: rawText,
            });
        }

        return res.status(200).json({
            success: true,
            conditions: {
                city:      city      || null,
                temp:      temp      !== undefined ? Number(temp)      : null,
                humidity:  humidity  !== undefined ? Number(humidity)  : null,
                windSpeed: windSpeed !== undefined ? Number(windSpeed) : null,
                rideStatus: rideStatus || null,
                condition:  condition  || null,
            },
            ...parsedTips,
        });

    } catch (error) {
        console.error("[RideSafetyTips Error]", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal error while generating safety advice.",
        });
    }
};

exports.getQuickRideTips = async (req, res) => {
    // 1. Define the Structured Schema for the model
    const responseSchema = {
        type: "OBJECT",
        properties: {
            tips: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        icon: {
                            type: "STRING",
                            description: "A Lucide icon name representing the priority: 'Info' for normal, 'TriangleAlert' for caution, 'Zap' for urgent."
                        },
                        tip: { type: "STRING" }
                    },
                    required: ["icon", "tip"]
                }
            }
        },
        required: ["tips"]
    };

    const prompt = `
        You are a real-time motorbike riding coach. A rider is CURRENTLY ON THE ROAD and needs instant, short, actionable tips.
        Generate exactly 5 tips. Each tip must be 1 short sentence.
        Cover posture, speed, awareness, braking, and situational alertness.
        Assign an icon to each tip: 'Info' (normal), 'TriangleAlert' (caution), or 'Zap' (urgent/immediate action).
    `.trim();

    // 2. Exponential Backoff Implementation
    const fetchWithRetry = async (retries = 5, delay = 1000) => {
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 1024,
                        responseMimeType: "application/json",
                        responseSchema: responseSchema
                    },
                },
                { headers: { "Content-Type": "application/json" } }
            );
            return response.data;
        } catch (error) {
            if (retries > 0 && (error.response?.status === 429 || error.response?.status >= 500)) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithRetry(retries - 1, delay * 2);
            }
            throw error;
        }
    };

    try {
        const data = await fetchWithRetry();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error("Empty response from model.");
        }

        // 3. Robust Parsing
        let parsedTips;
        try {
            // Isolation logic handles cases where model might still include markdown fences
            const jsonStart = responseText.indexOf('{');
            const jsonEnd = responseText.lastIndexOf('}') + 1;
            const jsonString = responseText.substring(jsonStart, jsonEnd);
            parsedTips = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Parse Error:", parseError, "Raw:", responseText);
            return res.status(502).json({
                success: false,
                message: "Failed to parse model output.",
                raw: responseText
            });
        }

        return res.status(200).json({
            success: true,
            ...parsedTips
        });

    } catch (error) {
        const geminiError = error.response?.data?.error?.message || error.message;
        console.error("Gemini API error:", geminiError);

        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Error generating tips. Please try again."
        });
    }
};

exports.getTips = async (req, res) => {
    try {
        const sourceUrl = process.env.SUPPORTING_APU_URL + 'tips';
        const response = await axios.get(sourceUrl);
        const inputData = response.data;

        if (!inputData?.data || !Array.isArray(inputData.data)) {
            return res.status(400).json({ error: "Invalid data format" });
        }

        // Extract all tips into a single flat array
        const allTips = inputData.data.flatMap(category =>
            category.tips || []
        );

        // Optional: Remove duplicates (if any)
        const uniqueTips = [...new Set(allTips)];

        res.json({
            success: true,
            count: uniqueTips.length,
            tips: uniqueTips
        });
    } catch (error) {
        console.error('Error fetching tips:', error.message);

        res.status(500).json({
            success: false,
            error: 'Failed to fetch or process tips',
            message: error.message
        });
    }
}