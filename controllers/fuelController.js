exports.getPrice = async (req, res) => {
    const { city } = req.query;

    if (!city) {
        return res.status(400).json({ success: false, message: "Missing required query parameter: city", })
    }

    try {
        const url = new URL(`${process.env.SUPPORTING_APU_URL}fuel-price`);
        url.searchParams.set("city", city.trim());
        console.log(url);
        const response = await fetch(url.toString(), {
            signal: AbortSignal.timeout(10000),
        });

        const apiData = await response.json();

        if (!response.ok || apiData.detail) {
            return res.status(404).json({
                success: false,
                error: data.detail || `No fuel price data found for "${city}".`,
            });
        }

        const cityName = apiData.location;

        // Extract numeric price from "₹102.36" → 102.36
        const rawPrice = apiData.price_per_litre ?? apiData.average_price_per_litre ?? null;
        const numericPrice = rawPrice
            ? parseFloat(rawPrice.replace(/[^\d.]/g, ''))
            : null;

        return res.json({
            success: true,
            city: cityName,
            date: apiData.last_updated ?? new Date().toISOString().split("T")[0],
            source: apiData.source_url,
            data: {
                [cityName]: numericPrice,          // e.g. { "Udupi": 102.36 }
                'Price_Date(Today)': apiData.last_updated ?? null,
                Unit: '1 Litre',
                Currency: 'INR',
            },
        });

    } catch (err) {
        if (err.name === "TimeoutError") {
            return res.status(504).json({
                success: false,
                error: "Request to fuel price service timed out. Please try again.",
            });
        }

        console.error(`[FuelController Error] ${err.message}`);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch fuel prices. Please try again later.",
        });
    }
}