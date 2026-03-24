const https = require('https');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const MODEL_AI = process.env.MODEL_AI
/**
 * Send a query to OpenRouter and get response
 * @param {string} userPrompt - The main prompt/data from your Express server
 * @param {Object} options - Additional options for the query
 * @returns {Promise<Object>} - OpenRouter response object
 */
async function queryOpenRouter(userPrompt, options = {}) {
    return new Promise((resolve, reject) => {
        // Validate API key
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your-openrouter-api-key-here') {
            reject(new Error('OpenRouter API key not configured'));
            return;
        }

        // Set default options
        const {
            systemPrompt = '',
            model = MODEL_AI, // Default model, can be changed to others like 'google/gemini-pro'
            maxTokens = 1000,
            temperature = 0.7,
            additionalContext = '',
            tool_choice = 'auto', // default tool choice
            tools = [] // default tools array
        } = options;

        // Construct messages array for OpenRouter API
        const messages = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        if (additionalContext) {
            messages.push({ role: 'user', content: additionalContext });
        }

        messages.push({ role: 'user', content: userPrompt });

        const requestBody = {
            model: model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: 0.8, // Common parameter, can be adjusted
            top_k: 40,  // Common parameter, can be adjusted
            tool_choice: tool_choice,
            tools: tools
        };

        const requestData = JSON.stringify(requestBody);

        const requestOptions = {
            hostname: 'openrouter.ai',
            port: 443,
            path: '/api/v1/chat/completions', // Endpoint for chat completions
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const req = https.request(requestOptions, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(responseData);

                    // Check for API errors from OpenRouter
                    if (jsonResponse.error) {
                        reject(new Error(`OpenRouter API Error: ${jsonResponse.error.message}`));
                        return;
                    }

                    // Check if response contains choices (the actual content)
                    if (!jsonResponse.choices || jsonResponse.choices.length === 0) {
                        reject(new Error('OpenRouter API: No response choices received'));
                        return;
                    }

                    resolve(jsonResponse);
                } catch (error) {
                    reject(new Error(`Failed to parse JSON response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.setTimeout(60000); // 60 second timeout
        req.write(requestData);
        req.end();
    });
}

/**
 * Extract just the message content from OpenRouter response
 * Handles potential tool calls or multiple choices.
 * @param {Object} response - Full OpenRouter API response
 * @returns {string|Object|null} - The message content, tool calls, or null if not found
 */
function extractMessageContent(response) {
        try {
        return response.choices?.[0]?.message?.content ?? null;
    } catch (_) {
        return null;
    }
}

/**
 * IMPROVED JSON Parser with better error handling and multiple fallback strategies
 * This function remains largely the same as it parses text, regardless of the API source.
 * @param {string} text - Text response from LLM
 * @returns {Object} - Parsed JSON object or structured fallback
 */
function parseMultipleItinerariesJSON(text) {
    if (!text) {
        return {
            success: false,
            error: "No text content received",
            rawText: text,
            fallbackData: { error: "No content" }
        };
    }

    // Strategy 1: Try to find JSON within markdown code blocks (most common case)
    const codeBlockPatterns = [
        /```json\s*(\{[\s\S]*?\})\s*```/i,
        /```\s*(\{[\s\S]*?\})\s*```/i,
        /`(\{[\s\S]*?\})`/i
    ];

    for (const pattern of codeBlockPatterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                const parsed = JSON.parse(match[1].trim());
                return {
                    success: true,
                    data: parsed,
                    rawText: text,
                    parseMethod: 'markdown_code_block'
                };
            } catch (parseError) {
                console.log(`Failed to parse markdown JSON: ${parseError.message}`);
                continue;
            }
        }
    }

    // Strategy 2: Try direct JSON parsing (no markdown)
    try {
        const parsed = JSON.parse(text.trim());
        return {
            success: true,
            data: parsed,
            rawText: text,
            parseMethod: 'direct_json'
        };
    } catch (parseError) {
        console.log(`Direct JSON parse failed: ${parseError.message}`);
    }

    // Strategy 3: Extract JSON from first { to last }
    try {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const extractedJson = text.substring(firstBrace, lastBrace + 1);
            const parsed = JSON.parse(extractedJson);
            return {
                success: true,
                data: parsed,
                rawText: text,
                parseMethod: 'brace_extraction'
            };
        }
    } catch (extractError) {
        console.log(`Brace extraction failed: ${extractError.message}`);
    }

    // Strategy 4: Try to fix common JSON issues and parse
    try {
        let fixedJson = text;

        // Remove markdown code block markers
        fixedJson = fixedJson.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

        // Try to extract JSON portion
        const jsonMatch = fixedJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            fixedJson = jsonMatch[0];

            // Fix common JSON issues
            fixedJson = fixedJson
                .replace(/,\s*}/g, '}')  // Remove trailing commas
                .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                .replace(/'/g, '"')      // Replace single quotes with double quotes
                .replace(/(\w+):/g, '"$1":')  // Quote unquoted keys
                .replace(/"{2,}/g, '"'); // Fix double quotes

            const parsed = JSON.parse(fixedJson);
            return {
                success: true,
                data: parsed,
                rawText: text,
                parseMethod: 'json_fixing'
            };
        }
    } catch (fixError) {
        console.log(`JSON fixing failed: ${fixError.message}`);
    }

    // Strategy 5: Create structured fallback with enhanced parsing
    console.log('All JSON parsing strategies failed, creating enhanced fallback');
    return {
        success: false,
        error: "Could not parse as JSON after multiple attempts",
        rawText: text,
        fallbackData: createEnhancedFallbackStructure(text),
        parseMethod: 'enhanced_fallback'
    };
}

/**
 * ENHANCED fallback structure creator with better text analysis
 * This function remains largely the same as it operates on text.
 * @param {string} text - Raw text response
 * @returns {Object} - Enhanced structured data
 */
function createEnhancedFallbackStructure(text) {
    const lines = text.split('\n').filter(line => line.trim());

    const extractedInfo = {
        title: null,
        theme: null,
        duration: null,
        startLocation: null,
        endLocation: null,
        totalDistance: null,
        budget: null,
        days: []
    };

    const titleMatch = text.match(/"title":\s*"([^"]+)"/i) || text.match(/title:\s*([^\n,]+)/i);
    if (titleMatch) extractedInfo.title = titleMatch[1].trim();

    const themeMatch = text.match(/"theme":\s*"([^"]+)"/i);
    if (themeMatch) extractedInfo.theme = themeMatch[1].trim();

    const durationMatch = text.match(/"duration":\s*(\d+)/i) || text.match(/(\d+)\s*days?/i);
    if (durationMatch) extractedInfo.duration = parseInt(durationMatch[1]);

    const startMatch = text.match(/"startLocation":\s*"([^"]+)"/i);
    if (startMatch) extractedInfo.startLocation = startMatch[1].trim();

    const endMatch = text.match(/"endLocation":\s*"([^"]+)"/i);
    if (endMatch) extractedInfo.endLocation = endMatch[1].trim();

    const distanceMatch = text.match(/"totalDistance":\s*"([^"]+)"/i);
    if (distanceMatch) extractedInfo.totalDistance = distanceMatch[1].trim();

    const budgetMatch = text.match(/"estimatedBudget":\s*"([^"]+)"/i);
    if (budgetMatch) extractedInfo.budget = budgetMatch[1].trim();

    const dayPattern = /"day":\s*(\d+)/gi;
    let dayMatch;
    while ((dayMatch = dayPattern.exec(text)) !== null) {
        const dayNumber = parseInt(dayMatch[1]);

        const dayTitlePattern = new RegExp(`"day":\\s*${dayNumber}[^}]*"title":\\s*"([^"]+)"`, 'i');
        const dayTitleMatch = text.match(dayTitlePattern);

        extractedInfo.days.push({
            day: dayNumber,
            title: dayTitleMatch ? dayTitleMatch[1] : `Day ${dayNumber}`,
            hasData: true
        });
    }

    return {
        type: "enhanced_text_itinerary",
        content: text,
        extractedInfo: extractedInfo,
        stats: {
            totalLines: lines.length,
            totalCharacters: text.length,
            foundDays: extractedInfo.days.length,
            hasBasicInfo: !!(extractedInfo.title && extractedInfo.duration)
        }
    };
}

/* -------------------------------------------------------------------------- */
/*  Coordinate processing – NEW                                               */
/* -------------------------------------------------------------------------- */
async function geocodeItineraryCoordinates(itinerary) {
    const processed = { ...itinerary };
    for (const day of processed.days) {
        for (const activity of day.activities) {
            try {
                const coords = await getOpenStreetMapCoordinates(activity.location);
                activity.coordinates = { lat: coords.lat, lng: coords.lng };
            } catch (e) {
                console.error(`Failed to geocode "${activity.location}": ${e.message}`);
                // Fallback placeholder – not a real coordinate
                activity.coordinates = { lat: 0, lng: 0 };
            }
        }
    }
    return processed;
}


/**
 * IMPROVED version with retry logic and better error handling for generating itineraries
 * This function will now use queryOpenRouter instead of queryGemini.
 * @param {Object} travelData - Travel request data from Express server
 * @returns {Promise<Object>} - Multiple travel itinerary responses
 */
async function generateMultipleTravelItinerariesSeparate(travelData) {
    try {
        const {
            source,
            destination,
            days,
            travelMode = 'motorbiking',
            preferences = [],
            numItineraries = 3
        } = travelData;

        if (!source || !destination || !days) {
            throw new Error('Source, destination, and number of days are required');
        }

        const actualNumItineraries = Math.min(Math.max(numItineraries, 2), 3);
        const itineraryThemes = [
            {
                theme: "Adventure Explorer Route",
                focus: "Maximum adventure and off‑road experiences with challenging terrain, extreme sports, and wilderness camping",
                style: "challenging"
            },
            {
                theme: "Cultural Heritage Trail",
                focus: "Balance of adventure with deep cultural immersion, local traditions, authentic stays, and community experiences",
                style: "moderate"
            },
            {
                theme: "Scenic Discovery Path",
                focus: "Emphasis on breathtaking landscapes, photography spots, serene locations, and comfortable exploration",
                style: "easy"
            }
        ];

        const results = [];
        const rawContents = [];

        for (let i = 0; i < actualNumItineraries; i++) {
            const currentTheme = itineraryThemes[i];
            let success = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (!success && attempts < maxAttempts) {
                attempts++;
                try {
                    // --------- PROMPT (NO COORDINATES REQUESTED) ----------
                    const userPrompt = `Generate 1 travel itinerary for a ${days} day ${travelMode} tour to ${destination} starting from ${source}.

ITINERARY THEME: ${currentTheme.theme}
FOCUS: ${currentTheme.focus}
DIFFICULTY: ${currentTheme.style}

Make it itinerary #${i + 1} of ${actualNumItineraries} and unique.

Key requirements:
- Focus on the above theme.
- Include off‑beat destinations.
- Suggest scenic routes matching the difficulty.
- Provide detailed timings and distances.
- Include budget estimates.
- For each activity, give:
  * exact location name (do NOT add coordinates)
  * entry fee ("Free" if none)
  * booking_required flag + booking_info when true
- Return ONLY valid JSON, start with { and end with }.

Additional preferences: ${preferences.length > 0 ? preferences.join(', ') : 'None specified'}

CRITICAL FORMATTING:
1. ONLY JSON – no markdown, no explanations, no code fences.
2. Start with { and end with }.
3. Use double quotes throughout.
4. No extra text before/after JSON.

Required structure:
{
  "id": ${i + 1},
  "title": "${currentTheme.theme}",
  "theme": "${currentTheme.focus}",
  "overview": {
    "duration": ${days},
    "startLocation": "${source}",
    "endLocation": "${destination}",
    "travelMode": "${travelMode}",
    "totalDistance": "approx.",
    "estimatedBudget": "range",
    "difficulty": "${currentTheme.style}"
  },
  "days": [
    {
      "day": 1,
      "title": "Day title",
      "route": "Brief route description",
      "distance": "km",
      "activities": [
        {
          "time": "09:00",
          "title": "Activity name",
          "description": "Short description",
          "location": "Exact location name",
          "duration_minutes": 60,
          "entry_fee": "Free or INR 50",
          "booking_required": true,
          "booking_info": {
            "contact_phone": "+91‑XXXXXXXXXX",
            "contact_email": "email@example.com",
            "website": "https://example.com",
            "advance_booking_days": 1,
            "notes": "Book early"
          }
        }
      ],
      "accommodation": "Suggestion",
      "meals": "Suggestion",
      "budget": "Daily budget"
    }
  ]
}`;

                    const systemPrompt = `You are a travel‑planning expert.
Return ONLY valid JSON.
- No markdown or explanatory text.
- Use proper JSON syntax.
- Include location names (not coordinates).
- Include entry fees.
- Include booking_info when booking_required is true.
Create a ${currentTheme.style} itinerary focused on: ${currentTheme.focus}`;

                    console.log(`🚀 Attempt ${attempts} – itinerary ${i + 1}`);

                    const openRouterResponse = await queryOpenRouter(userPrompt, {
                        systemPrompt,
                        model: process.env.OPENROUTER_MODEL,
                        maxTokens: 6000,
                        temperature: 0.2 + attempts * 0.1                    });

                    const rawContent = extractMessageContent(openRouterResponse);
                    if (!rawContent) throw new Error('No content extracted from OpenRouter response');

                    rawContents.push(rawContent);

                    const parsed = parseMultipleItinerariesJSON(rawContent);
                    if (parsed.success) {
                        console.log(`✅ Itinerary ${i + 1} parsed successfully`);
                        results.push(parsed.data);
                        success = true;
                    } else {
                        console.log(`❌ Parse failed: ${parsed.error}`);
                        if (attempts === maxAttempts) {
                            console.log('⚠️ Using enhanced fallback');
                            results.push({
                                id: i + 1,
                                title: currentTheme.theme,
                                theme: currentTheme.focus,
                                error: 'Parse failure – fallback used',
                                fallbackData: parsed,
                                rawContent                            });
                            success = true;
                        } else {
                            await new Promise(r => setTimeout(r, 2000 * attempts));
                        }
                    }

                } catch (err) {
                    console.error(`🚨 Request error (attempt ${attempts}): ${err.message}`);
                    errors?.push({ itinerary: i + 1, attempt: attempts, error: err.message });
                    if (attempts === maxAttempts) {
                        results.push({
                            id: i + 1,
                            title: currentTheme.theme,
                            theme: currentTheme.focus,
                            error: 'API request exhausted',
                            requestError: err.message,
                            fallbackData: { type: 'error_fallback' }
                        });
                        success = true;
                    } else {
                        await new Promise(r => setTimeout(r, 3000 * attempts));
                    }
                }
            }

            // small pause between different itineraries
            if (i < actualNumItineraries - 1) await new Promise(r => setTimeout(r, 1000));
        }

        // ----------- COORDINATE GEOCODING (NEW) -----------------
        const finalItineraries = await Promise.all(
            results.map(it => geocodeItineraryCoordinates(it))
        );
        results = finalItineraries;

        // ----------- GATHER STATS -----------------
        const successful = results.filter(it => !it.error).length;
        const partial = results.filter(it => it.error && it.fallbackData).length;

        return {
            success: true,
            data: {
                itineraries: { itineraries: results },
                rawItineraries: rawContents,
                parseInfo: {
                    totalGenerated: results.length,
                    successfullyParsed: successful,
                    partialSuccess: partial,
                    totalErrors: (errors ?? []).length,
                    errors: errors ?? []
                },
                travelDetails: {
                    source,
                    destination,
                    days,
                    travelMode,
                    preferences,
                    numItineraries: actualNumItineraries
                }
            }
        };
    } catch (err) {
        return { success: false, error: err.message, data: null };
    }
}


/**
 * Generate multiple travel itineraries using OpenRouter (uses improved separate method)
 * @param {Object} travelData - Travel request data
 * @returns {Promise<Object>} - Multiple travel itinerary responses
 */
async function generateMultipleTravelItineraries(travelData) {
    return generateMultipleTravelItinerariesSeparate(travelData);
}

/**
 * Generate single travel itinerary using OpenRouter (legacy function - kept for backward compatibility)
 * @param {Object} travelData - Travel request data from Express server
 * @returns {Promise<Object>} - Travel itinerary response
 */
async function generateTravelItinerary(travelData) {
    const single = await generateMultipleTravelItineraries({ ...travelData, numItineraries: 1 });
    if (!single.success) return single;
    const first = single.data.itineraries.itineraries[0];
    return {
        success: true,
        data: {
            ...single.data,
            itinerary: first,
            allItineraries: single.data.itineraries
        }
    };
}


/**
 * Process data from Express server and query OpenRouter
 * @param {Object} data - Data received from Express server
 * @param {Object} promptConfig - Configuration for building the prompt
 * @returns {Promise<Object>} - Processed response
 */
async function processDataWithOpenRouter(data, promptConfig = {}) {
    try {
        const {
            basePrompt = 'Please analyze the following data:',
            instructions = 'Provide a comprehensive analysis.',
            format = 'json'
        } = promptConfig;

        const dataString = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        const userPrompt = `${basePrompt}\n\nData:\n${dataString}\n\nInstructions: ${instructions}`;

        const systemPrompt = format === 'json'
            ? 'You are an expert travel planner that responds with valid JSON only.'
            : 'You are a helpful assistant that analyzes data and provides clear, structured responses.';

        const response = await queryOpenRouter(userPrompt, {
            systemPrompt,
            model: MODEL_AI,
            maxTokens: 1500,
            temperature: 0.7
        });

        return {
            success: true,
            data: {
                fullResponse: response,
                message: extractMessageContent(response),
                tokenUsage: response.usage || null
            }
        };
    } catch (err) {
        return { success: false, error: err.message, data: null };
    }
}


module.exports = {
    queryOpenRouter,
    extractMessageContent,
    parseMultipleItinerariesJSON,
    processDataWithOpenRouter, // Renamed to reflect OpenRouter usage
    generateTravelItinerary,
    generateMultipleTravelItineraries,
    generateMultipleTravelItinerariesSeparate
};
