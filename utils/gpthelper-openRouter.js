const https = require('https');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_AI = process.env.MODEL_AI || 'openai/gpt-4o-mini';

/* -------------------------------------------------------------------------- */
/*  Core HTTP wrapper for GitHub Models / OpenAI-compatible endpoint          */
/* -------------------------------------------------------------------------- */
async function queryOpenAI(userPrompt, options = {}) {
    return new Promise((resolve, reject) => {
        if (!OPENAI_API_KEY) {
            reject(new Error('OpenAI API key not configured'));
            return;
        }

        const {
            systemPrompt = '',
            model = MODEL_AI,
            maxTokens = 200,
            temperature = 0.7,
            additionalContext = '',
            tools = [],
            tool_choice = tools.length > 0 ? 'auto' : undefined
        } = options;

        const messages = [];
        if (systemPrompt)       messages.push({ role: 'system', content: systemPrompt });
        if (additionalContext)  messages.push({ role: 'user',   content: additionalContext });
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
                    if (json.error) { reject(new Error(`OpenAI API Error: ${json.error.message}`)); return; }
                    if (!json.choices?.length) { reject(new Error('OpenAI API: No response choices received')); return; }
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

function extractMessageContent(response) {
    try { return response.choices?.[0]?.message?.content ?? null; }
    catch (_) { return null; }
}

/* -------------------------------------------------------------------------- */
/*  JSON parsing with multiple fallback strategies                            */
/* -------------------------------------------------------------------------- */
function parseMultipleItinerariesJSON(text) {
    if (!text) {
        return { success: false, error: 'No text content received', rawText: text, fallbackData: { error: 'No content' } };
    }

    // Strategy 1: Markdown code block
    for (const pattern of [/```json\s*(\{[\s\S]*?\})\s*```/i, /```\s*(\{[\s\S]*?\})\s*```/i, /`(\{[\s\S]*?\})`/i]) {
        const match = text.match(pattern);
        if (match) {
            try { return { success: true, data: JSON.parse(match[1].trim()), rawText: text, parseMethod: 'markdown_code_block' }; }
            catch { continue; }
        }
    }

    // Strategy 2: Direct JSON
    try { return { success: true, data: JSON.parse(text.trim()), rawText: text, parseMethod: 'direct_json' }; }
    catch { /* continue */ }

    // Strategy 3: Brace extraction
    try {
        const first = text.indexOf('{');
        const last  = text.lastIndexOf('}');
        if (first !== -1 && last > first) {
            return { success: true, data: JSON.parse(text.substring(first, last + 1)), rawText: text, parseMethod: 'brace_extraction' };
        }
    } catch { /* continue */ }

    // Strategy 4: Fix common JSON issues
    try {
        let fixed = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        const jsonMatch = fixed.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            fixed = jsonMatch[0]
                .replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
                .replace(/'/g, '"')
                .replace(/(\w+):/g, '"$1":')
                .replace(/"{2,}/g, '"');
            return { success: true, data: JSON.parse(fixed), rawText: text, parseMethod: 'json_fixing' };
        }
    } catch { /* continue */ }

    return {
        success: false,
        error: 'Could not parse as JSON after multiple attempts',
        rawText: text,
        fallbackData: createEnhancedFallbackStructure(text),
        parseMethod: 'enhanced_fallback'
    };
}

function createEnhancedFallbackStructure(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const m = (re) => (text.match(re) || [])[1]?.trim() || null;
    const extracted = {
        title: m(/"title":\s*"([^"]+)"/i) || m(/title:\s*([^\n,]+)/i),
        theme: m(/"theme":\s*"([^"]+)"/i),
        duration: parseInt(m(/"duration":\s*(\d+)/i) || m(/(\d+)\s*days?/i)) || null,
        startLocation: m(/"startLocation":\s*"([^"]+)"/i),
        endLocation: m(/"endLocation":\s*"([^"]+)"/i),
        totalDistance: m(/"totalDistance":\s*"([^"]+)"/i),
        budget: m(/"estimatedBudget":\s*"([^"]+)"/i),
        days: []
    };
    const dayPattern = /"day":\s*(\d+)/gi;
    let dayMatch;
    while ((dayMatch = dayPattern.exec(text)) !== null) {
        const n = parseInt(dayMatch[1]);
        const titleMatch = text.match(new RegExp(`"day":\\s*${n}[^}]*"title":\\s*"([^"]+)"`, 'i'));
        extracted.days.push({ day: n, title: titleMatch ? titleMatch[1] : `Day ${n}`, hasData: true });
    }
    return {
        type: 'enhanced_text_itinerary', content: text, extractedInfo: extracted,
        stats: { totalLines: lines.length, totalCharacters: text.length, foundDays: extracted.days.length, hasBasicInfo: !!(extracted.title && extracted.duration) }
    };
}

/* -------------------------------------------------------------------------- */
/*  4 Itinerary themes                                                        */
/* -------------------------------------------------------------------------- */
const THEMES = [
    {
        id: 1,
        title: "Adventurous Ride",
        theme: "adventurous",
        style: "challenging",
        focus: `Push limits with thrilling mountain passes, forest trails, riverside canyon roads, and off-beat villages most tourists never see.
                Include at least 1 challenging ghat section or hill climb per travel day.
                Activities must include: local trekking spots, viewpoints reachable only by bike, waterfalls, and adventure sports where available.
                Accommodation should be rustic homestays, camping sites, or budget guesthouses near nature.
                Meals must be authentic local dhabas or forest-side eateries — no hotels.
                Each day must cover 200–350 km with 5–6 activities mixing riding highlights and stops.`
    },
    {
        id: 2,
        title: "Leisure Ride",
        theme: "leisure",
        style: "easy",
        focus: `A relaxed, unhurried ride for riders who want to enjoy the journey more than chase distance.
                Cover only 100–180 km per day with long, peaceful stops.
                Activities must include: roadside chai stops, local market walks, temple/heritage visits, scenic riverside or hilltop breaks, and photography spots.
                Accommodation should be comfortable mid-range hotels or well-reviewed homestays.
                Meals must be a mix of popular local restaurants and street food.
                Include 1–2 rest/explore-only days with zero riding at interesting towns.
                Tone is calm, scenic, and culturally rich.`
    },
    {
        id: 3,
        title: "Vacation Ride",
        theme: "vacation",
        style: "comfortable",
        focus: `Designed for riders travelling with family or a partner who want both riding enjoyment and a proper holiday experience.
                Balance riding days with full sightseeing days at the destination.
                Activities must include: famous tourist attractions, comfortable restaurant dining, resort or hotel stays with amenities, beach/lake/hill station specific activities, and local experiences like cooking classes or cultural shows.
                Accommodation must be 3–4 star hotels or well-rated resorts.
                Meals must be at popular, well-reviewed restaurants — include one special/fine dining experience.
                Keep daily riding to 150–250 km on good highways. Focus heavily on the destination stay days.`
    },
    {
        id: 4,
        title: "Quickest Route",
        theme: "express",
        style: "fast",
        focus: `Built for riders who want to reach the destination as fast as possible with minimal detours.
                Prioritise national highways, expressways, and bypasses. Avoid ghat roads, forest routes, and city loops unless unavoidable.
                Cover 350–500 km per riding day.
                Stops must be strictly functional: fuel stations, highway dhabas, clean restrooms, and one short lunch break per day.
                Accommodation must be highway-adjacent hotels or lodges for early departure next day.
                No sightseeing on travel days. All exploration is reserved for the destination stay days only.
                Return journey should mirror or slightly optimise the outbound route.`
    }
];

/* -------------------------------------------------------------------------- */
/*  Prompt builder                                                             */
/* -------------------------------------------------------------------------- */
function buildPrompt(theme, source, destination, days, travelMode, preferences) {
    const mustInclude = preferences.length > 0
        ? `MANDATORY STOPS (must appear in the itinerary): ${preferences.join(', ')}.`
        : 'No specific stops requested — choose the best ones for this theme.';

    // Day split guidance
    const outbound = Math.max(1, Math.round(days * 0.30));
    const stay     = Math.max(1, Math.round(days * 0.40));
    const returnD  = days - outbound - stay;

    return {
        system: `You are an expert Indian motorcycle travel planner with deep knowledge of Indian highways, state roads, dhabas, homestays, and tourist spots.
You always return ONLY a single minified valid JSON object — no markdown, no explanation, no extra text.
Rules:
- All place names, road names, dhabas, hotels must be REAL and verifiable in India.
- All distances must be realistic for Indian road conditions (not straight-line).
- All entry fees must be accurate (e.g., "Free", "INR 50", "INR 200").
- All durations must be realistic (e.g., a dhaba stop = 30 min, a waterfall trek = 90 min).
- Accommodation names must be real or clearly typed as "Any highway lodge" / "Homestay near X".
- No coordinates. No placeholder text like "XYZ hotel" or "some dhaba".`,

        user: `Generate a ${days}-day ${travelMode} itinerary from ${source} to ${destination}.

THEME: ${theme.title}
APPROACH: ${theme.focus}

${mustInclude}

DAY STRUCTURE:
- Days 1–${outbound}: Outbound journey (${source} → ${destination} direction)
- Days ${outbound + 1}–${outbound + stay}: Exploration & stay at ${destination}
- Days ${outbound + stay + 1}–${days}: Return journey (${destination} → ${source})

REQUIRED JSON SCHEMA (output exactly this structure, minified):
{"id":${theme.id},"title":"${theme.title}","theme":"${theme.theme}","ov":{"days":${days},"dist":"total km string","bud":"total budget range in INR","diff":"${theme.style}","startLocation":"${source}","endLocation":"${destination}","travelMode":"${travelMode}"},"days":[{"d":1,"t":"Descriptive Day Title","r":"Exact Road/Highway Name e.g. NH-48 Bangalore to Tumkur","distance":"km covered today","acts":[{"tm":"09:00","n":"Real Activity or Place Name","desc":"2–3 sentence realistic description with what to expect","loc":"Exact real location name","dur":60,"fee":"Free or INR XX","bk":null}],"stay":"Real hotel/homestay name or type + location","meal":"Real dhaba/restaurant name or type + signature dish","db":"Realistic day budget in INR e.g. INR 1500–2500"}]}

STRICT RULES:
- "bk" must be null when booking is not needed. Only set it to {"req":true,"info":"booking details"} for genuinely bookable experiences.
- Every activity "desc" must describe the real experience — sights, smells, what to do there.
- "r" must be actual road names or highway numbers, not just "scenic road".
- "stay" and "meal" must be real or clearly described real-type options with location context.
- Output minified JSON only. No markdown fences.`
    };
}

/* -------------------------------------------------------------------------- */
/*  Main generator — 4 itineraries                                            */
/* -------------------------------------------------------------------------- */
async function generateMultipleTravelItinerariesSeparate(travelData) {
    try {
        const {
            source,
            destination,
            days,
            travelMode   = 'motorbiking',
            preferences  = [],
            numItineraries = 4   // default 4, ignored — always generates all 4 themes
        } = travelData;

        if (!source || !destination || !days) {
            throw new Error('Source, destination, and number of days are required');
        }

        const results     = [];
        const rawContents = [];
        const errors      = [];

        for (let i = 0; i < THEMES.length; i++) {
            const theme   = THEMES[i];
            let success   = false;
            let attempts  = 0;

            while (!success && attempts < 3) {
                attempts++;
                try {
                    const { system, user } = buildPrompt(theme, source, destination, days, travelMode, preferences);

                    console.log(`🚀 Generating "${theme.title}" (attempt ${attempts})`);

                    const response = await queryOpenAI(user, {
                        systemPrompt: system,
                        model:        MODEL_AI,
                        maxTokens:    8000,
                        temperature:  0.3 + (attempts - 1) * 0.1   // slightly warmer on retries
                    });

                    const rawContent = extractMessageContent(response);
                    if (!rawContent) throw new Error('Empty response from model');

                    rawContents.push(rawContent);

                    const parsed = parseMultipleItinerariesJSON(rawContent);
                    if (parsed.success) {
                        console.log(`✅ "${theme.title}" parsed successfully`);
                        results.push(parsed.data);
                        success = true;
                    } else {
                        console.warn(`❌ Parse failed (attempt ${attempts}): ${parsed.error}`);
                        if (attempts === 3) {
                            console.warn(`⚠️  Using fallback for "${theme.title}"`);
                            results.push({
                                id: theme.id, title: theme.title, theme: theme.theme,
                                error: 'Parse failure – fallback used',
                                fallbackData: parsed, rawContent
                            });
                            success = true;
                        } else {
                            await delay(2000 * attempts);
                        }
                    }
                } catch (err) {
                    console.error(`🚨 Request error "${theme.title}" attempt ${attempts}: ${err.message}`);
                    errors.push({ itinerary: theme.title, attempt: attempts, error: err.message });
                    if (attempts === 3) {
                        results.push({
                            id: theme.id, title: theme.title, theme: theme.theme,
                            error: 'API request exhausted', requestError: err.message,
                            fallbackData: { type: 'error_fallback' }
                        });
                        success = true;
                    } else {
                        await delay(3000 * attempts);
                    }
                }
            }

            // Small gap between requests to avoid rate limiting
            if (i < THEMES.length - 1) await delay(1500);
        }

        const successful = results.filter(it => !it.error).length;
        const partial    = results.filter(it => it.error && it.fallbackData).length;

        return {
            success: true,
            data: {
                itineraries: { itineraries: results },
                rawItineraries: rawContents,
                parseInfo: {
                    totalGenerated:    results.length,
                    successfullyParsed: successful,
                    partialSuccess:    partial,
                    totalErrors:       errors.length,
                    errors
                },
                travelDetails: { source, destination, days, travelMode, preferences, numItineraries: THEMES.length }
            }
        };
    } catch (err) {
        return { success: false, error: err.message, data: null };
    }
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

/* -------------------------------------------------------------------------- */
/*  Convenience wrappers                                                      */
/* -------------------------------------------------------------------------- */
async function generateMultipleTravelItineraries(travelData) {
    return generateMultipleTravelItinerariesSeparate(travelData);
}

async function generateTravelItinerary(travelData) {
    const result = await generateMultipleTravelItineraries({ ...travelData, numItineraries: 1 });
    if (!result.success) return result;
    const first = result.data.itineraries.itineraries[0];
    return { success: true, data: { ...result.data, itinerary: first, allItineraries: result.data.itineraries } };
}

async function processDataWithOpenAI(data, promptConfig = {}) {
    try {
        const {
            basePrompt   = 'Please analyze the following data:',
            instructions = 'Provide a comprehensive analysis.',
            format       = 'json'
        } = promptConfig;

        const dataString  = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        const userPrompt  = `${basePrompt}\n\nData:\n${dataString}\n\nInstructions: ${instructions}`;
        const systemPrompt = format === 'json'
            ? 'You are an expert travel planner that responds with valid JSON only.'
            : 'You are a helpful assistant that analyzes data and provides clear, structured responses.';

        const response = await queryOpenAI(userPrompt, { systemPrompt, model: MODEL_AI, maxTokens: 1500, temperature: 0.7 });
        return {
            success: true,
            data: { fullResponse: response, message: extractMessageContent(response), tokenUsage: response.usage || null }
        };
    } catch (err) {
        return { success: false, error: err.message, data: null };
    }
}

module.exports = {
    queryOpenAI,
    extractMessageContent,
    parseMultipleItinerariesJSON,
    processDataWithOpenAI,
    generateTravelItinerary,
    generateMultipleTravelItineraries,
    generateMultipleTravelItinerariesSeparate
};