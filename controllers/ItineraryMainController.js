const ItineraryRequest = require('../models/ItineraryRequest');
const Itinerary = require('../models/ItinerarySchema');
const Master = require('../models/ItineraryMaster');
const { generateMultipleTravelItineraries } = require('../utils/gpthelper-openRouter');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const Bikes = require('../models/Bikes');

/* -------------------------------------------------------------------------- */
/*  Normalisers                                                                */
/* -------------------------------------------------------------------------- */

function buildBookingInfo(raw) {
    if (!raw || raw === false) return null;

    if (typeof raw === 'object' && 'req' in raw) {
        raw = raw.info ?? null;
        if (!raw) return null;
    }

    if (typeof raw === 'string') {
        return { contact_phone: null, contact_email: null, website: null, advance_booking_days: null, notes: raw.trim() || null };
    }

    if (typeof raw === 'object') {
        return {
            contact_phone:        raw.contact_phone        ? String(raw.contact_phone).trim()        : null,
            contact_email:        raw.contact_email        ? String(raw.contact_email).trim()        : null,
            website:              raw.website              ? String(raw.website).trim()               : null,
            advance_booking_days: raw.advance_booking_days != null ? Number(raw.advance_booking_days) : null,
            notes:                raw.notes                ? String(raw.notes).trim()                 : null
        };
    }

    return null;
}

function normaliseActivity(act) {
    if (typeof act === 'string') {
        return {
            time: '09:00', title: act.trim() || 'Activity', description: '',
            location: '', duration_minutes: 60, entry_fee: 'Free',
            booking_required: false, booking_info: null
        };
    }

    const bookingRequired = Boolean(act.bk?.req ?? act.booking_required ?? false);
    const bookingRaw      = act.bk ?? act.booking_info ?? null;

    return {
        time:             String(act.tm   ?? act.time             ?? '09:00').trim(),
        title:            String(act.n    ?? act.title            ?? 'Activity').trim() || 'Activity',
        description:      String(act.desc ?? act.description      ?? '').trim(),
        location:         String(act.loc  ?? act.location         ?? '').trim(),
        duration_minutes: Math.max(0, Number(act.dur ?? act.duration_minutes ?? 60) || 60),
        entry_fee:        String(act.fee  ?? act.entry_fee        ?? 'Free').trim(),
        booking_required: bookingRequired,
        booking_info:     bookingRequired ? buildBookingInfo(bookingRaw) : null
    };
}

function normaliseDay(d, idx) {
    return {
        day:           Math.max(1, Number(d.d ?? d.day ?? idx + 1) || idx + 1),
        date:          new Date(Date.now() + idx * 86_400_000),
        title:         String(d.t    ?? d.title         ?? `Day ${idx + 1}`).trim(),
        route:         String(d.r    ?? d.route         ?? '').trim(),
        distance:      String(d.distance                ?? '').trim(),
        accommodation: String(d.stay ?? d.accommodation ?? '').trim(),
        meals:         String(d.meal ?? d.meals          ?? '').trim(),
        budget:        String(d.db   ?? d.budget         ?? '').trim(),
        highlights:    Array.isArray(d.highlights) ? d.highlights.map(String) : [],
        activities:    (d.acts ?? d.activities ?? []).map(normaliseActivity)
    };
}

function normaliseMeta(raw) {
    const ov = raw.ov ?? raw.overview ?? {};
    return {
        title: String(raw.title ?? '').trim(),
        theme: String(raw.theme ?? '').trim(),
        overview: {
            duration:        ov.days ?? ov.duration        ?? null,
            totalDistance:   ov.dist ?? ov.totalDistance   ?? '',
            estimatedBudget: ov.bud  ?? ov.estimatedBudget ?? '',
            difficulty:      ov.diff ?? ov.difficulty      ?? '',
            startLocation:   ov.startLocation              ?? '',
            endLocation:     ov.endLocation                ?? '',
            travelMode:      ov.travelMode                 ?? ''
        }
    };
}

/* -------------------------------------------------------------------------- */
/*  Controller                                                                 */
/* -------------------------------------------------------------------------- */

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
            return res.status(400).json({ success: false, message: 'rideDuration must be a positive number' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const userId = user.userId;

        const userBike = await Bikes.findOne({ owner: userId });
        if (!userBike) {
            return res.status(403).json({
                success: false,
                message: 'No bike found in your garage. Please add a bike before planning a ride.'
            });
        }

        const itineraryRequest = await ItineraryRequest.create({
            user: userId, rideType, rideSource, rideDestination, rideDuration,
            locationPreference: locationPreferences || '', status: 'processing'
        });

        const masterRecord = await Master.create({
            user: userId, rideSource, rideDestination,
            itinerary_request_id: itineraryRequest._id,
            itinerary_id: null, status: 'processing'
        });

        const aiResult = await generateMultipleTravelItineraries({
            source: rideSource, destination: rideDestination, days: rideDuration,
            travelMode: rideType, preferences: locationPreferences ? [locationPreferences] : [],
            numItineraries: 3
        });

        if (!aiResult.success) {
            await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'failed' });
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });
            return res.status(502).json({
                success: false, message: 'Failed to generate itineraries from AI',
                error: aiResult.error, request_id: itineraryRequest._id
            });
        }

        const generatedList    = aiResult.data?.itineraries?.itineraries ?? [];
        const savedItineraries = [];

        for (const raw of generatedList) {
            const rawDays = raw.days ?? raw.d ?? [];
            const hasDays = Array.isArray(rawDays) && rawDays.length > 0;

            if (raw.error && !hasDays) {
                console.warn(`⚠️  Skipping itinerary "${raw.title}" – no day data:`, raw.error);
                continue;
            }

            const saved = await Itinerary.create({
                request_id: itineraryRequest._id,
                rideSource,
                rideDestination,
                days: rawDays.map(normaliseDay),
                meta: normaliseMeta(raw)
            });

            savedItineraries.push(saved);
        }

        await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'completed' });

        if (savedItineraries.length > 0) {
            await Master.findByIdAndUpdate(masterRecord._id, {
                itinerary_id: savedItineraries[0]._id, status: 'completed'
            });
        } else {
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });
        }

        return res.status(201).json({
            success: true,
            message: `${savedItineraries.length} itinerary(s) generated successfully`,
            data: {
                request:     itineraryRequest,
                master:      await Master.findById(masterRecord._id),
                itineraries: savedItineraries,
                parseInfo:   aiResult.data?.parseInfo ?? {}
            }
        });

    } catch (error) {
        console.error('createItineraryRequest error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.getRequestById = async (req, res) => {
    try {
        const itineraryRequest = await ItineraryRequest.findById(req.query.requestId);
        if (!itineraryRequest) return res.status(404).json({ success: false, message: 'Request not found' });

        const [itineraries, master] = await Promise.all([
            Itinerary.find({ request_id: req.query.requestId }),
            Master.findOne({ itinerary_request_id: req.params.requestId })
        ]);

        return res.status(200).json({ success: true, data: { request: itineraryRequest, master, itineraries } });
    } catch (error) {
        console.error('getRequestById error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.getRequestsByUser = async (req, res) => {
    try {
        const { userEmail } = req.query;
        const { status, page = 1, limit = 10 } = req.query;

        const user = await getUserByEmail(userEmail);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const filter = { user: user.userId };
        if (status) filter.status = status;

        const [requests, total] = await Promise.all([
            ItineraryRequest.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(Number(limit)),
            ItineraryRequest.countDocuments(filter)
        ]);

        const enriched = await Promise.all(
            requests.map(async (request) => ({
                request,
                itineraries: await Itinerary.find({ request_id: request._id })
            }))
        );

        return res.status(200).json({
            success: true,
            data: {
                results: enriched,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) }
            }
        });
    } catch (error) {
        console.error('getRequestsByUser error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.getItineraryById = async (req, res) => {
    try {
        const itinerary = await Itinerary.findById(req.query.requestId).populate('request_id');
        console.log(itinerary)
        if (!itinerary) return res.status(404).json({ success: false, message: 'Itinerary not found' });
        return res.status(200).json({ success: true, data: itinerary });
    } catch (error) {
        console.error('getItineraryById error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.getItineraries = async (req, res) => {
    try {
        const { source, destination } = req.query;

        if (!source || !destination) {
            return res.status(400).json({ success: false, message: 'source and destination query params are required' });
        }

        const itineraries = await Itinerary.find({ rideSource: source, rideDestination: destination });
        return res.status(200).json({ success: true, data: itineraries });
    } catch (error) {
        console.error('getItineraries error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};