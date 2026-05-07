const axios = require('axios');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.MODEL_AI;

exports.getRideSafetyTips = async (req, res) => {
    try {
        const { city, temp, humidity, windSpeed, rideStatus, condition } = req.query;
        const contextParts = [];
        if (city) contextParts.push(`City: ${city}`);
        if (temp !== undefined) contextParts.push(`Temperature: ${temp}°C`);
        if (humidity !== undefined) contextParts.push(`Humidity: ${humidity}%`);
        if (windSpeed !== undefined) contextParts.push(`Wind Speed: ${windSpeed} km/h`);
        if (rideStatus) contextParts.push(`Ride Status: ${rideStatus}`);
        if (condition) contextParts.push(`Weather Condition: ${condition}`);

        if (contextParts.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one parameter is required: city, temp, humidity, windSpeed, rideStatus, or condition.",
            });
        }

        const contextString = contextParts.join("\n");

        // 1. Define Schema for detailed safety tips
        const responseSchema = {
            type: "OBJECT",
            properties: {
                riskLevel: { type: "STRING", enum: ["low", "moderate", "high"] },
                riskWarning: { type: "STRING", nullable: true },
                tips: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            category: { type: "STRING" },
                            tip: { type: "STRING" }
                        },
                        required: ["category", "tip"]
                    }
                },
                summary: { type: "STRING" }
            },
            required: ["riskLevel", "tips", "summary"]
        };

        const prompt = `
            You are an expert motorbike safety advisor. Based on the following weather and ride conditions, generate clear, practical, and prioritized safety tips.
            
            Current Conditions:
            ${contextString}

            Instructions:
            - Provide 5 to 8 safety tips tailored to these conditions.
            - Each tip MUST be exactly one concise sentence.
            - Group under: Gear, Road Handling, Speed & Braking, Visibility, or Awareness.
            - If dangerous, provide a riskWarning.
        `.trim();

        const fetchWithRetry = async (retries = 5, delay = 1000) => {
            try {
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048, // Increased tokens to avoid truncation
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

        const data = await fetchWithRetry();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error("Empty response from Gemini.");
        }

        let parsedTips;
        try {
            const jsonStart = responseText.indexOf('{');
            const jsonEnd = responseText.lastIndexOf('}') + 1;
            const jsonString = responseText.substring(jsonStart, jsonEnd);
            parsedTips = JSON.parse(jsonString);
        } catch (parseError) {
            return res.status(502).json({
                success: false,
                message: "Failed to parse JSON response.",
                raw: responseText,
            });
        }

        return res.status(200).json({
            success: true,
            conditions: {
                city: city || null,
                temp: temp !== undefined ? Number(temp) : null,
                humidity: humidity !== undefined ? Number(humidity) : null,
                windSpeed: windSpeed !== undefined ? Number(windSpeed) : null,
                rideStatus: rideStatus || null,
                condition: condition || null,
            },
            ...parsedTips,
        });

    } catch (error) {
        const geminiError = error.response?.data?.error?.message || error.message;
        console.error("Gemini API error:", geminiError);
        return res.status(error.response?.status || 500).json({
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