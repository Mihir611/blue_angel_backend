const axios = require('axios');

const TIP_ANALYZE_URL = process.env.SUPPORTING_APU_URL;

exports.getRideSafetyTips = async (req, res) => {
    try {
        const { city } = req.query;

        if (!city) {
            return res.status(400).json({ success: false, message: "city is required." });
        }

        const response = await axios.get(TIP_ANALYZE_URL + '/tips/analyze/text', { params: { city } })
        const { city: responseCity, summary } = response.data || {};

        if (!summary) {
            return res.status(502).json({ success: false, message: "Malformed response from tips analyze service.", raw: response.data });
        }

        return res.status(200).json({ success: true, city: responseCity || city, summary });

    } catch (error) {
        console.error("[RideSafetyTips Error]", error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Internal error while fetching safety advice.",
        });
    }
};

exports.getAnalysis = async (req, res) => {
    try {
        const { city } = req.query;

        if (!city) {
            return res.status(400).json({ success: false, message: "city is required." });
        }

        const response = await axios.get(TIP_ANALYZE_URL + '/tips/analyze', { params: { city } });
        const analysis = response.data;

        if (!analysis?.location || !analysis?.decision) {
            return res.status(502).json({ success: false, message: "Malformed response from tips analyze service.", raw: analysis });
        }

        return res.status(200).json({ success: true, ...analysis });

    } catch (error) {
        console.error("[GetAnalysis Error]", error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: "Internal error while fetching ride analysis.",
        });
    }
};