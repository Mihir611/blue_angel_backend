// geocoding.jsconst axios = require('axios');

/**
 * Get real GPS coordinates for a location name using OpenStreetMap Nominatim.
 * @param {string} location - Human‑readable location (e.g. "Eiffel Tower, Paris")
 * @returns {Promise<{lat:number,lng:number}>}
 */
async function getOpenStreetMapCoordinates(location) {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: location,
                format: 'json',
                limit: 1
            },
            headers: {
                // Nominatim policy – identify your app
                'User-Agent': 'TravelItineraryGenerator/1.0'
            }
        });
        const data = response.data;
        if (Array.isArray(data) && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lng)
            };
        }
        throw new Error(`Location not found: "${location}"`);
    } catch (error) {
        console.error(`Geocoding error for "${location}": ${error.message}`);
        throw new Error(`Geocoding failed for location: ${location}`);
    }
}

module.exports = { getOpenStreetMapCoordinates };