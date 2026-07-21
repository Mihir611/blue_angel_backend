const axios = require('axios');

/* -------------------------------------------------------------------------- */
/*  Nominatim rules (https://operations.osmfoundation.org/policies/nominatim) */
/*    1. Max 1 request per second                                             */
/*    2. Must send a valid User-Agent                                         */
/*    3. Must send Accept: application/json (otherwise returns XML)           */
/* -------------------------------------------------------------------------- */

const NOMINATIM_BASE  = 'https://nominatim.openstreetmap.org/search';
const RATE_LIMIT_MS   = 1200;   // 1.1 s between requests – safely under the 1/s cap
const REQUEST_TIMEOUT = 10000;  // 10 s per request
const MAX_RETRIES     = 23;      // total attempts per location

// ── In-process cache so repeated identical lookups skip the network ──────────
const coordCache = new Map();

// ── Serial queue: ensures only one Nominatim request is in-flight at a time ─
let lastRequestTime = 0;

async function rateLimitedDelay() {
    const now      = Date.now();
    const elapsed  = now - lastRequestTime;
    const waitTime = Math.max(0, RATE_LIMIT_MS - elapsed);
    if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
    lastRequestTime = Date.now();
}

/* -------------------------------------------------------------------------- */
/*  Core fetch (single attempt, no retry logic here)                          */
/* -------------------------------------------------------------------------- */
async function fetchCoordinates(query) {
    await rateLimitedDelay();

    const response = await axios.get(NOMINATIM_BASE, {
        params: {
            q:      query,
            format: 'json',
            limit:  1,
            addressdetails: 0
        },
        headers: {
            'User-Agent': 'Motonomad/1.0 (mihir17.udupa@gmail.com)',
            'Accept':     'application/json'   // ← prevents XML response
        },
        timeout: REQUEST_TIMEOUT,
        // Axios throws on non-2xx by default; we want to inspect the body on errors
        validateStatus: (status) => status < 500
    });

    // Guard: if response is not JSON (rate-limited HTML page etc.)
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('json')) {
        throw new Error(
            `Nominatim returned non-JSON (HTTP ${response.status}) for: "${query}". ` +
            `Content-Type: ${contentType}`
        );
    }

    const data = response.data;
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`Location not found: "${query}"`);
    }

    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)   // Nominatim returns "lon", not "lng"
    };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Get GPS coordinates for a location name using OpenStreetMap Nominatim.
 *
 * Handles:
 *  - Rate limiting  (sequential, 1.1 s gap)
 *  - In-process cache (same location in one run = 1 network call)
 *  - Retry with ", India" hint if the bare name returns no results
 *  - Strips parenthetical hints from location strings before querying
 *
 * @param {string} location - Human-readable location, e.g. "Agumbe" or "Bisle Ghat, Sakleshpur"
 * @returns {Promise<{lat: number, lng: number}>}
 */
async function getOpenStreetMapCoordinates(location) {
    if (!location || typeof location !== 'string') {
        throw new Error('Invalid location: must be a non-empty string');
    }

    // Normalise: trim + collapse whitespace + strip parentheticals
    const clean = location
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*\(.*?\)/g, '')
        .trim();

    // Cache hit
    if (coordCache.has(clean)) {
        return coordCache.get(clean);
    }

    let lastError;

    // Attempt 1: clean name as-is
    try {
        const coords = await fetchCoordinates(clean);
        coordCache.set(clean, coords);
        return coords;
    } catch (err) {
        lastError = err;
        console.warn(`⚠️  Geocode attempt 1 failed for "${clean}": ${err.message}`);
    }

    // Attempt 2: append ", India" as a location hint
    try {
        const withCountry = `${clean}, India`;
        const coords = await fetchCoordinates(withCountry);
        coordCache.set(clean, coords);  // cache under original key too
        return coords;
    } catch (err) {
        lastError = err;
        console.warn(`⚠️  Geocode attempt 2 failed for "${clean}, India": ${err.message}`);
    }

    // All attempts exhausted
    console.error(`❌ Geocoding failed for "${location}" after ${MAX_RETRIES} attempts`);
    throw new Error(`Geocoding failed for location: "${location}"`);
}

/**
 * Geocode an array of location strings respecting the rate limit.
 * Returns an array of { location, coords } — coords is null on failure.
 *
 * @param {string[]} locations
 * @returns {Promise<Array<{ location: string, coords: {lat,lng}|null }>>}
 */
async function batchGeocode(locations) {
    const results = [];
    for (const loc of locations) {
        try {
            const coords = await getOpenStreetMapCoordinates(loc);
            results.push({ location: loc, coords });
        } catch {
            results.push({ location: loc, coords: null });
        }
    }
    return results;
}

module.exports = { getOpenStreetMapCoordinates, batchGeocode };