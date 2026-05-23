const Challan = require('../models/challansMaster');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const axios = require('axios');

const START_PATH = 'challan/start';
const STATUS_PATH = 'challan/status/';
const SUBMIT_PATH = 'challan/submit';
const RESULT_PATH = 'challan/result/';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a base axios config pointing at the supporting API.
 * Throws early if the env var is missing so bugs surface clearly.
 */
function buildConfig(extraFields = {}) {
    const baseURL = process.env.SUPPORTING_APU_URL;           // FIX: was SUPPORTING_APU_URL
    if (!baseURL) throw new Error('SUPPORTING_API_URL env var is not set');

    return {
        method: 'POST',                                          // FIX: was 'metod'
        baseURL,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        ...extraFields,
    };
}

/**
 * Polls a GET endpoint every `intervalMs` ms until the callback
 * `isDone(responseData)` returns true, then resolves with the data.
 * Rejects after `maxAttempts` tries.
 */
function pollUntilDone(url, jobId, intervalMs = 5_000, maxAttempts = 36) {
    const baseURL = process.env.SUPPORTING_APU_URL;

    return new Promise((resolve, reject) => {
        let attempts = 0;

        const tick = async () => {
            attempts++;
            try {
                const res = await axios.get(`${baseURL}${url}${jobId}`, {
                    headers: { Accept: 'application/json' },
                });
                const data = res.data;
                // Keep polling while status is still pending / processing
                const state = data?.state;
                const captchaReady = data?.captcha_image_b64 !== null && data?.captcha_image_b64 !== undefined;
                console.log(`Attempt ${attempts} | state: ${state} | captcha: ${captchaReady}`);

                if (captchaReady) return resolve(data);  // ✅ got the image


                if (attempts >= maxAttempts)
                    return reject(new Error(`Polling timed out after ${attempts} attempts on ${url}`));

                if (state === 'pending' || state === 'processing') {
                    setTimeout(tick, intervalMs);  // 🔄 keep polling
                } else if (state === 'done') {
                    return resolve(data); 
                } else {
                    reject(new Error(`Unexpected state: ${state}`));  // ❌ failed/unknown state
                }
            } catch (err) {
                reject(err);
            }
        };

        setTimeout(tick, intervalMs); // first tick after one interval
    });
}

exports.getChallans = async (req, res) => {
    try {
        const { userEmail, bikePlate } = req.query;
        console.log(userEmail, bikePlate)
        if (!userEmail || !bikePlate) {
            return res.status(400).json({ success: false, message: 'userEmail and bikePlate is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // ── 1. Hit /challan/start to obtain a job_id ──────────────────────────
        const startResponse = await axios({
            ...buildConfig({ url: START_PATH }),
            data: { vehicle_no: bikePlate },
        });

        const { job_id } = startResponse.data;
        if (!job_id)
            return res.status(502).json({ success: false, message: 'Failed to get the job_id from challan service' });

        // ── 2. Poll /challan/status every 10 s until ready ───────────────────

        const statusData = await pollUntilDone(STATUS_PATH, job_id);
        return res.status(200).json({ success: true, captchaData: statusData, message: 'Please solve the captcha and call /challans/submit' });
    }
    catch (error) {
        console.error('Error in getChallans:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });

    }
}

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
        await axios({ ...buildConfig({ url: SUBMIT_PATH }), data: { job_id, captcha_text } });

        // ── 4. Poll /challan/result every 10 s until ready ───────────────────
        const resultData = await pollUntilDone(RESULT_PATH, job_id);
        const challanList = Array.isArray(resultData)
            ? resultData                          // [ {...}, {...} ]
            : Array.isArray(resultData?.challans)
                ? resultData.challans               // { challans: [...] }
                : Array.isArray(resultData?.data)
                    ? resultData.data                 // { data: [...] }
                    : [];                             // unknown shape → treat as empty

        const noChallanFound = challanList.length === 0 || resultData?.message?.toLowerCase().includes('no challan');

        if (!noChallanFound) {
            // ── 5a. Store every challan generically ──────────────────────────────
            // No field assumptions — the entire object goes into `rawData`.
            // Only challanNo, vehicleNo, userId are pulled out for indexing.
            const upsertOps = challanList.map((challan, index) => {
                const challanNo = extractChallanNo(challan, bikePlate, index);

                return Challan.findOneAndUpdate(
                    { challanNo },
                    {
                        $set: {
                            challanNo,               // indexed — used for dedup
                            vehicleNo: bikePlate,    // indexed — used for fetching all records
                            userId: user.userId,  // indexed — ownership
                            rawData: challan,      // full API object stored as-is, no field mapping
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            });
            await Promise.all(upsertOps);
        }

        // ── 5b. Return ALL challan records for this vehicle from our DB ───────
        const allChallans = await Challan.find({ vehicleNo: bikePlate }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            noChallanFound,
            message: noChallanFound
                ? 'No new challans found for this vehicle'
                : `${challanList.length} challan(s) saved`,
            challans: allChallans,
        });

    } catch (error) {
        console.error('Error in submitChallan:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}