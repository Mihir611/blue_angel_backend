const Challan = require('../models/challansMaster');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const axios = require('axios');

const CACHE_TTL_DAYS = 5;
const DB_TTL_DAYS = 20;

function daysSince(data) {
    return (Date.now() - new Date(data).getTime()) / (1000 * 60 * 60 * 24);
}

async function fetchFromUpstream(bikePlate) {
    const config = {
        method: 'POST',
        url: process.env.SUPPORTING_CHALLAN_URL,
        headers: {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Origin": "https://vahandetails.com",
            "Referer": "https://vahandetails.com/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "x-api-key": process.env.VAHAN_API_KEY || "Test_1234",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0",
        },
        data: { rc_number: bikePlate }
    };
    const { data } = await axios.request(config);
    return data;
}

function mapChallans(challans) {
    return challans.map(c => ({
        challanId: c._id,
        challanNo: c.challanNumber,
        challanDate: c.challanDate,
        challanPlace: c.challanPlace,
        challanStatus: c.challanStatus,
        challanType: c.challanType,
        offenseDetails: c.offenseDetails,
        state: c.state,
        rto: c.rto,
        amount: c.amount,
        paymentStatus: c.paymentStatus,
        isAlreadyPaid: c.isAlreadyPaid,
        disposed: c.disposed,
        wasZeroAmount: c.wasZeroAmount,
        courtChallan: c.courtChallan,
        courtName: c.courtName,
        courtAddress: c.courtAddress,
        sentToRegCourt: c.sentToRegCourt,
        sentToVirtualCourt: c.sentToVirtualCourt,
    }))
}

exports.getChallans = async (req, res) => {
    const { userEmail, bikePlate } = req.query;

    if (!userEmail) {
        return res.status(400).json({ success: false, message: 'User email is required' });
    }
    if (!bikePlate) {
        return res.status(400).json({ success: false, message: 'Bike Plate is required' });
    }

    const user = await getUserByEmail(userEmail);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    try {
        const existing = await Challan.findOne({ user: userEmail, vehicleNo: bikePlate });

        if (existing?.lastChecked) {
            const age = daysSince(existing.lastChecked);

            if (age < CACHE_TTL_DAYS) {
                return res.status(200).json({
                    success: true,
                    source: 'cache',
                    lastChecked: existing.lastChecked,
                    data: { challans: existing.challans, summary: existing.summary }
                });
            }

            if (age < DB_TTL_DAYS) {
                return res.status(200).json({
                    success: true,
                    source: 'db',
                    lastChecked: existing.lastChecked,
                    data: { challans: existing.challans, summary: existing.summary }
                });
            }
        }

        // Over 20 days or no record — hit upstream
        const apiResponse = await fetchFromUpstream(bikePlate);
        const challans = apiResponse?.data ?? [];
        const summary = apiResponse?.summary ?? {};
        const mergedChallans = mergeChallans(incomingChallans, existing?.challans ?? []);

        await Challan.findOneAndUpdate(
            { user: userEmail, vehicleNo: bikePlate },
            {
                $set: {
                    lastChecked: new Date(),
                    challans: mergedChallans,
                    summary: {
                        challanCount: mergedChallans.length,        // total including history
                        pendingCount: summary.pendingCount ?? 0,
                        pendingAmount: summary.pendingAmount ?? 0,
                        paidCount: summary.paidCount ?? 0,
                        paidAmount: summary.paidAmount ?? 0,
                        disposedCount: summary.disposedCount ?? 0,
                        disposedAmount: summary.disposedAmount ?? 0,
                        totalAmount: summary.totalAmount ?? 0,
                    },
                }
            },
            { upsert: true, new: true }
        )
        return res.status(200).json({
            success: true,
            source: 'api',
            lastChecked: new Date(),
            data: {
                challans: mergedChallans,
                summary: {
                    challanCount: mergedChallans.length,
                    pendingCount: summary.pendingCount ?? 0,
                    pendingAmount: summary.pendingAmount ?? 0,
                    paidCount: summary.paidCount ?? 0,
                    paidAmount: summary.paidAmount ?? 0,
                    disposedCount: summary.disposedCount ?? 0,
                    disposedAmount: summary.disposedAmount ?? 0,
                    totalAmount: summary.totalAmount ?? 0,
                }
            }
        });
    } catch (error) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;
        return res.status(status).json({ success: false, message });
    }
}