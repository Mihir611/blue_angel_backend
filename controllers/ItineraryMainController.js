const ItineraryRequest = require('../models/ItineraryRequest');
const Itinerary = require('../models/ItinerarySchema');
const Master = require('../models/ItineraryMaster');
const SelectedItitneraries = require('../models/itinerarySelected');
const ItineraryFeedback = require('../models/feedback/itineraryFeedback');
const SelectedItinerary = require('../models/itinerarySelected');
const { generateMultipleTravelItineraries } = require('../utils/gpthelper-openRouter');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const Bikes = require('../models/Bikes');
const { ExpiryHandelerForItineraries } = require('../utils/itineraryExpiryHandler');
const axios = require('axios');

const POLL_INTERVAL_MS = 15000;   // 15s between polls
const MAX_POLL_ATTEMPTS = 40;
/* -------------------------------------------------------------------------- */
/*  Normalisers                                                                */
/* -------------------------------------------------------------------------- */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
            contact_phone: raw.contact_phone ? String(raw.contact_phone).trim() : null,
            contact_email: raw.contact_email ? String(raw.contact_email).trim() : null,
            website: raw.website ? String(raw.website).trim() : null,
            advance_booking_days: raw.advance_booking_days != null ? Number(raw.advance_booking_days) : null,
            notes: raw.notes ? String(raw.notes).trim() : null
        };
    }

    return null;
}

function normaliseActivity(act) {
    if (typeof act === 'string') {
        return {
            time: '09:00', title: act.trim() || 'Activity', description: '',
            location: '', lat: null, lon: null, duration_minutes: 60, entry_fee: 'Free',
            booking_required: false, booking_info: null
        };
    }

    const bookingRequired = Boolean(act.bk?.req ?? act.booking_required ?? false);
    const bookingRaw = act.bk ?? act.booking_info ?? null;

    // ItinerarySchema stores lat/lon as String (default ''), not Number. The AI service
    // sometimes returns null lat/lon (e.g. multi-city "ride back" days) — those become
    // '' rather than the string "null", so the field stays a clean empty string.
    const rawLat = act.lat;
    const rawLon = act.lon;
    const toLatLonString = (val) => (val === null || val === undefined || val === '') ? '' : String(val).trim();

    return {
        time: String(act.tm ?? act.time ?? '09:00').trim(),
        title: String(act.n ?? act.title ?? 'Activity').trim() || 'Activity',
        description: String(act.desc ?? act.description ?? '').trim(),
        location: String(act.loc ?? act.location ?? '').trim(),
        lat: toLatLonString(rawLat),
        lon: toLatLonString(rawLon),
        duration_minutes: Math.max(0, Number(act.dur ?? act.duration_minutes ?? 60) || 60),
        entry_fee: String(act.fee ?? act.entry_fee ?? 'Free').trim(),
        booking_required: bookingRequired,
        booking_info: bookingRequired ? buildBookingInfo(bookingRaw) : null
    };
}

function normaliseDay(d, idx) {
    // Prefer the real date the AI service assigned to this day; only fall back to a
    // computed offset if it's missing/unparseable. Previously this always recomputed
    // from Date.now(), silently discarding the actual trip dates.
    const providedDate = d.date ? new Date(d.date) : null;
    const date = providedDate && !isNaN(providedDate.getTime())
        ? providedDate
        : new Date(Date.now() + idx * 86_400_000);

    return {
        day: Math.max(1, Number(d.d ?? d.day ?? idx + 1) || idx + 1),
        date,
        title: String(d.t ?? d.title ?? `Day ${idx + 1}`).trim(),
        route: String(d.r ?? d.route ?? '').trim(),
        distance: String(d.distance ?? '').trim(),
        accommodation: String(d.stay ?? d.accommodation ?? '').trim(),
        meals: String(d.meal ?? d.meals ?? '').trim(),
        budget: String(d.db ?? d.budget ?? '').trim(),
        highlights: Array.isArray(d.highlights) ? d.highlights.map(String) : [],
        activities: (d.acts ?? d.activities ?? []).map(normaliseActivity),
        riderNotes: String(d.riderNotes ?? '').trim()
    };
}

function normaliseMeta(raw = {}) {
    const ov = raw.ov ?? raw.overview ?? {};
    return {
        title: String(raw.title ?? '').trim(),
        theme: String(raw.theme ?? '').trim(),
        overview: {
            duration: ov.days ?? ov.duration ?? null,
            totalDistance: ov.dist ?? ov.totalDistance ?? '',
            estimatedBudget: ov.bud ?? ov.estimatedBudget ?? '',
            difficulty: ov.diff ?? ov.difficulty ?? '',
            startLocation: ov.startLocation ?? '',
            endLocation: ov.endLocation ?? '',
            travelMode: ov.travelMode ?? ''
        }
    };
}

/**
 * The Motonomaad job result shape is:
 *   result.itineraries = [
 *     { theme, themeId, themeTitle, style, variant, maxKmPerDay, document: { rideSource, rideDestination, days, meta, _id } },
 *     ...
 *   ]
 * i.e. one entry per (theme x variant), NOT a single itinerary. This maps one entry
 * into the shape Itinerary.create() expects.
 *
 * NOTE: entry.theme/themeId/themeTitle/style/variant/maxKmPerDay/document._id are
 * intentionally NOT persisted here — ItinerarySchema has no fields for them, so they
 * were being silently dropped by Mongoose anyway. meta.theme (a plain string) already
 * carries the theme name. If you later want to distinguish/query variants (e.g. "give
 * me the challenging Goa itinerary"), add matching fields to ItinerarySchema and
 * reintroduce them here.
 */
function normaliseItineraryVariant(entry, fallbackSource, fallbackDestination, requestId) {
    const doc = entry.document ?? {};
    const rawDays = doc.days ?? doc.d ?? [];

    return {
        request_id: requestId,
        rideSource: doc.rideSource || fallbackSource,
        rideDestination: doc.rideDestination || fallbackDestination,
        days: rawDays.map(normaliseDay),
        meta: normaliseMeta(doc.meta)
    };
}

async function getItinerary(payload) {
    try {
        const response = await axios.post(process.env.SUPPORTING_APU_URL + 'itinerary', payload);
        return { success: true, data: response }
    } catch (apiError) {
        return { success: false, error: apiError.response?.data || apiError.message };
    }
}

async function pollMotonomaadJob(jobId, pollUrl) {
    const url = pollUrl && pollUrl.startsWith('http')
        ? pollUrl
        : `${process.env.SUPPORTING_APU_URL}itinerary/${jobId}`;

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
        const { data } = await axios.get(url);

        if (data.status === 'completed') {
            return { success: true, data };
        }
        if (data.status === 'failed') {
            return { success: false, error: data.error || data.message || 'Motonomaad job failed' };
        }

        console.log(`Motonomaad job ${jobId}: status=${data.status}, attempt ${attempt}/${MAX_POLL_ATTEMPTS}`);
        await sleep(POLL_INTERVAL_MS);
    }

    return {
        success: false,
        error: `Motonomaad job ${jobId} did not complete within ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`
    };
}
/* -------------------------------------------------------------------------- */
/*  Controller                                                                 */
/* -------------------------------------------------------------------------- */

exports.createItineraryRequest = async (req, res) => {
    try {
        const { userEmail, rideType, rideSource, rideDestination, rideDuration, locationPreferences, maxKmPerDay } = req.body;
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

        const payload = {
            source: rideSource,
            destination: rideDestination,
            trip_days: Number(rideDuration),
            max_km_per_day: maxKmPerDay ? Number(maxKmPerDay) : (rideType === 'group' ? 200 : 300),
            ride_type: rideType,
            place_type: ['well-known', 'off-beat'].includes(locationPreferences) ? locationPreferences : 'well-known',
            buffer_km: 20,
            places_per_day: 4,
            one_way: false,
            country_bias: 'in',
            start_date: '2026-08-27',
            rich: true,
            themes: "default",
            variant: 0,
            variants_per_theme: 2,
        }

        const queueResponse = await getItinerary(payload);
        if (!queueResponse.success) {
            await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'failed' });
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });
            return res.status(502).json({
                success: false, message: 'Failed to queue itinerary generation',
                error: queueResponse.error, request_id: itineraryRequest._id
            });
        }

        const { job_id, poll_url } = queueResponse.data.data;
        if (!job_id) {
            throw new Error('Motonomaad API did not return a job_id');
        }

        console.log(`Motonomaad job queued: ${job_id}, polling every ${POLL_INTERVAL_MS / 1000}s...`);
        const aiResult = await pollMotonomaadJob(job_id, poll_url);

        if (!aiResult.success) {
            await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'failed' });
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });
            return res.status(502).json({
                success: false, message: 'Failed to generate itineraries from AI',
                error: aiResult.error, request_id: itineraryRequest._id
            });
        }

        // aiResult.data is the *whole* polled job document:
        // { job_id, status, created_at, updated_at, progress, request, result: { itineraries: [...], errors: [...] } }
        const jobResult = aiResult.data?.result ?? {};
        const itineraryVariants = Array.isArray(jobResult.itineraries) ? jobResult.itineraries : [];

        if (itineraryVariants.length === 0) {
            await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'failed' });
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });
            return res.status(502).json({
                success: false,
                message: 'Motonomaad returned no itineraries',
                error: jobResult.errors?.length ? jobResult.errors : 'No itineraries in result',
                request_id: itineraryRequest._id
            });
        }

        // Save each theme/variant as its own Itinerary doc, tolerating partial failures
        // the same way the rest of this codebase does (Promise.allSettled + 207).
        const saveOutcomes = await Promise.allSettled(
            itineraryVariants.map(entry =>
                Itinerary.create(
                    normaliseItineraryVariant(entry, rideSource, rideDestination, itineraryRequest._id)
                )
            )
        );

        const savedItineraries = [];
        const saveErrors = [];

        saveOutcomes.forEach((outcome, i) => {
            if (outcome.status === 'fulfilled') {
                savedItineraries.push(outcome.value);
            } else {
                const failedEntry = itineraryVariants[i];
                console.error(
                    `Failed to save itinerary variant ${i} (${failedEntry?.themeTitle}/${failedEntry?.variant}):`,
                    outcome.reason
                );
                saveErrors.push({
                    theme: failedEntry?.theme,
                    themeTitle: failedEntry?.themeTitle,
                    variant: failedEntry?.variant,
                    error: outcome.reason?.message || String(outcome.reason)
                });
            }
        });

        if (savedItineraries.length === 0) {
            await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'failed' });
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });
            return res.status(500).json({
                success: false, message: 'All itinerary variants failed to save',
                errors: saveErrors, request_id: itineraryRequest._id
            });
        }

        await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'completed' });
        await Master.findByIdAndUpdate(masterRecord._id, {
            itinerary_id: savedItineraries[0]._id,          // kept for backward compatibility with existing readers
            itinerary_ids: savedItineraries.map(i => i._id), // NOTE: add this field to ItineraryMaster schema to persist it
            status: 'completed'
        });

        const responseStatus = saveErrors.length > 0 ? 207 : 201;
        return res.status(responseStatus).json({
            success: true,
            message: `${savedItineraries.length}/${itineraryVariants.length} itinerary variant(s) generated successfully`,
            data: {
                request: itineraryRequest,
                master: await Master.findById(masterRecord._id),
                itineraries: savedItineraries,
                failed: saveErrors,
                jobMeta: {
                    job_id,
                    count: jobResult.count,
                    errors: jobResult.errors ?? []
                }
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
        const { userEmail, page = 1, limit = 10 } = req.query;

        const user = await getUserByEmail(userEmail);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        await ExpiryHandelerForItineraries();
        const filter = { user: user.userId };

        const [selectedItineraries, total] = await Promise.all([
            SelectedItinerary.find(filter)
                .sort({ created_at: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .lean(),
            SelectedItinerary.countDocuments(filter)
        ]);

        const enriched = await Promise.all(
            selectedItineraries.map(async (selected) => {
                const itinerary = await Itinerary.findById(selected.itinerary_id).lean();
                return {
                    selected,
                    itinerary: itinerary ?? null
                };
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
        const itinerary = await Itinerary.findById(req.query.requestId).populate('request_id');
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

exports.markItitnerariesAsSelected = async (req, res) => {
    try {
        const { userEmail, itineraryId, itineraryTitle } = req.body;

        if (!userEmail || !itineraryId) {
            return res.status(400).json({ success: false, message: 'Useremail and itineraryId is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const createRecord = new SelectedItitneraries({
            user: user.userId,
            itinerary_id: itineraryId,
            itinerary_title: itineraryTitle,
            itineraryStatus: 'Selected'
        })

        const itineraryFeedbackRecord = new ItineraryFeedback({
            user: user.userId,
            itineraryId: itineraryId,
            itineraryTitle: itineraryTitle
        })

        const saved = await createRecord.save();
        const recordCreated = await itineraryFeedbackRecord.save();
        return res.status(201).json({ success: 'true', message: 'Records saved' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Itinerary already saved by this user' });
        }
        console.error('marking itineraries as selected generated an error', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}