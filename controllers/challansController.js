const Challan = require('../models/challansMaster');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const axios = require('axios');

const START_PATH  = 'challan/start';
const STATUS_PATH = 'challan/status/';
const SUBMIT_PATH = 'challan/submit';
const RESULT_PATH = 'challan/result/';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a base axios config pointing at the supporting API.
 * Throws early if the env var is missing so bugs surface clearly.
 */
function buildConfig(extraFields = {}) {
    const baseURL = process.env.SUPPORTING_APU_URL;
    if (!baseURL) throw new Error('SUPPORTING_APU_URL env var is not set');

    return {
        method: 'POST',
        baseURL,
        headers: {
            'Content-Type': 'application/json',
            'Accept':        'application/json',
        },
        timeout: 15_000,
        ...extraFields,
    };
}

/**
 * Polls a GET endpoint every `intervalMs` ms.
 * Resolves when `isDone(data)` returns true.
 * Retries on ETIMEDOUT instead of rejecting immediately.
 * Rejects after `maxAttempts` tries.
 *
 * @param {string}   url         - Path segment, e.g. 'challan/status/'
 * @param {string}   jobId       - Appended to url, e.g. 'abc-123'
 * @param {Function} isDone      - (data) => boolean — caller decides completion
 * @param {number}   intervalMs  - Milliseconds between polls (default 5 s)
 * @param {number}   maxAttempts - Max poll attempts before giving up (default 36)
 */
function pollUntilDone(url, jobId, isDone, intervalMs = 5_000, maxAttempts = 36) {
    const baseURL = process.env.SUPPORTING_APU_URL;
    if (!baseURL) throw new Error('SUPPORTING_APU_URL env var is not set');

    return new Promise((resolve, reject) => {
        let attempts = 0;

        const tick = async () => {
            attempts++;
            try {
                const res = await axios.get(`${baseURL}${url}${jobId}`, {
                    headers: { Accept: 'application/json' },
                    timeout: 15_000,
                });

                const data = res.data;
                console.log(
                    `[poll] ${url}${jobId} | attempt ${attempts} |`,
                    JSON.stringify(data).slice(0, 300)
                );

                if (isDone(data)) return resolve(data);

                if (attempts >= maxAttempts)
                    return reject(
                        new Error(`Polling timed out after ${attempts} attempts on ${url}${jobId}`)
                    );

                setTimeout(tick, intervalMs);

            } catch (err) {
                // Retry on network timeouts instead of hard-failing
                if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
                    console.warn(
                        `[poll] attempt ${attempts} timed out (${err.code}), retrying in ${intervalMs}ms…`
                    );
                    if (attempts >= maxAttempts)
                        return reject(
                            new Error(`Polling timed out after ${attempts} attempts on ${url}${jobId}`)
                        );
                    return setTimeout(tick, intervalMs);
                }
                reject(err);
            }
        };

        setTimeout(tick, intervalMs); // first tick after one interval
    });
}

/**
 * Best-effort extraction of a unique challan number for deduplication.
 */
function extractChallanNo(challan, bikePlate, index) {
    return (
        challan?.challanNo   ||
        challan?.challan_no  ||
        challan?.id          ||
        challan?.challanId   ||
        `${bikePlate}-${index}-${Date.now()}`
    );
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /challans?userEmail=&bikePlate=
 * Step 1 — start the job.
 * Step 2 — poll /challan/status/:jobId until the captcha image is ready.
 * Returns the captcha image (base64) so the client can render it.
 */
exports.getChallans = async (req, res) => {
    try {
        const { userEmail, bikePlate } = req.query;

        if (!userEmail || !bikePlate)
            return res.status(400).json({
                success: false,
                message: 'userEmail and bikePlate are required',
            });

        const user = await getUserByEmail(userEmail);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });

        // ── 1. Hit /challan/start to obtain a job_id ──────────────────────────
        const startResponse = await axios({
            ...buildConfig({ url: START_PATH }),
            data: { vehicle_no: bikePlate },
        });

        const { job_id } = startResponse.data;
        if (!job_id)
            return res.status(502).json({
                success: false,
                message: 'Failed to get job_id from challan service',
            });

        console.log(`[getChallans] job started | job_id: ${job_id}`);

        // ── 2. Poll /challan/status/:job_id until captcha image is ready ──────
        const statusData = await pollUntilDone(
            STATUS_PATH,
            job_id,
            (data) => {
                // Resolve as soon as captcha_image_b64 is a non-null string
                const hasImage =
                    data?.captcha_image_b64 !== null &&
                    data?.captcha_image_b64 !== undefined &&
                    data?.captcha_image_b64 !== '';
                console.log(`[status poll] state: ${data?.state} | hasImage: ${hasImage}`);
                return hasImage;
            }
        );

        return res.status(200).json({
            success: true,
            captchaData: statusData,
            message: 'Please solve the captcha and call /challans/submit',
        });

    } catch (error) {
        console.error('[getChallans] error:', error.message ?? error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

/**
 * POST /challans/submit
 * Step 3 — submit the captcha answer.
 * Step 4 — poll /challan/result/:jobId until the challan list is ready.
 * Stores results in DB and returns all challans for the vehicle.
 */
exports.submitChallan = async (req, res) => {
    try {
        const { userEmail, bikePlate, job_id, captcha_text } = req.body;

        if (!userEmail || !bikePlate || !job_id || !captcha_text)
            return res.status(400).json({
                success: false,
                message: 'userEmail, bikePlate, job_id, and captcha_text are all required',
            });

        const user = await getUserByEmail(userEmail);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });

        // ── 3. POST /challan/submit with job_id + captcha answer ─────────────
        await axios({
            ...buildConfig({ url: SUBMIT_PATH }),
            data: { job_id, captcha_text },
        });

        console.log(`[submitChallan] captcha submitted | job_id: ${job_id}`);

        // ── 4. Poll /challan/result/:job_id until result is ready ────────────
        const resultData = await pollUntilDone(
            RESULT_PATH,
            job_id,
            (data) => {
                const state = data?.state;
                console.log(
                    `[result poll] state: ${state} | keys: ${Object.keys(data ?? {}).join(', ')}`
                );
                // Keep polling while still processing
                if (state === 'pending' || state === 'processing') return false;
                // Any other state (done, completed, success, etc.) = finished
                return true;
            }
        );

        // ── 5. Normalise the challan list (handle various response shapes) ────
        const challanList = Array.isArray(resultData)
            ? resultData
            : Array.isArray(resultData?.challans)
                ? resultData.challans
                : Array.isArray(resultData?.data)
                    ? resultData.data
                    : [];

        const noChallanFound =
            challanList.length === 0 ||
            resultData?.message?.toLowerCase().includes('no challan');

        if (!noChallanFound) {
            // ── 5a. Upsert every challan into the DB ─────────────────────────
            const upsertOps = challanList.map((challan, index) => {
                const challanNo = extractChallanNo(challan, bikePlate, index);

                return Challan.findOneAndUpdate(
                    { challanNo },
                    {
                        $set: {
                            challanNo,
                            vehicleNo: bikePlate,
                            userId:    user.userId,
                            rawData:   challan,
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            });

            await Promise.all(upsertOps);
            console.log(`[submitChallan] ${challanList.length} challan(s) upserted`);
        }

        // ── 5b. Return all DB records for this vehicle ────────────────────────
        const allChallans = await Challan.find({ vehicleNo: bikePlate }).sort({ createdAt: -1 });

        return res.status(200).json({
            success:       true,
            noChallanFound,
            message:       noChallanFound
                ? 'No new challans found for this vehicle'
                : `${challanList.length} challan(s) saved`,
            challans:      allChallans,
        });

    } catch (error) {
        console.error('[submitChallan] error:', error.message ?? error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};