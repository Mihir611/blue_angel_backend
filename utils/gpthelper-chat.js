const https = require('https');
const OPENAI_API_KEY = process.env.GPT_API_KEY;

/**
 * Send a query to ChatGPT and get response
 * @param {string} userPrompt - The main prompt/data from your Express server
 * @param {Object} options - Additional options for the query
 * @param {string} options.systemPrompt - System message to set context
 * @param {string} options.model - OpenAI model to use (default: gpt-3.5-turbo)
 * @param {number} options.maxTokens - Maximum tokens in response (default: 1000)
 * @param {number} options.temperature - Response creativity (0-2, default: 0.7)
 * @param {string} options.additionalContext - Extra context to add to the prompt
 * @returns {Promise<Object>} - ChatGPT response object
 */
async function queryChatGPT(userPrompt, options = {}) {
    return new Promise((resolve, reject) => {
        // Validate API key
        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
            reject(new Error('OpenAI API key not configured'));
            return;
        }

        // Set default options
        const {
            systemPrompt = '',
            model = 'gpt-3.5-turbo',
            maxTokens = 1000,
            temperature = 0.7,
            additionalContext = ''
        } = options;

        // Build the messages array
        const messages = [];
        
        // Add system message if provided
        if (systemPrompt) {
            messages.push({
                role: "system",
                content: systemPrompt
            });
        }

        // Combine user prompt with additional context
        let finalPrompt = userPrompt;
        if (additionalContext) {
            finalPrompt = `${additionalContext}\n\n${userPrompt}`;
        }

        messages.push({
            role: "user",
            content: finalPrompt
        });

        const requestData = JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature
        });

        // Changed variable name from 'options' to 'requestOptions' to avoid conflict
        const requestOptions = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
                        reject(new Error(`OpenAI API Error: ${jsonResponse.error.message}`));
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

        req.setTimeout(30000); // 30 second timeout
        req.write(requestData);
        req.end();
    });
}

/**
 * Extract just the message content from ChatGPT response
 * @param {Object} response - Full ChatGPT API response
 * @returns {string|null} - The message content or null if not found
 */
function extractMessageContent(response) {
    try {
        return response.choices[0].message.content;
    } catch (error) {
        return null;
    }
}

/**
 * Generate travel itinerary using ChatGPT
 * @param {Object} travelData - Travel request data from Express server
 * @param {string} travelData.source - Starting location
 * @param {string} travelData.destination - Destination location
 * @param {number} travelData.days - Number of days for the trip
 * @param {string} travelData.travelMode - Mode of travel (motorbiking, car, etc.)
 * @param {Array} travelData.preferences - Additional preferences (optional)
 * @param {number} travelData.variationNumber - Variation number for multiple requests (optional)
 * @returns {Promise<Object>} - Travel itinerary response
 */
async function generateTravelItinerary(travelData) {
    try {
        const { 
            source, 
            destination, 
            days, 
            travelMode = 'motorbiking', 
            preferences = [],
            variationNumber = 1 
        } = travelData;

        // Validate required fields
        if (!source || !destination || !days) {
            throw new Error('Source, destination, and number of days are required');
        }

        // Add variation context to prompt for multiple requests
        const variationContext = variationNumber > 1 
            ? `\n\nNote: This is variation #${variationNumber} of the itinerary. Please provide a different route or alternative experiences compared to previous versions, while maintaining the same quality and adventure focus.`
            : '';

        // Build the travel itinerary prompt
        const userPrompt = `Generate a travel itinerary for a ${days} day ${travelMode} tour to ${destination} starting from ${source}. Along the way I want to visit few off-beat places and feel free to include few mountains, off-road adventures, hidden gems, scenic routes, adventure activities, and unexplored locations, not only popular tourist spots.

Key requirements:
- Focus on adventure and off-road experiences
- Include off-beat and lesser-known destinations
- Suggest scenic mountain routes and forest trails
- Incorporate local cultural experiences
- Provide detailed waypoints with coordinates
- Include adventure activities like trekking, water sports, etc.
- Mix of nature, adventure, and cultural attractions
- Detailed timing and distance information
- Budget estimates and practical tips
- Accommodation suggestions (preferably local/authentic)

Additional preferences: ${preferences.length > 0 ? preferences.join(', ') : 'None specified'}${variationContext}

Please provide a comprehensive itinerary with day-wise breakdown, including specific locations, activities, distances, timing, and practical information. Format the response as a well-structured JSON object with clear sections for each day.`;

        const systemPrompt = `You are an expert travel planner specializing in adventure and off-beat travel experiences. You have extensive knowledge of:
- Hidden gems and off-beat destinations
- Adventure activities and off-road routes
- Local cultural experiences and authentic stays
- Scenic mountain passes and forest trails
- Budget-friendly adventure travel
- Practical travel tips for motorbiking/road trips

Provide detailed, practical itineraries that focus on adventure, exploration, and authentic experiences rather than mainstream tourism. Include specific coordinates, distances, timing, and practical tips. Structure your response as a comprehensive travel guide with day-wise breakdown in JSON format.

If this is a variation request, ensure you provide different routes, alternative destinations, or unique experiences while maintaining the same level of detail and adventure focus.`;

        const response = await queryChatGPT(userPrompt, {
            systemPrompt,
            model: 'gpt-3.5-turbo',
            maxTokens: 4000,
            temperature: 0.8
        });

        return {
            success: true,
            data: {
                fullResponse: response,
                itinerary: extractMessageContent(response),
                tokenUsage: response.usage || null,
                travelDetails: {
                    source,
                    destination,
                    days,
                    travelMode,
                    preferences,
                    variationNumber
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
 * Process data from Express server and query ChatGPT
 * @param {Object} data - Data received from Express server
 * @param {Object} promptConfig - Configuration for building the prompt
 * @returns {Promise<Object>} - Processed response
 */
async function processDataWithChatGPT(data, promptConfig = {}) {
    try {
        // Build prompt based on your data structure
        const {
            basePrompt = "Please analyze the following data:",
            instructions = "Provide a comprehensive analysis.",
            format = "json"
        } = promptConfig;

        // Convert data to string if it's an object
        const dataString = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        
        const userPrompt = `${basePrompt}\n\nData:\n${dataString}\n\nInstructions: ${instructions}`;
        
        const systemPrompt = format === 'json' 
            ? "You are a helpful assistant that analyzes data and provides responses in JSON format when requested."
            : "You are a helpful assistant that analyzes data and provides clear, structured responses.";

        const response = await queryChatGPT(userPrompt, {
            systemPrompt,
            model: 'gpt-3.5-turbo',
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

    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

module.exports = {
    queryChatGPT,
    extractMessageContent,
    processDataWithChatGPT,
    generateTravelItinerary
};