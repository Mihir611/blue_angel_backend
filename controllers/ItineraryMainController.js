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

const POLL_INTERVAL_MS = 15000;   // 15s between polls (only used by the legacy blocking pollMotonomaadJob below)
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

/**
 * A SINGLE, non-looping status check against the Motonomaad job. This is the
 * exact body of pollMotonomaadJob's loop iteration, extracted so it can be
 * called once per HTTP request from getItineraryRequestStatus (see below)
 * instead of being looped inside one long-lived request. Behaviorally
 * identical URL resolution to the original pollMotonomaadJob.
 */
async function checkMotonomaadJobOnce(jobId, pollUrl) {
    const url = pollUrl && pollUrl.startsWith('http')
        ? pollUrl
        : `${process.env.SUPPORTING_APU_URL}itinerary/${jobId}`;

    try {
        const { data } = await axios.get(url);
        return { success: true, data };
    } catch (apiError) {
        return { success: false, error: apiError.response?.data || apiError.message };
    }
}

/**
 * LEGACY / no longer called by createItineraryRequest (that's the whole
 * fix — this function's loop is what was exceeding Vercel Hobby's 10s
 * ceiling: POLL_INTERVAL_MS x MAX_POLL_ATTEMPTS = up to 10 minutes inside a
 * single request). Kept here in case anything else in the codebase still
 * imports it directly. Now implemented on top of checkMotonomaadJobOnce so
 * the two can't drift apart.
 *
 * NOTE: this changes one subtlety — the original inline loop let a thrown
 * axios error propagate all the way up to createItineraryRequest's outer
 * try/catch (surfacing as a generic 500). checkMotonomaadJobOnce catches
 * that error and returns { success: false, error }, so this version now
 * returns cleanly instead of throwing on a single flaky request. If you
 * still call this function elsewhere and rely on it throwing, keep that in
 * mind.
 */
async function pollMotonomaadJob(jobId, pollUrl) {
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
        const check = await checkMotonomaadJobOnce(jobId, pollUrl);

        if (!check.success) {
            return { success: false, error: check.error };
        }

        const { data } = check;

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

// ── 1. Fast enqueue — returns in well under 10s ─────────────────────────────
// Previously this awaited pollMotonomaadJob (up to 10 minutes) before
// responding at all — Vercel Hobby kills any function after 10s, so the
// connection was being severed mid-poll with literally no response ever
// written. That's what surfaced client-side as a bare "Network Error" with
// no status and no response body. Now this only enqueues and returns —
// getItineraryRequestStatus (below) does the waiting, one cheap check per
// call, driven by the client polling every few seconds.
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
            await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { status: 'failed' });
            await Master.findByIdAndUpdate(masterRecord._id, { status: 'failed' });
            return res.status(502).json({
                success: false, message: 'Motonomaad API did not return a job_id',
                request_id: itineraryRequest._id
            });
        }

        // Persist so getItineraryRequestStatus can pick this job back up on
        // each poll without re-queueing anything.
        // TODO: add `job_id: String` and `poll_url: String` fields to
        // models/ItineraryRequest.js — Mongoose silently drops undeclared
        // fields under the default `strict: true` schema option, so this
        // update will no-op until those fields exist on the schema.
        await ItineraryRequest.findByIdAndUpdate(itineraryRequest._id, { job_id, poll_url });

        console.log(`Motonomaad job queued: ${job_id} (request ${itineraryRequest._id})`);

        return res.status(202).json({
            success: true,
            message: 'Itinerary generation queued',
            data: {
                request_id: itineraryRequest._id,
                master_id: masterRecord._id,
                status: 'processing',
                job_id,
            }
        });

    } catch (error) {
        console.error('createItineraryRequest error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// ── 2. Single status check — called repeatedly by the frontend ─────────────
// GET /api/itinerary/request/:id/status
// Does at most ONE check against Motonomaad per call, so it always finishes
// well under Vercel's 10s limit no matter how long generation is taking.
exports.getItineraryRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const itineraryRequest = await ItineraryRequest.findById(id);
        if (!itineraryRequest) {
            return res.status(404).json({ success: false, message: 'Itinerary request not found' });
        }

        // Already resolved on a previous poll — nothing further to check.
        if (itineraryRequest.status === 'completed') {
            const master = await Master.findOne({ itinerary_request_id: id });
            return res.status(200).json({
                success: true,
                data: {
                    status: 'completed',
                    request_id: itineraryRequest._id,
                    itinerary_ids: master?.itinerary_ids ?? (master?.itinerary_id ? [master.itinerary_id] : []),
                }
            });
        }
        if (itineraryRequest.status === 'failed') {
            return res.status(200).json({
                success: true,
                data: { status: 'failed', request_id: itineraryRequest._id }
            });
        }

        if (!itineraryRequest.job_id) {
            console.error(`[status] request ${id} is processing but has no job_id`);
            return res.status(200).json({
                success: true,
                data: {
                    status: 'processing',
                    request_id: itineraryRequest._id,
                    warning: 'job_id missing – schema may not have been updated',
                },
            });
        }
        // Still processing — ONE check, not a loop.
        const check = await checkMotonomaadJobOnce(itineraryRequest.job_id, itineraryRequest.poll_url);

        if (!check.success) {
            return res.status(200).json({
                success: true,
                data: { status: 'processing', request_id: itineraryRequest._id }
            });
        }

        const job = check.data;
        const rawStatus = (job.status || '').toString().toLowerCase()
        if (rawStatus !== 'completed' && rawStatus !== 'failed') {
            return res.status(200).json({
                success: true,
                data: { status: 'processing', request_id: itineraryRequest._id, jobStatus: job.status }
            });
        }

        if (rawStatus === 'failed') {
            await ItineraryRequest.findByIdAndUpdate(id, { status: 'failed' });
            await Master.findOneAndUpdate({ itinerary_request_id: id }, { status: 'failed' });
            return res.status(200).json({
                success: true,
                data: {
                    status: 'failed',
                    request_id: itineraryRequest._id,
                    error: job.error || job.message || 'Motonomaad job failed'
                }
            });
        }

        // job.status === 'completed' — save results now, exactly once.
        const jobResult = job.result ?? {};
        const itineraryVariants = Array.isArray(jobResult.itineraries) ? jobResult.itineraries : [];

        if (itineraryVariants.length === 0) {
            await ItineraryRequest.findByIdAndUpdate(id, { status: 'failed' });
            await Master.findOneAndUpdate({ itinerary_request_id: id }, { status: 'failed' });
            return res.status(200).json({
                success: true,
                data: {
                    status: 'failed',
                    request_id: itineraryRequest._id,
                    error: jobResult.errors?.length ? jobResult.errors : 'No itineraries in result'
                }
            });
        }

        const saveOutcomes = await Promise.allSettled(
            itineraryVariants.map(entry =>
                Itinerary.create(
                    normaliseItineraryVariant(entry, itineraryRequest.rideSource, itineraryRequest.rideDestination, itineraryRequest._id)
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
            await ItineraryRequest.findByIdAndUpdate(id, { status: 'failed' });
            await Master.findOneAndUpdate({ itinerary_request_id: id }, { status: 'failed' });
            return res.status(200).json({
                success: true,
                data: {
                    status: 'failed',
                    request_id: itineraryRequest._id,
                    error: 'All itinerary variants failed to save',
                    errors: saveErrors
                }
            });
        }

        await ItineraryRequest.findByIdAndUpdate(id, { status: 'completed' });
        const updatedMaster = await Master.findOneAndUpdate(
            { itinerary_request_id: id },
            {
                itinerary_id: savedItineraries[0]._id,           // kept for backward compatibility with existing readers
                itinerary_ids: savedItineraries.map(i => i._id), // NOTE: add this field to ItineraryMaster schema to persist it
                status: 'completed'
            },
            { new: true }
        );
        console.log(
            `request_id: ${itineraryRequest._id},
                itinerary_ids: ${updatedMaster?.itinerary_ids ?? savedItineraries.map(i => i._id)},
                count: ${savedItineraries.length},
                failed: ${saveErrors},
                jobMeta: {
                    job_id: ${itineraryRequest.job_id},
                    count: ${jobResult.count},
                    errors: ${jobResult.errors ?? []}
                }`
        )
        return res.status(200).json({
            success: true,
            data: {
                status: 'completed',
                request_id: itineraryRequest._id,
                itinerary_ids: updatedMaster?.itinerary_ids ?? savedItineraries.map(i => i._id),
                count: savedItineraries.length,
                failed: saveErrors,
                jobMeta: {
                    job_id: itineraryRequest.job_id,
                    count: jobResult.count,
                    errors: jobResult.errors ?? []
                }
            }
        });

    } catch (error) {
        console.error('getItineraryRequestStatus error:', error);
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