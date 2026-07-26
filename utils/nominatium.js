const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
exports.resolveDistrictForCity = async (city) => {
    try {
        const url = new URL(NOMINATIM_URL);
        url.searchParams.set("q", `${city}, India`);
        url.searchParams.set("format", "json");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "1");

        const response = await fetch(url.toString(), {
            headers: {
                // Nominatim usage policy requires a descriptive User-Agent
                "User-Agent": "Motonomaad/1.0 (fuel-price-lookup)",
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) return null;

        const results = await response.json();
        if (!Array.isArray(results) || results.length === 0) return null;

        const address = results[0].address || {};
        // Nominatim uses different keys depending on region granularity
        return (
            address.state_district ||
            address.county ||
            address.district ||
            null
        );
    } catch (err) {
        console.error(`[FuelController] District resolution failed: ${err.message}`);
        return null;
    }
}