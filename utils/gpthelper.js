const https = require('https');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Send a query to Gemini and get response - IMPROVED VERSION
 * @param {string} userPrompt - The main prompt/data from your Express server
 * @param {Object} options - Additional options for the query
 * @returns {Promise<Object>} - Gemini response object
 */
async function queryGemini(userPrompt, options = {}) {
    return new Promise((resolve, reject) => {
        // Validate API key
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
            reject(new Error('Gemini API key not configured'));
            return;
        }

        // Set default options
        const {
            systemPrompt = '',
            model = 'gemini-1.5-flash',
            maxTokens = 1000,
            temperature = 0.7,
            additionalContext = ''
        } = options;

        // Combine user prompt with additional context and system prompt
        let finalPrompt = userPrompt;
        if (additionalContext) {
            finalPrompt = `${additionalContext}\n\n${userPrompt}`;
        }
        if (systemPrompt) {
            finalPrompt = `${systemPrompt}\n\n${finalPrompt}`;
        }

        const requestData = JSON.stringify({
            contents: [{
                parts: [{
                    text: finalPrompt
                }]
            }],
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: temperature,
                topP: 0.8,
                topK: 10
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        });

        const requestOptions = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
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
                    
                    // Check for API errors
                    if (jsonResponse.error) {
                        reject(new Error(`Gemini API Error: ${jsonResponse.error.message}`));
                        return;
                    }
                    
                    // Check if response was blocked by safety filters
                    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
                        reject(new Error('Gemini API: No response generated or content was blocked by safety filters'));
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

        req.setTimeout(60000); // 60 second timeout for multiple itineraries
        req.write(requestData);
        req.end();
    });
}

/**
 * Extract just the message content from Gemini response
 * @param {Object} response - Full Gemini API response
 * @returns {string|null} - The message content or null if not found
 */
function extractMessageContent(response) {
    try {
        return response.candidates[0].content.parts[0].text;
    } catch (error) {
        return null;
    }
}

/**
 * IMPROVED JSON Parser with better error handling and multiple fallback strategies
 * @param {string} text - Text response from Gemini
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
 * @param {string} text - Raw text response
 * @returns {Object} - Enhanced structured data
 */
function createEnhancedFallbackStructure(text) {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Try to extract basic information from the text
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

    // Extract title
    const titleMatch = text.match(/"title":\s*"([^"]+)"/i) || text.match(/title:\s*([^\n,]+)/i);
    if (titleMatch) extractedInfo.title = titleMatch[1].trim();

    // Extract theme
    const themeMatch = text.match(/"theme":\s*"([^"]+)"/i);
    if (themeMatch) extractedInfo.theme = themeMatch[1].trim();

    // Extract duration
    const durationMatch = text.match(/"duration":\s*(\d+)/i) || text.match(/(\d+)\s*days?/i);
    if (durationMatch) extractedInfo.duration = parseInt(durationMatch[1]);

    // Extract locations
    const startMatch = text.match(/"startLocation":\s*"([^"]+)"/i);
    if (startMatch) extractedInfo.startLocation = startMatch[1].trim();

    const endMatch = text.match(/"endLocation":\s*"([^"]+)"/i);
    if (endMatch) extractedInfo.endLocation = endMatch[1].trim();

    // Extract distance
    const distanceMatch = text.match(/"totalDistance":\s*"([^"]+)"/i);
    if (distanceMatch) extractedInfo.totalDistance = distanceMatch[1].trim();

    // Extract budget
    const budgetMatch = text.match(/"estimatedBudget":\s*"([^"]+)"/i);
    if (budgetMatch) extractedInfo.budget = budgetMatch[1].trim();

    // Extract days information
    const dayPattern = /"day":\s*(\d+)/gi;
    let dayMatch;
    while ((dayMatch = dayPattern.exec(text)) !== null) {
        const dayNumber = parseInt(dayMatch[1]);
        
        // Try to extract day title
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

/**
 * IMPROVED version with retry logic and better error handling
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

        // Validate required fields
        if (!source || !destination || !days) {
            throw new Error('Source, destination, and number of days are required');
        }

        const actualNumItineraries = Math.min(Math.max(numItineraries, 2), 3);

        const itineraryThemes = [
            {
                theme: "Adventure Explorer Route",
                focus: "Maximum adventure and off-road experiences with challenging terrain, extreme sports, and wilderness camping",
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
        const errors = [];

        // Process each itinerary with retry logic
        for (let i = 0; i < actualNumItineraries; i++) {
            const currentTheme = itineraryThemes[i];
            let success = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (!success && attempts < maxAttempts) {
                attempts++;
                
                try {
                    // Enhanced prompt with explicit JSON formatting instructions
                    const userPrompt = `Generate 1 travel itinerary for a ${days} day ${travelMode} tour to ${destination} starting from ${source}.

ITINERARY THEME: ${currentTheme.theme}
FOCUS: ${currentTheme.focus}
DIFFICULTY: ${currentTheme.style}

This should be itinerary #${i + 1} of ${actualNumItineraries}, so make it UNIQUE and different from typical routes.

Key requirements:
- Focus on the specified theme above
- Include off-beat and lesser-known destinations
- Suggest scenic routes appropriate for the difficulty level
- Incorporate experiences matching the theme
- Provide detailed waypoints with coordinates
- Include activities suitable for the theme
- Detailed timing and distance information
- Budget estimates and practical tips
- Accommodation suggestions matching the theme

Additional preferences: ${preferences.length > 0 ? preferences.join(', ') : 'None specified'}

CRITICAL FORMATTING INSTRUCTIONS:
1. Return ONLY valid JSON - no markdown, no explanations, no code blocks
2. Start response with { and end with }
3. Use proper JSON syntax with double quotes
4. Do not include any text before or after the JSON object

Required JSON structure:
{
  "id": ${i + 1},
  "title": "${currentTheme.theme}",
  "theme": "${currentTheme.focus}",
  "overview": {
    "duration": ${days},
    "startLocation": "${source}",
    "endLocation": "${destination}",
    "travelMode": "${travelMode}",
    "totalDistance": "approximate distance",
    "estimatedBudget": "budget range",
    "difficulty": "${currentTheme.style}"
  },
  "days": [
    {
      "day": 1,
      "title": "Day title",
      "route": "Route description",
      "distance": "distance in km",
      "activities": ["activity1", "activity2"],
      "accommodation": "accommodation suggestion",
      "meals": "meal suggestions",
      "budget": "daily budget estimate",
      "highlights": ["highlight1", "highlight2"],
      "coordinates": {
        "start": "lat,lng",
        "end": "lat,lng"
      }
    }
  ]
}`;

                    const systemPrompt = `You are an expert travel planner. You MUST respond with valid JSON only.

CRITICAL RULES:
- NO markdown formatting (no \`\`\`json or \`\`\`)
- NO explanatory text before or after JSON
- NO code blocks
- Start with { and end with }
- Use proper JSON syntax with double quotes
- Ensure all strings are properly escaped

Create a ${currentTheme.style} difficulty itinerary focused on: ${currentTheme.focus}`;

                    console.log(`Attempting to generate itinerary ${i + 1}, attempt ${attempts}`);

                    const response = await queryGemini(userPrompt, {
                        systemPrompt,
                        model: 'gemini-2.0-flash-exp',
                        maxTokens: 4000,
                        temperature: 0.2 + (attempts * 0.1) // Reduce temperature on retries
                    });

                    const rawContent = extractMessageContent(response);
                    if (!rawContent) {
                        throw new Error('No content extracted from response');
                    }

                    rawContents.push(rawContent);
                    
                    const parsedItinerary = parseMultipleItinerariesJSON(rawContent);
                    
                    if (parsedItinerary.success) {
                        console.log(`Successfully generated itinerary ${i + 1} on attempt ${attempts}`);
                        results.push(parsedItinerary.data);
                        success = true;
                    } else {
                        console.log(`Failed to parse itinerary ${i + 1}, attempt ${attempts}: ${parsedItinerary.error}`);
                        
                        if (attempts === maxAttempts) {
                            // Use enhanced fallback on final attempt
                            console.log(`Using enhanced fallback for itinerary ${i + 1}`);
                            results.push({
                                id: i + 1,
                                title: currentTheme.theme,
                                theme: currentTheme.focus,
                                error: "Failed to parse after multiple attempts",
                                parseInfo: parsedItinerary,
                                fallbackData: parsedItinerary.fallbackData,
                                rawContent: rawContent
                            });
                            success = true; // Mark as success to continue
                        } else {
                            // Wait before retry
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
                        }
                    }

                } catch (requestError) {
                    console.log(`Request error for itinerary ${i + 1}, attempt ${attempts}: ${requestError.message}`);
                    errors.push({
                        itinerary: i + 1,
                        attempt: attempts,
                        error: requestError.message
                    });
                    
                    if (attempts === maxAttempts) {
                        // Create basic fallback structure
                        results.push({
                            id: i + 1,
                            title: currentTheme.theme,
                            theme: currentTheme.focus,
                            error: "Request failed after multiple attempts",
                            requestError: requestError.message,
                            fallbackData: {
                                type: "error_fallback",
                                message: "Failed to generate itinerary due to API issues"
                            }
                        });
                        success = true;
                    } else {
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
                    }
                }
            }

            // Small delay between different itineraries
            if (i < actualNumItineraries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Calculate success statistics
        const successfulItineraries = results.filter(it => !it.error).length;
        const partialSuccessItineraries = results.filter(it => it.error && it.fallbackData).length;

        return {
            success: true,
            data: {
                itineraries: {
                    itineraries: results
                },
                rawItineraries: rawContents,
                parseInfo: {
                    totalGenerated: results.length,
                    successfullyParsed: successfulItineraries,
                    partialSuccess: partialSuccessItineraries,
                    totalErrors: errors.length,
                    errors: errors
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

    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

/**
 * Generate multiple travel itineraries using Gemini (uses improved separate method)
 * @param {Object} travelData - Travel request data
 * @returns {Promise<Object>} - Multiple travel itinerary responses
 */
async function generateMultipleTravelItineraries(travelData) {
    return generateMultipleTravelItinerariesSeparate(travelData);
}

/**
 * Generate single travel itinerary using Gemini (legacy function - kept for backward compatibility)
 * @param {Object} travelData - Travel request data from Express server
 * @returns {Promise<Object>} - Travel itinerary response
 */
async function generateTravelItinerary(travelData) {
    const multipleResult = await generateMultipleTravelItineraries({
        ...travelData,
        numItineraries: 1
    });

    if (multipleResult.success && multipleResult.data.itineraries && multipleResult.data.itineraries.itineraries) {
        const firstItinerary = multipleResult.data.itineraries.itineraries[0];
        return {
            success: true,
            data: {
                ...multipleResult.data,
                itinerary: firstItinerary,
                allItineraries: multipleResult.data.itineraries
            }
        };
    }

    return multipleResult;
}

/**
 * Process data from Express server and query Gemini
 * @param {Object} data - Data received from Express server
 * @param {Object} promptConfig - Configuration for building the prompt
 * @returns {Promise<Object>} - Processed response
 */
async function processDataWithGemini(data, promptConfig = {}) {
    try {
        const {
            basePrompt = "Please analyze the following data:",
            instructions = "Provide a comprehensive analysis.",
            format = "json"
        } = promptConfig;

        const dataString = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        
        const userPrompt = `${basePrompt}\n\nData:\n${dataString}\n\nInstructions: ${instructions}`;
        
        const systemPrompt = format === 'json' 
            ? "You are a helpful assistant that analyzes data and provides responses in JSON format when requested."
            : "You are a helpful assistant that analyzes data and provides clear, structured responses.";

        const response = await queryGemini(userPrompt, {
            systemPrompt,
            model: 'gemini-1.5-flash',
            maxTokens: 1500,
            temperature: 0.7
        });

        return {
            success: true,
            data: {
                fullResponse: response,
                message: extractMessageContent(response),
                tokenUsage: response.usageMetadata || null
            }
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

module.exports = {
    queryGemini,
    extractMessageContent,
    parseMultipleItinerariesJSON,
    processDataWithGemini,
    generateTravelItinerary,
    generateMultipleTravelItineraries,
    generateMultipleTravelItinerariesSeparate
};