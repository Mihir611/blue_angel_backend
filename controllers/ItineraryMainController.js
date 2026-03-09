const ItineraryRequest = require('../models/ItineraryRequest');
const Itinerary = require('../models/ItinerarySchema');
const Master = require('../models/ItineraryMaster');
const { generateMultipleTravelItineraries } = require('../utils/gpthelper');

exports.createItineraryRequest = async (req, res) => {
    try {
        const { userEmail, rideType, rideSource, rideDestination, rideDuration, locationPreferences } = req.body;

        if (!userEmail || !rideType || !rideSource || !rideDestination || !rideDuration) {
            return res.status(400).json({
                success: false,
                message: 'userEmail, rideType, rideSource, rideDestination and rideDuration are required'
            });
        }

        if (isNaN(rideDuration) || rideDuration < 1) {
            return res.status(400).json({
                success: false,
                message: 'rideDuration must be a positive number'
            });
        }

        // ── 1. Save the user's request ────────────────────────────────────────
        const itineraryRequest = await ItineraryRequest.create({
            userEmail,
            rideType,
            rideSource,
            rideDestination,
            rideDuration,
            locationPreference: locationPreferences|| '',
            status: 'processing'
        });

        // ── 2. Create master record (itinerary_id null until generated) ───────
        const masterRecord = await Master.create({
            userEmail,
            rideSource,
            rideDestination,
            itinerary_request_id: itineraryRequest._id,
            itinerary_id: null,
            status: 'processing'
        });

        // ── 3. Call Gemini to generate itineraries ────────────────────────────
        const geminiResult = await generateMultipleTravelItineraries({
            source: rideSource,
            destination: rideDestination,
            days: rideDuration,
            travelMode: rideType,
            preferences: locationPreferences ? [locationPreferences] : [],
            numItineraries: 3
        });

        if (!geminiResult.success) {
            await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'failed' });
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });

            return res.status(502).json({
                success: false,
                message: 'Failed to generate itineraries from AI',
                error: geminiResult.error,
                request_id: itineraryRequest._id
            });
        }

        // ── 4. Persist all generated itineraries ──────────────────────────────
        const generatedList = geminiResult.data?.itineraries?.itineraries || [];
        const savedItineraries = [];

        for (const raw of generatedList) {
            if (raw.error && !raw.days) continue;

            const daysPayload = (raw.days || []).map((d, idx) => ({
                day: d.day || idx + 1,
                date: new Date(Date.now() + idx * 86400000),
                activities: (d.activities || []).map(act => ({
                    time: act.time || '09:00',
                    title: typeof act === 'string' ? act : act.title || 'Activity',
                    description: act.description || '',
                    location: act.location || d.route || '',
                    duration_minutes: act.duration_minutes || 60
                }))
            }));

            const saved = await Itinerary.create({
                request_id: itineraryRequest._id,
                rideSource,
                rideDestination,
                days: daysPayload,
                meta: {
                    title: raw.title,
                    theme: raw.theme,
                    overview: raw.overview || {}
                }
            });

            savedItineraries.push(saved);
        }

        // ── 5. Mark request & master as completed ─────────────────────────────
        await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'completed' });

        if (savedItineraries.length > 0) {
            await Master.findByIdAndUpdate(masterRecord._id, {
                itinerary_id: savedItineraries[0]._id,
                status: 'completed'
            });
        }

        // ── 6. Respond ────────────────────────────────────────────────────────
        return res.status(201).json({
            success: true,
            message: `${savedItineraries.length} itinerary(s) generated successfully`,
            data: {
                request: itineraryRequest,
                master: await Master.findById(masterRecord._id),
                itineraries: savedItineraries,
                parseInfo: geminiResult.data?.parseInfo || {}
            }
        });

    } catch (error) {
        console.error('createItineraryRequest error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
}

exports.getRequestById = async (req, res) => {
    try {
        const { requestId } = req.params; 

        const itineraryRequest = await ItineraryRequest.findById(requestId);
        if(!itineraryRequest) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        const itineraries = await Itinerary.find({ request_id: requestId });
        const master = await Master.findOne({ itinerary_request_id: requestId });

        return res.status(200).json({
            success: true,
            data: { request: itineraryRequest, master, itineraries }
        });
    } catch (error) {
        console.error('getRequestById error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
}

exports.getRequestsByUser = async (req, res) => {
    try {
        const { userEmail } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        const filter = { userEmail: userEmail.toLowerCase() };
        if (status) filter.status = status;

        const requests = await ItineraryRequest.find(filter)
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await ItineraryRequest.countDocuments(filter);

        const enriched = await Promise.all(
            requests.map(async (request) => {
                const itineraries = await Itinerary.find({ request_id: request._id });
                return { request, itineraries };
            })
        );

        return res.status(200).json({
            success: true,
            data: {
                results: enriched,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('getRequestsByUser error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.getItineraryById = async (req, res) => {
    try {
        const itinerary = await Itinerary.findById(req.params.itineraryId).populate('request_id');
        if (!itinerary) {
            return res.status(404).json({ success: false, message: 'Itinerary not found' });
        }

        return res.status(200).json({ success: true, data: itinerary });

    } catch (error) {
        console.error('getItineraryById error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
