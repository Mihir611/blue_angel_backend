// /**
//  * aiTripService.js
//  * Generates 3 distinct biker itineraries in parallel (adventure, cruise, relax)
//  * using the Google Gemini REST API directly via Node.js https module —
//  * same approach as the working queryGemini implementation.
//  */

// const https = require('https');
// const { TRIP_STYLES, getPinColor } = require('../config/tripStyles');

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// // ─── CORE HTTP CALLER (mirrors your working queryGemini) ─────────────────────
// function callGemini(prompt, options = {}) {
//     return new Promise((resolve, reject) => {
//         if (!GEMINI_API_KEY) {
//             return reject(new Error('GEMINI_API_KEY is not set in environment'));
//         }

//         const {
//             maxTokens = 8192,
//             temperature = 0.2,
//         } = options;

//         const requestBody = JSON.stringify({
//             contents: [{
//                 parts: [{ text: prompt }],
//             }],
//             generationConfig: {
//                 maxOutputTokens: maxTokens,
//                 temperature,
//                 topP: 0.9,
//                 topK: 10,
//             },
//             safetySettings: [
//                 { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
//                 { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
//                 { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
//                 { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
//             ],
//         });

//         const reqOptions = {
//             hostname: 'generativelanguage.googleapis.com',
//             port: 443,
//             path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Content-Length': Buffer.byteLength(requestBody),
//             },
//         };

//         const req = https.request(reqOptions, (res) => {
//             let raw = '';
//             res.on('data', (chunk) => { raw += chunk; });
//             res.on('end', () => {
//                 try {
//                     const json = JSON.parse(raw);

//                     if (json.error) {
//                         return reject(new Error(`Gemini API error: ${json.error.message}`));
//                     }
//                     if (!json.candidates || json.candidates.length === 0) {
//                         return reject(new Error('Gemini returned no candidates — content may have been blocked'));
//                     }

//                     const text = json.candidates[0]?.content?.parts?.[0]?.text;
//                     if (!text) {
//                         return reject(new Error('Gemini candidate has no text content'));
//                     }

//                     resolve(text);
//                 } catch (e) {
//                     reject(new Error(`Failed to parse Gemini response: ${e.message}`));
//                 }
//             });
//         });

//         req.on('error', (e) => reject(new Error(`HTTPS request error: ${e.message}`)));
//         req.on('timeout', () => { req.destroy(); reject(new Error('Gemini request timed out after 90s')); });

//         req.setTimeout(90000); // 90s — itinerary JSON can be large
//         req.write(requestBody);
//         req.end();
//     });
// }

// // ─── JSON EXTRACTOR (same multi-strategy approach as your working code) ───────
// function extractJSON(text) {
//     // Strategy 1: markdown code fence  ```json ... ```
//     const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i)
//         || text.match(/```\s*([\s\S]*?)\s*```/i);
//     if (fenceMatch) {
//         try { return JSON.parse(fenceMatch[1].trim()); } catch (_) { }
//     }

//     // Strategy 2: direct parse
//     try { return JSON.parse(text.trim()); } catch (_) { }

//     // Strategy 3: first { to last }
//     const first = text.indexOf('{');
//     const last = text.lastIndexOf('}');
//     if (first !== -1 && last > first) {
//         try { return JSON.parse(text.substring(first, last + 1)); } catch (_) { }
//     }

//     // Strategy 4: fix common issues then parse
//     let fixed = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
//     const jsonChunk = fixed.match(/\{[\s\S]*\}/);
//     if (jsonChunk) {
//         try {
//             fixed = jsonChunk[0]
//                 .replace(/,\s*}/g, '}')
//                 .replace(/,\s*]/g, ']');
//             return JSON.parse(fixed);
//         } catch (_) { }
//     }

//     throw new Error('Could not extract valid JSON from Gemini response after 4 strategies');
// }

// // ─── SYSTEM + USER PROMPT BUILDER ────────────────────────────────────────────
// const SYSTEM_INSTRUCTION = `You are an expert motorcycle trip planner for Indian roads with encyclopedic knowledge of:
// - Real GPS coordinates (lat/lng) for Indian cities, towns, villages, passes, and landmarks
// - Fuel stations by name and location: Indian Oil, BPCL, HPCL, HP petrol pumps
// - Roadside mechanics: puncture shops, Royal Enfield service centres, local bike garages
// - Biker dhabas, highway cafes, resort restaurants, and local eateries
// - All terrain types: mountain passes, coastal highways, forest roads, expressways, village tracks
// - Road conditions, permits, altitude hazards, seasonal closures
// - Group and solo riding protocols for Indian roads

// ABSOLUTE RULES:
// 1. Return ONLY valid JSON — no markdown, no explanation, no code fences
// 2. Every stop MUST have exact real lat/lng (real Indian GPS coordinates)
// 3. Round trip MUST be balanced: forwardDays === returnDays (differ by max 1 for odd totals)
// 4. Fuel stations are NON-NEGOTIABLE every 100-150 km on remote routes
// 5. Each style must produce a DIFFERENT route — not just different labels
// 6. Start response with { and end with }`;

// const buildPrompt = (params, style) => {
//     const styleConfig = TRIP_STYLES[style];
//     const {
//         source, destination, numberOfDays, tripType, bikeType,
//         bikeModel, engineCC, fuelTankCapacity, startDate, groupDetails,
//     } = params;

//     const forwardDays = Math.ceil(numberOfDays / 2);
//     const returnDays = Math.floor(numberOfDays / 2);
//     const restDay = numberOfDays > 5 ? 1 : 0;

//     return `${SYSTEM_INSTRUCTION}

// ---

// Plan a ${styleConfig.label.toUpperCase()} motorcycle trip from ${source} to ${destination}.

// TRIP STYLE: ${styleConfig.id.toUpperCase()} — "${styleConfig.tagline}"
// STYLE PHILOSOPHY: ${styleConfig.description}

// ROUTING RULES FOR THIS STYLE:
// ${styleConfig.routingBias.map((r, i) => `${i + 1}. ${r}`).join('\n')}

// STOP SELECTION RULES:
// ${styleConfig.stopBias.map((r, i) => `${i + 1}. ${r}`).join('\n')}

// TRIP PARAMETERS:
// - Source: ${source}
// - Destination: ${destination}
// - Total Days: ${numberOfDays} (Forward: ${forwardDays} days | Return: ${returnDays} days)
// - Riders: ${tripType === 'group' ? `Group of ${groupDetails?.totalRiders || 5}` : 'Solo rider'}
// - Bike: ${bikeModel || bikeType} ${engineCC ? `(${engineCC}cc)` : ''}
// - Fuel Tank: ${fuelTankCapacity || 15}L
// - Start Date: ${startDate || 'Flexible'}
// - Departure time: ${styleConfig.departureTime}

// Return EXACTLY this JSON structure (no other text, start with {):

// {
//   "styleId": "${style}",
//   "styleLabel": "${styleConfig.label}",
//   "tagline": "${styleConfig.tagline}",
//   "routeSummary": {
//     "totalOneWayKm": 0,
//     "totalRoundTripKm": 0,
//     "averageForwardDailyKm": 0,
//     "averageReturnDailyKm": 0,
//     "estimatedFuelLitres": 0,
//     "estimatedFuelCostINR": 0,
//     "estimatedTollCostINR": 0,
//     "estimatedTotalBudgetINR": 0,
//     "difficultyRating": "Moderate",
//     "terrainType": "describe terrain",
//     "sourceCoordinates": { "lat": 0.0, "lng": 0.0 },
//     "destinationCoordinates": { "lat": 0.0, "lng": 0.0 }
//   },
//   "dayPlans": [
//     {
//       "dayNumber": 1,
//       "phase": "forward",
//       "date": "${startDate || 'Day 1'}",
//       "startLocation": "city name",
//       "startCoordinates": { "lat": 0.0, "lng": 0.0 },
//       "endLocation": "city name",
//       "endCoordinates": { "lat": 0.0, "lng": 0.0 },
//       "totalDistanceKm": 0,
//       "estimatedRidingTimeHours": 0,
//       "recommendedDepartureTime": "${styleConfig.departureTime}",
//       "estimatedArrivalTime": "HH:MM AM/PM",
//       "roadCondition": "description",
//       "altitudeRange": "Xm - Ym",
//       "weatherAdvisory": "advice",
//       "highlights": ["highlight1", "highlight2"],
//       "vibeOfTheDay": "one sentence vibe",
//       "stops": [
//         {
//           "stopNumber": 1,
//           "name": "real place name",
//           "coordinates": { "lat": 0.0, "lng": 0.0 },
//           "type": "start",
//           "distanceFromPrevKm": 0,
//           "estimatedArrival": "time",
//           "estimatedDeparture": "time",
//           "durationMinutes": 0,
//           "description": "description",
//           "whyThisStop": "reason",
//           "facilities": ["Petrol", "Food"],
//           "fuelAvailable": false,
//           "mechanicAvailable": false,
//           "foodAvailable": false,
//           "bikerFriendly": true,
//           "mapPinColor": "darkgreen"
//         }
//       ],
//       "dayNotes": ["note1", "note2"],
//       "emergencyContacts": {
//         "nearestHospital": "name and distance",
//         "policeStation": "local station",
//         "bikeRescueNumber": "helpline"
//       }
//     }
//   ],
//   "recommendations": [
//     {
//       "name": "place name",
//       "type": "adventure",
//       "coordinates": { "lat": 0.0, "lng": 0.0 },
//       "region": "state",
//       "description": "description",
//       "whyBikersLoveIt": "reason",
//       "bestTimeToVisit": "months",
//       "difficultyLevel": "moderate",
//       "suitableForBikeType": ["${bikeType}"],
//       "nearbyFuelStation": true,
//       "nearbyMechanic": false,
//       "permitRequired": false,
//       "estimatedDetourKm": 0,
//       "tags": ["tag1", "tag2"]
//     }
//   ],
//   "criticalFuelStops": [
//     {
//       "name": "pump name",
//       "location": "town",
//       "coordinates": { "lat": 0.0, "lng": 0.0 },
//       "distanceFromSourceKm": 0,
//       "note": "critical note"
//     }
//   ],
//   "emergencyMechanics": [
//     {
//       "name": "shop name",
//       "location": "town",
//       "coordinates": { "lat": 0.0, "lng": 0.0 },
//       "services": ["puncture repair"],
//       "bikesBest": ["Royal Enfield"],
//       "typicalWaitTime": "30 min"
//     }
//   ],
//   "ridingTips": ["tip1", "tip2"],
//   "packingChecklist": ["item1", "item2"],
//   "overnightStays": [
//     {
//       "location": "town",
//       "coordinates": { "lat": 0.0, "lng": 0.0 },
//       "dayNumber": 1,
//       "recommendedAccommodation": "hotel name",
//       "priceRangeINR": "800-1200",
//       "bikerFacilities": ["parking"],
//       "bookingAdvice": "book in advance"
//     }
//   ],
//   "mapPolyline": {
//     "forward": [{ "lat": 0.0, "lng": 0.0, "label": "location" }],
//     "return":  [{ "lat": 0.0, "lng": 0.0, "label": "location" }]
//   }
// }

// CRITICAL: dayPlans must have EXACTLY ${numberOfDays} entries.
// CRITICAL: Days 1-${forwardDays} → "phase":"forward". Days ${forwardDays + 1}-${numberOfDays} → "phase":"return".
// ${restDay ? `CRITICAL: Day ${forwardDays} → "phase":"rest_at_destination", totalDistanceKm:0.` : ''}
// CRITICAL: Return route must use ALTERNATE roads.
// CRITICAL: Replace all 0.0 values with REAL Indian GPS coordinates.`;
// };

// // ─── VALIDATE PARSED PLAN ─────────────────────────────────────────────────────
// const validatePlan = (plan, style) => {
//     if (!plan.dayPlans || !Array.isArray(plan.dayPlans)) {
//         throw new Error(`[${style}] Missing dayPlans array`);
//     }
//     if (!plan.routeSummary) {
//         throw new Error(`[${style}] Missing routeSummary`);
//     }
//     plan.dayPlans.forEach((day, di) => {
//         if (!Array.isArray(day.stops)) {
//             throw new Error(`[${style}] Day ${di + 1} missing stops array`);
//         }
//         day.stops.forEach((stop, si) => {
//             if (typeof stop.coordinates?.lat !== 'number' || typeof stop.coordinates?.lng !== 'number') {
//                 throw new Error(`[${style}] Day ${di + 1} stop ${si + 1} "${stop.name}" has invalid coordinates`);
//             }
//         });
//     });
// };

// // ─── GENERATE ONE STYLE (with retry) ─────────────────────────────────────────
// const generateSingleStyle = async (params, style) => {
//     const maxAttempts = 3;

//     for (let attempt = 1; attempt <= maxAttempts; attempt++) {
//         try {
//             console.log(`🤖 [${style.toUpperCase()}] Attempt ${attempt}/${maxAttempts}...`);

//             const prompt = buildPrompt(params, style);
//             const rawText = await callGemini(prompt, {
//                 maxTokens: 8192,
//                 temperature: 0.2 + (attempt - 1) * 0.1, // slightly higher temp on retries
//             });

//             const parsed = extractJSON(rawText);
//             validatePlan(parsed, style);

//             console.log(`✅ [${style.toUpperCase()}] Generated successfully on attempt ${attempt}`);
//             return parsed;

//         } catch (err) {
//             console.warn(`⚠️  [${style.toUpperCase()}] Attempt ${attempt} failed: ${err.message}`);
//             if (attempt < maxAttempts) {
//                 await new Promise((r) => setTimeout(r, 2000 * attempt)); // backoff: 2s, 4s
//             } else {
//                 throw err;
//             }
//         }
//     }
// };

// // ─── GENERATE ALL 3 IN PARALLEL ──────────────────────────────────────────────
// const generateAllItineraries = async (params) => {
//     const styles = ['adventure', 'cruise', 'relax'];
//     const results = {};
//     const errors = {};

//     const settled = await Promise.allSettled(
//         styles.map((style) => generateSingleStyle(params, style))
//     );

//     settled.forEach((result, i) => {
//         const style = styles[i];
//         if (result.status === 'fulfilled') {
//             results[style] = result.value;
//         } else {
//             errors[style] = result.reason?.message || 'Unknown error';
//             console.error(`❌ [${style.toUpperCase()}] All attempts failed: ${errors[style]}`);
//         }
//     });

//     const successCount = Object.keys(results).length;
//     if (successCount === 0) {
//         throw new Error('All 3 itinerary generations failed. Check GEMINI_API_KEY and quota.');
//     }

//     return { results, errors, successCount };
// };

// // ─── ENRICH PLAN WITH MAP DATA ────────────────────────────────────────────────
// const enrichPlan = (aiPlan, style) => {
//     const styleConfig = TRIP_STYLES[style];

//     aiPlan.dayPlans = aiPlan.dayPlans.map((day) => ({
//         ...day,
//         stops: day.stops.map((stop) => ({
//             ...stop,
//             mapPinColor: stop.mapPinColor || getPinColor(stop.type, style),
//             coordinates: {
//                 lat: Number(Number(stop.coordinates.lat).toFixed(6)),
//                 lng: Number(Number(stop.coordinates.lng).toFixed(6)),
//             },
//         })),
//     }));

//     const mapPins = [];
//     aiPlan.dayPlans.forEach((day) => {
//         day.stops.forEach((stop) => {
//             mapPins.push({
//                 name: stop.name,
//                 type: stop.type,
//                 lat: stop.coordinates.lat,
//                 lng: stop.coordinates.lng,
//                 color: stop.mapPinColor,
//                 dayNumber: day.dayNumber,
//                 phase: day.phase,
//                 description: stop.description,
//                 whyThisStop: stop.whyThisStop,
//                 facilities: stop.facilities || [],
//                 fuelAvailable: stop.fuelAvailable || false,
//                 mechanicAvailable: stop.mechanicAvailable || false,
//                 foodAvailable: stop.foodAvailable || false,
//                 bikerFriendly: stop.bikerFriendly || false,
//             });
//         });
//     });

//     const geoFeatures = [];

//     mapPins.forEach((pin) => {
//         geoFeatures.push({
//             type: 'Feature',
//             geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
//             properties: {
//                 name: pin.name,
//                 stopType: pin.type,
//                 dayNumber: pin.dayNumber,
//                 phase: pin.phase,
//                 description: pin.description,
//                 whyThisStop: pin.whyThisStop,
//                 facilities: pin.facilities,
//                 fuelAvailable: pin.fuelAvailable,
//                 mechanicAvailable: pin.mechanicAvailable,
//                 foodAvailable: pin.foodAvailable,
//                 bikerFriendly: pin.bikerFriendly,
//                 mapPinColor: pin.color,
//                 style,
//             },
//         });
//     });

//     if (aiPlan.mapPolyline?.forward?.length > 1) {
//         geoFeatures.push({
//             type: 'Feature',
//             geometry: {
//                 type: 'LineString',
//                 coordinates: aiPlan.mapPolyline.forward.map((p) => [p.lng, p.lat]),
//             },
//             properties: {
//                 routePhase: 'forward',
//                 style,
//                 strokeColor: styleConfig.palette.routeColor,
//                 strokeWidth: 3,
//                 label: `${styleConfig.label} — Forward Route`,
//             },
//         });
//     }

//     if (aiPlan.mapPolyline?.return?.length > 1) {
//         geoFeatures.push({
//             type: 'Feature',
//             geometry: {
//                 type: 'LineString',
//                 coordinates: aiPlan.mapPolyline.return.map((p) => [p.lng, p.lat]),
//             },
//             properties: {
//                 routePhase: 'return',
//                 style,
//                 strokeColor: styleConfig.palette.primary,
//                 strokeWidth: 2,
//                 strokeDasharray: '5,5',
//                 label: `${styleConfig.label} — Return Route`,
//             },
//         });
//     }

//     (aiPlan.criticalFuelStops || []).forEach((fs) => {
//         geoFeatures.push({
//             type: 'Feature',
//             geometry: { type: 'Point', coordinates: [fs.coordinates.lng, fs.coordinates.lat] },
//             properties: { name: fs.name, stopType: 'critical_fuel', note: fs.note, mapPinColor: 'red', style },
//         });
//     });

//     (aiPlan.recommendations || []).forEach((rec) => {
//         geoFeatures.push({
//             type: 'Feature',
//             geometry: { type: 'Point', coordinates: [rec.coordinates.lng, rec.coordinates.lat] },
//             properties: {
//                 name: rec.name,
//                 stopType: 'recommendation',
//                 type: rec.type,
//                 description: rec.description,
//                 difficultyLevel: rec.difficultyLevel,
//                 tags: rec.tags,
//                 mapPinColor: 'gold',
//                 style,
//             },
//         });
//     });

//     return {
//         ...aiPlan,
//         style,
//         styleLabel: styleConfig.label,
//         styleEmoji: styleConfig.emoji,
//         palette: styleConfig.palette,
//         aiProvider: `Google Gemini (${GEMINI_MODEL}) via HTTPS`,
//         mapPins,
//         geoJSON: {
//             type: 'FeatureCollection',
//             features: geoFeatures,
//             metadata: {
//                 style,
//                 totalPins: mapPins.length,
//                 forwardPoints: aiPlan.mapPolyline?.forward?.length || 0,
//                 returnPoints: aiPlan.mapPolyline?.return?.length || 0,
//             },
//         },
//     };
// };

// module.exports = { generateAllItineraries, enrichPlan, TRIP_STYLES };

/**
 * aiTripService.js
 * Generates 3 itinerary VARIANTS of the same style based on bikeType.
 *
 *   adventure / dirt_bike  → 3 adventure variants (easy, moderate, extreme)
 *   cruiser / touring / sports / naked → 3 cruise variants (scenic, express, coastal)
 *   scooter                → 3 relax variants (countryside, heritage, nature)
 */

/**
 * aiTripService.js
 * Generates 3 itinerary VARIANTS of the same style based on bikeType.
 *
 *   adventure / dirt_bike  → 3 adventure variants (easy, moderate, extreme)
 *   cruiser / touring / sports / naked → 3 cruise variants (scenic, express, coastal)
 *   scooter                → 3 relax variants (countryside, heritage, nature)
 */

const https = require('https');
const {
    getPinColor,
    getStyleFromBikeType,
    getVariantsForStyle,
    TRIP_STYLES,
} = require('../config/tripStyles');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-flash-latest';

// ─── CORE HTTPS CALLER ────────────────────────────────────────────────────────
function callGemini(prompt, temperature) {
    temperature = temperature || 0.1;

    return new Promise(function (resolve, reject) {
        if (!GEMINI_API_KEY) {
            return reject(new Error('GEMINI_API_KEY is not set in .env'));
        }

        var bodyObj = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 16384,
                temperature: temperature,
                topP: 0.9,
                topK: 10,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
        };

        var body = JSON.stringify(bodyObj);

        var options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: '/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        var req = https.request(options, function (res) {
            var raw = '';
            res.on('data', function (chunk) { raw += chunk; });
            res.on('end', function () {
                try {
                    var parsed = JSON.parse(raw);

                    var finishReason = parsed.candidates && parsed.candidates[0] && parsed.candidates[0].finishReason;
                    console.log('   Gemini finishReason:', finishReason || 'unknown');
                    if (finishReason === 'MAX_TOKENS') {
                        console.warn('   ⚠️  MAX_TOKENS hit — response was truncated! JSON will be incomplete.');
                    }

                    if (parsed.error) {
                        return reject(new Error('Gemini API error: ' + parsed.error.message));
                    }
                    if (!parsed.candidates || parsed.candidates.length === 0) {
                        console.log('   Full response:', raw.substring(0, 500));
                        return reject(new Error('Gemini: no candidates returned'));
                    }

                    var text = parsed.candidates[0].content &&
                        parsed.candidates[0].content.parts &&
                        parsed.candidates[0].content.parts[0] &&
                        parsed.candidates[0].content.parts[0].text;

                    if (!text) {
                        return reject(new Error('Gemini: empty text in candidate'));
                    }

                    console.log('   Response length:', text.length, 'chars');
                    console.log('   Response start:', text.substring(0, 120).replace(/\n/g, ' '));

                    resolve(text);
                } catch (e) {
                    console.log('   RAW HTTP body:', raw.substring(0, 500));
                    reject(new Error('Failed to parse Gemini response: ' + e.message));
                }
            });
        });

        req.on('error', function (e) { reject(new Error('HTTPS error: ' + e.message)); });
        req.on('timeout', function () { req.destroy(); reject(new Error('Gemini timed out after 90s')); });
        req.setTimeout(90000);
        req.write(body);
        req.end();
    });
}

// ─── JSON EXTRACTOR ───────────────────────────────────────────────────────────
// Strips // line comments and /* block comments */ that Gemini sometimes adds
function stripJSONComments(str) {
    var result = '';
    var inString = false;
    var i = 0;
    while (i < str.length) {
        var ch = str[i];
        if (inString) {
            if (ch === '\\') { result += ch + str[i + 1]; i += 2; continue; }
            if (ch === '"') inString = false;
            result += ch; i++; continue;
        }
        if (ch === '"') { inString = true; result += ch; i++; continue; }
        // // line comment
        if (ch === '/' && str[i + 1] === '/') {
            while (i < str.length && str[i] !== '\n') i++;
            continue;
        }
        // /* block comment */
        if (ch === '/' && str[i + 1] === '*') {
            i += 2;
            while (i < str.length && !(str[i] === '*' && str[i + 1] === '/')) i++;
            i += 2; continue;
        }
        result += ch; i++;
    }
    return result;
}

// Attempt to close a truncated JSON by counting unclosed brackets
function repairTruncated(str) {
    var stack = [];
    var inString = false;
    for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (inString) {
            if (ch === '\\') { i++; continue; }
            if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{' || ch === '[') stack.push(ch);
        if (ch === '}' || ch === ']') stack.pop();
    }
    if (stack.length === 0) return str; // not truncated
    // Remove trailing comma before we close
    var closing = str.replace(/,\s*$/, '');
    for (var j = stack.length - 1; j >= 0; j--) {
        closing += stack[j] === '{' ? '}' : ']';
    }
    console.log('   Repaired truncated JSON: closed', stack.length, 'unclosed brackets');
    return closing;
}

function extractJSON(text) {
    console.log('   Extracting JSON from', text.length, 'chars...');

    // Strategy 1: ```json fence (indexOf — safe for large strings)
    var fenceStart = text.indexOf('```json');
    if (fenceStart !== -1) {
        var contentStart = text.indexOf('\n', fenceStart) + 1;
        var fenceEnd = text.indexOf('```', contentStart);
        if (fenceEnd !== -1) {
            try {
                var r1 = JSON.parse(text.substring(contentStart, fenceEnd).trim());
                console.log('   Extracted via ```json fence');
                return r1;
            } catch (e) { console.log('   Strategy 1 failed:', e.message.substring(0, 80)); }
        }
    }

    // Strategy 2: plain ``` fence
    var fence2 = text.indexOf('```');
    if (fence2 !== -1) {
        var c2s = text.indexOf('\n', fence2) + 1;
        var c2e = text.indexOf('```', c2s);
        if (c2e !== -1) {
            try {
                var r2 = JSON.parse(text.substring(c2s, c2e).trim());
                console.log('   Extracted via ``` fence');
                return r2;
            } catch (e) { console.log('   Strategy 2 failed:', e.message.substring(0, 80)); }
        }
    }

    // Strategy 3: direct parse
    try {
        var r3 = JSON.parse(text.trim());
        console.log('   Extracted via direct parse');
        return r3;
    } catch (e) { console.log('   Strategy 3 failed:', e.message.substring(0, 80)); }

    // Strategy 4: first { to last }
    var a = text.indexOf('{');
    var b = text.lastIndexOf('}');
    if (a !== -1 && b > a) {
        try {
            var r4 = JSON.parse(text.substring(a, b + 1));
            console.log('   Extracted via {..} slice');
            return r4;
        } catch (e) { console.log('   Strategy 4 failed:', e.message.substring(0, 80)); }
    }

    // Strategy 5: fix trailing commas
    if (a !== -1 && b > a) {
        try {
            var fixed = text.substring(a, b + 1).replace(/,(\s*[}\]])/g, '$1');
            var r5 = JSON.parse(fixed);
            console.log('   Extracted via comma-fix');
            return r5;
        } catch (e) { console.log('   Strategy 5 failed:', e.message.substring(0, 80)); }
    }

    // Strategy 6: strip // and /* */ comments then parse
    if (a !== -1 && b > a) {
        try {
            var stripped = stripJSONComments(text.substring(a, b + 1));
            var r6 = JSON.parse(stripped);
            console.log('   Extracted via comment-strip');
            return r6;
        } catch (e) { console.log('   Strategy 6 failed:', e.message.substring(0, 80)); }
    }

    // Strategy 7: repair truncated JSON (MAX_TOKENS cut it off mid-object)
    if (a !== -1) {
        try {
            var chunk = text.substring(a);
            var repaired = repairTruncated(chunk);
            repaired = repaired.replace(/,(\s*[}\]])/g, '$1'); // also fix trailing commas
            var r7 = JSON.parse(repaired);
            console.log('   Extracted via truncation-repair');
            return r7;
        } catch (e) { console.log('   Strategy 7 failed:', e.message.substring(0, 80)); }
    }

    console.log('\n══════ FULL GEMINI RESPONSE (debug) ══════');
    console.log(text);
    console.log('══════════════════════════════════════════\n');
    throw new Error('Could not extract JSON from Gemini response (' + text.length + ' chars)');
}

// ─── BUILD PROMPT FOR ONE VARIANT ─────────────────────────────────────────────
// KEY DESIGN: Compact text prompt + ONE example day only.
// Full N-day templates cause Gemini to refuse (~20KB prompts). Keep under 3KB.
function buildPrompt(params, variant) {
    var src = params.source;
    var dst = params.destination;
    var days = params.numberOfDays;
    var fwd = Math.ceil(days / 2);
    var ret = Math.floor(days / 2);
    var bike = params.bikeModel || params.bikeType;
    var tank = params.fuelTankCapacity || 15;
    var riders = params.tripType === 'group'
        ? 'group of ' + ((params.groupDetails && params.groupDetails.totalRiders) || 5)
        : 'solo';
    var date = params.startDate || 'Day 1';
    var rest = days > 5 ? '\n- Day ' + fwd + ': phase="rest_at_destination", totalDistanceKm=0, no riding' : '';

    // Only first 3 routing rules to keep prompt small
    var routing = variant.routingBias.slice(0, 3).join(' | ');
    var stops = variant.stopBias.slice(0, 2).join(' | ');

    // One compact example stop (not a full day — just the stop shape)
    var exampleStop = JSON.stringify({
        stopNumber: 1, name: "Actual Place Name",
        coordinates: { lat: 28.7041, lng: 77.1025 },
        type: "fuel_station",
        distanceFromPrevKm: 85,
        estimatedArrival: "09:30 AM", estimatedDeparture: "09:45 AM",
        durationMinutes: 15,
        description: "Brief description",
        whyThisStop: "Reason for stop",
        facilities: ["Petrol", "Toilet"],
        fuelAvailable: true, mechanicAvailable: false,
        foodAvailable: false, bikerFriendly: true,
        mapPinColor: "red"
    });

    return (
        'You are an expert Indian motorcycle trip planner.\n' +
        'OUTPUT: Valid JSON only. No markdown. No explanation. No ``` fences. Start directly with {.\n\n' +
        'TRIP:\n' +
        '  Style: ' + variant.variantLabel + ' (' + variant.difficulty + ') — ' + variant.tagline + '\n' +
        '  Route: ' + src + ' → ' + dst + '\n' +
        '  Days: ' + days + ' total (' + fwd + ' forward, ' + ret + ' return)\n' +
        '  Bike: ' + bike + ', tank=' + tank + 'L, riders=' + riders + ', start=' + date + '\n' +
        '  Routing: ' + routing + '\n' +
        '  Stops: ' + stops + '\n\n' +
        'REQUIRED JSON SHAPE (generate ALL ' + days + ' days):\n' +
        '{\n' +
        '  "variantId": "' + variant.variantId + '",\n' +
        '  "variantLabel": "' + variant.variantLabel + '",\n' +
        '  "difficulty": "' + variant.difficulty + '",\n' +
        '  "tagline": "string",\n' +
        '  "routeSummary": {\n' +
        '    "totalOneWayKm": 0, "totalRoundTripKm": 0,\n' +
        '    "averageForwardDailyKm": 0, "averageReturnDailyKm": 0,\n' +
        '    "estimatedFuelLitres": 0, "estimatedFuelCostINR": 0,\n' +
        '    "estimatedTollCostINR": 0, "estimatedTotalBudgetINR": 0,\n' +
        '    "difficultyRating": "string", "terrainType": "string",\n' +
        '    "sourceCoordinates": {"lat": 0.0, "lng": 0.0},\n' +
        '    "destinationCoordinates": {"lat": 0.0, "lng": 0.0}\n' +
        '  },\n' +
        '  "dayPlans": [\n' +
        '    {\n' +
        '      "dayNumber": 1, "phase": "forward", "date": "' + date + '",\n' +
        '      "startLocation": "string", "startCoordinates": {"lat": 0.0, "lng": 0.0},\n' +
        '      "endLocation": "string", "endCoordinates": {"lat": 0.0, "lng": 0.0},\n' +
        '      "totalDistanceKm": 0, "estimatedRidingTimeHours": 0,\n' +
        '      "recommendedDepartureTime": "' + variant.departureTime + '",\n' +
        '      "estimatedArrivalTime": "string",\n' +
        '      "roadCondition": "string", "altitudeRange": "string", "weatherAdvisory": "string",\n' +
        '      "highlights": ["string"], "vibeOfTheDay": "string",\n' +
        '      "stops": [STOP_EXAMPLE],\n' +
        '      "dayNotes": ["string"],\n' +
        '      "emergencyContacts": {"nearestHospital":"string","policeStation":"string","bikeRescueNumber":"string"}\n' +
        '    },\n' +
        '    "... repeat for all ' + days + ' days ..."\n' +
        '  ],\n' +
        '  "recommendations": [{"name":"string","type":"string","coordinates":{"lat":0.0,"lng":0.0},"region":"string","description":"string","whyBikersLoveIt":"string","bestTimeToVisit":"string","difficultyLevel":"string","suitableForBikeType":["string"],"nearbyFuelStation":true,"nearbyMechanic":false,"permitRequired":false,"estimatedDetourKm":0,"tags":["string"]}],\n' +
        '  "criticalFuelStops": [{"name":"string","location":"string","coordinates":{"lat":0.0,"lng":0.0},"distanceFromSourceKm":0,"note":"string"}],\n' +
        '  "emergencyMechanics": [{"name":"string","location":"string","coordinates":{"lat":0.0,"lng":0.0},"services":["string"],"bikesBest":["string"],"typicalWaitTime":"string"}],\n' +
        '  "ridingTips": ["tip1","tip2","tip3","tip4","tip5"],\n' +
        '  "packingChecklist": ["item1","item2","item3","item4","item5"],\n' +
        '  "overnightStays": [{"location":"string","coordinates":{"lat":0.0,"lng":0.0},"dayNumber":1,"recommendedAccommodation":"string","priceRangeINR":"string","bikerFacilities":["string"],"bookingAdvice":"string"}],\n' +
        '  "mapPolyline": {\n' +
        '    "forward": [{"lat":0.0,"lng":0.0,"label":"' + src + '"},{"lat":0.0,"lng":0.0,"label":"' + dst + '"}],\n' +
        '    "return":  [{"lat":0.0,"lng":0.0,"label":"' + dst + '"},{"lat":0.0,"lng":0.0,"label":"' + src + '"}]\n' +
        '  }\n' +
        '}\n\n' +
        'Each stop must follow this shape:\n' + exampleStop + '\n\n' +
        'RULES (strictly follow):\n' +
        '1. dayPlans must have EXACTLY ' + days + ' objects\n' +
        '2. Days 1-' + fwd + ': phase="forward" | Days ' + (fwd + 1) + '-' + days + ': phase="return"' + rest + '\n' +
        '3. Every lat/lng = real Indian GPS decimal. NEVER use 0.0\n' +
        '4. Each day needs at minimum: 1 start stop + 1 fuel_station + 1 overnight stop\n' +
        '5. Return route uses DIFFERENT roads than forward\n' +
        '6. 2-4 recommendations, 2-3 criticalFuelStops, 2-3 emergencyMechanics\n' +
        '7. Replace "... repeat for all X days ..." with actual day objects\n' +
        '8. Output ONLY the JSON object. No text before or after.'
    );
}

// ─── VALIDATE ─────────────────────────────────────────────────────────────────
function validatePlan(plan, variantId) {
    if (!plan.dayPlans || !Array.isArray(plan.dayPlans) || plan.dayPlans.length === 0) {
        throw new Error('[' + variantId + '] Missing or empty dayPlans');
    }
    if (!plan.routeSummary) {
        throw new Error('[' + variantId + '] Missing routeSummary');
    }
    plan.dayPlans.forEach(function (day, di) {
        if (!Array.isArray(day.stops)) {
            throw new Error('[' + variantId + '] Day ' + (di + 1) + ' missing stops');
        }
        day.stops.forEach(function (stop, si) {
            var lat = stop.coordinates && stop.coordinates.lat;
            var lng = stop.coordinates && stop.coordinates.lng;
            if (typeof lat !== 'number' || typeof lng !== 'number') {
                throw new Error('[' + variantId + '] Day ' + (di + 1) + ' stop ' + (si + 1) + ' "' + stop.name + '" has invalid coords');
            }
        });
    });
}

// ─── GENERATE ONE VARIANT (with retry) ───────────────────────────────────────
async function generateSingleVariant(params, variant) {
    var maxAttempts = 3;

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log('\n🤖 [' + variant.variantId.toUpperCase() + '] Attempt ' + attempt + '/' + maxAttempts);
            var temp = 0.1 + (attempt - 1) * 0.1;
            var prompt = buildPrompt(params, variant);
            console.log('   Prompt length:', prompt.length, 'chars');

            var rawText = await callGemini(prompt, temp);
            var parsed = extractJSON(rawText);

            validatePlan(parsed, variant.variantId);

            // Stamp variant metadata onto parsed plan
            parsed.variantId = variant.variantId;
            parsed.variantLabel = variant.variantLabel;
            parsed.difficulty = variant.difficulty;
            parsed.palette = variant.palette;
            parsed.emoji = variant.emoji;

            console.log('✅ [' + variant.variantId.toUpperCase() + '] Done — ' + parsed.dayPlans.length + ' days');
            return parsed;

        } catch (err) {
            console.warn('⚠️  [' + variant.variantId.toUpperCase() + '] Attempt ' + attempt + ' failed: ' + err.message);
            if (attempt < maxAttempts) {
                await new Promise(function (r) { setTimeout(r, 2000 * attempt); });
            } else {
                throw err;
            }
        }
    }
}

// ─── GENERATE ALL 3 VARIANTS IN PARALLEL ─────────────────────────────────────
async function generateAllItineraries(params) {
    // Determine style from bikeType
    var style = getStyleFromBikeType(params.bikeType);
    var variants = getVariantsForStyle(style);

    console.log('\n🏍️  BikeType "' + params.bikeType + '" → Style: ' + style.toUpperCase());
    console.log('   Generating 3 variants: ' + variants.map(function (v) { return v.variantId; }).join(', ') + '\n');

    var results = {};
    var errors = {};

    var settled = await Promise.allSettled(
        variants.map(function (variant) {
            return generateSingleVariant(params, variant);
        })
    );

    settled.forEach(function (result, i) {
        var variantId = variants[i].variantId;
        if (result.status === 'fulfilled') {
            results[variantId] = result.value;
        } else {
            errors[variantId] = result.reason ? result.reason.message : 'Unknown error';
            console.error('❌ [' + variantId.toUpperCase() + '] All attempts failed: ' + errors[variantId]);
        }
    });

    var successCount = Object.keys(results).length;
    if (successCount === 0) {
        throw new Error('All 3 variant generations failed. Check GEMINI_API_KEY and quota.');
    }

    return {
        style: style,
        variants: variants.map(function (v) { return v.variantId; }),
        results: results,
        errors: errors,
        successCount: successCount,
    };
}

// ─── ENRICH PLAN WITH MAP DATA ────────────────────────────────────────────────
function enrichPlan(aiPlan, style) {
    var sc = TRIP_STYLES[style];

    // Normalise coordinates + pin colors
    aiPlan.dayPlans = aiPlan.dayPlans.map(function (day) {
        return Object.assign({}, day, {
            stops: day.stops.map(function (stop) {
                return Object.assign({}, stop, {
                    mapPinColor: stop.mapPinColor || getPinColor(stop.type, style),
                    coordinates: {
                        lat: Number(Number(stop.coordinates.lat).toFixed(6)),
                        lng: Number(Number(stop.coordinates.lng).toFixed(6)),
                    },
                });
            }),
        });
    });

    // Flat mapPins array
    var mapPins = [];
    aiPlan.dayPlans.forEach(function (day) {
        day.stops.forEach(function (stop) {
            mapPins.push({
                name: stop.name,
                type: stop.type,
                lat: stop.coordinates.lat,
                lng: stop.coordinates.lng,
                color: stop.mapPinColor,
                dayNumber: day.dayNumber,
                phase: day.phase,
                description: stop.description,
                whyThisStop: stop.whyThisStop,
                facilities: stop.facilities || [],
                fuelAvailable: stop.fuelAvailable || false,
                mechanicAvailable: stop.mechanicAvailable || false,
                foodAvailable: stop.foodAvailable || false,
                bikerFriendly: stop.bikerFriendly || false,
            });
        });
    });

    // GeoJSON
    var features = [];

    mapPins.forEach(function (pin) {
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
            properties: Object.assign({}, pin, { style: style }),
        });
    });

    var palette = aiPlan.palette || (sc && sc.palette) || {};

    if (aiPlan.mapPolyline && aiPlan.mapPolyline.forward && aiPlan.mapPolyline.forward.length > 1) {
        features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: aiPlan.mapPolyline.forward.map(function (p) { return [p.lng, p.lat]; }) },
            properties: { routePhase: 'forward', style: style, strokeColor: palette.routeColor, strokeWidth: 3 },
        });
    }

    if (aiPlan.mapPolyline && aiPlan.mapPolyline.return && aiPlan.mapPolyline.return.length > 1) {
        features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: aiPlan.mapPolyline.return.map(function (p) { return [p.lng, p.lat]; }) },
            properties: { routePhase: 'return', style: style, strokeColor: palette.primary, strokeWidth: 2 },
        });
    }

    (aiPlan.criticalFuelStops || []).forEach(function (fs) {
        if (fs.coordinates && fs.coordinates.lat) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [fs.coordinates.lng, fs.coordinates.lat] },
                properties: { name: fs.name, stopType: 'critical_fuel', note: fs.note, mapPinColor: 'red', style: style },
            });
        }
    });

    (aiPlan.recommendations || []).forEach(function (rec) {
        if (rec.coordinates && rec.coordinates.lat) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [rec.coordinates.lng, rec.coordinates.lat] },
                properties: { name: rec.name, stopType: 'recommendation', mapPinColor: 'gold', style: style },
            });
        }
    });

    return Object.assign({}, aiPlan, {
        style: style,
        aiProvider: 'Google Gemini (' + GEMINI_MODEL + ')',
        mapPins: mapPins,
        geoJSON: {
            type: 'FeatureCollection',
            features: features,
            metadata: { style: style, variantId: aiPlan.variantId, totalPins: mapPins.length },
        },
    });
}

module.exports = {
    generateAllItineraries: generateAllItineraries,
    enrichPlan: enrichPlan,
    getStyleFromBikeType: getStyleFromBikeType,
};