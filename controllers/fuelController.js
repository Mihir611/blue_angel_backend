const axios = require('axios');

exports.getPrice = async (req, res) => {
    const { city } = req.query;

    if (!city) {
        return res.status(400).json({ success: false, message: "Missing required query parameter: city", })
    }

    try {
        const { data } = await axios.get(
            'https://fuel-petrol-diesel-live-price-india.p.rapidapi.com/petrol_price_india_city_value/',
            {
                headers: {
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                    'x-rapidapi-host': 'fuel-petrol-diesel-live-price-india.p.rapidapi.com',
                    'Content-Type': 'application/json',
                    'city': city.trim(),
                },
                timeout: 10000,
            }
        );

        return res.json({
            success: true,
            city: city.trim(),
            date: new Date().toISOString().split("T")[0],
            source: "rapidapi / fuel-petrol-diesel-live-price-india",
            data,
        });

    } catch (err) {
        if (err.response?.status === 403) {
            return res.status(403).json({
                success: false,
                error: "Invalid or missing RapidAPI key.",
            });
        }

        if (err.response?.status === 404) {
            return res.status(404).json({
                success: false,
                error: `City "${city}" not found.`,
            });
        }

        console.error(`[Error] ${err.message}`);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch fuel prices. Please try again later.",
        });
    }
}