const mongoose = require('mongoose');
const { UserAchievement, UserXp, XpTransaction } = require('../models/achievementsMaster');
const { ACHIEVEMENTS, ACHIEVEMENT_TYPES, getByType, getById } = require('../utils/achievementDefinations');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');

//#region Helpers
async function _getOrCreateXpDoc(userId, session) {
    let xpDoc = await UserXp.findOne({ user: userId }).session(session || null);
    if (!xpDoc) {
        [xpDoc] = await UserXp.create([{ user: userId }], { session });
    }
    return xpDoc;
}

async function _awardXp(userId, amount, reason, achievementId = null, session) {
    const xpDoc = await _getOrCreateXpDoc(userId, session);

    xpDoc.totalXp += amount;

    const { level, xpToNextLevel } = UserXp.computeLevel(xpDoc.totalXp);
    xpDoc.level = level;
    xpDoc.xpToNextLevel = xpToNextLevel;

    await xpDoc.save({ session });
    const [transaction] = await XpTransaction.create(
        [{
            user: userId,
            amount,
            reason,
            achievementId,
            balanceAfter: xpDoc.totalXp
        }], { session }
    );
    return { xpDoc, transaction };
}

async function _checkThresholds(userId, definations, currentValue) {
    const sorted = [...definations].sort((a, b) => a.threshold - b.threshold);

    const existing = await UserAchievement.find({
        user: userId,
        achievementId: { $in: sorted.map((d) => d.id) },
    }).select("achievementId");
    const alreadyEarned = new Set(existing.map((e) => e.achievementId));

    const unlocked = [];

    for (const def of sorted) {
        if (alreadyEarned.has(def.id)) continue;
        if (currentValue < def.threshold) continue;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const [badge] = await UserAchievement.create([
                {
                    user: userId,
                    achievementId: def.id,
                    snapshot: {
                        title: def.title,
                        description: def.description,
                        icon: def.icon,
                        category: def.category,
                        xp: def.xp,
                        rarity: def.rarity,

                    }
                }
            ], { session })

            await _awardXp(userId, def.xp, `Acievement unlocked: ${def.title}`, def.id, session);
            await UserXp.findOneAndUpdate({ user: userId }, { $inc: { achievementCount: 1 } }, { session });
            await session.commitTransaction();
            unlocked.push(badge);
        } catch (err) {
            await session.abortTransaction();
            if (err.code !== 11000) throw err;
        } finally {
            session.endSession();
        }
    }

    return unlocked;
}
//#endregion Helpers

//#region TRIGGER_CHECKERS
/**
 * Check distance-based achievements.
 * @param {ObjectId} userId
 * @param {number}   totalKm  - user's ALL-TIME total km
 */
exports.checkDistanceAchievements = async (userId, totalKm) => {
    const defs = getByType(ACHIEVEMENT_TYPES.DISTANCE);
    return _checkThresholds(userId, defs, totalKm);
};

/**
 * Check itinerary count achievements.
 * @param {ObjectId} userId
 * @param {number}   itineraryCount - total itineraries ever requested
 */
exports.checkItineraryAchievements = async (userId, itineraryCount) => {
    const defs = getByType(ACHIEVEMENT_TYPES.ITINERARY);
    return _checkThresholds(userId, defs, itineraryCount);
};

/**
 * Check ride count achievements.
 * @param {ObjectId} userId
 * @param {number}   rideCount
 */
exports.checkRideCountAchievements = async (userId, rideCount) => {
    const defs = getByType(ACHIEVEMENT_TYPES.RIDES);
    return _checkThresholds(userId, defs, rideCount);
};

/**
 * Check unique states visited achievements.
 * @param {ObjectId} userId
 * @param {number}   stateCount
 */
exports.checkStateAchievements = async (userId, stateCount) => {
    const defs = getByType(ACHIEVEMENT_TYPES.STATES_VISITED);
    return _checkThresholds(userId, defs, stateCount);
};

/**
 * Check riding streak achievements.
 * @param {ObjectId} userId
 * @param {number}   streakDays
 */
exports.checkStreakAchievements = async (userId, streakDays) => {
    const defs = getByType(ACHIEVEMENT_TYPES.STREAK);
    return _checkThresholds(userId, defs, streakDays);
};

/**
 * Check night-ride count achievements.
 * @param {ObjectId} userId
 * @param {number}   nightRideCount
 */
exports.checkNightRideAchievements = async (userId, nightRideCount) => {
    const defs = getByType(ACHIEVEMENT_TYPES.NIGHT_RIDE);
    return _checkThresholds(userId, defs, nightRideCount);
};

/**
 * Check elevation achievements.
 * @param {ObjectId} userId
 * @param {number}   totalElevationMetres
 */
exports.checkElevationAchievements = async (userId, totalElevationMetres) => {
    const defs = getByType(ACHIEVEMENT_TYPES.ELEVATION);
    return _checkThresholds(userId, defs, totalElevationMetres);
};

/**
 * Check fuel-stop achievements.
 * @param {ObjectId} userId
 * @param {number}   fuelStopCount
 */
exports.checkFuelAchievements = async (userId, fuelStopCount) => {
    const defs = getByType(ACHIEVEMENT_TYPES.FUEL_STOPS);
    return _checkThresholds(userId, defs, fuelStopCount);
};

/**
 * Check profile-completion achievements.
 * Call once when a user fully completes their profile.
 * @param {ObjectId} userId
 */
exports.checkProfileAchievements = async (userId) => {
    const defs = getByType(ACHIEVEMENT_TYPES.PROFILE);
    return _checkThresholds(userId, defs, 1);
};

/**
 * Award arbitrary bonus XP (e.g. for a special event or admin grant).
 * @param {ObjectId} userId
 * @param {number}   amount
 * @param {string}   reason
 */
exports.awardBonusXp = async (userId, amount, reason) => {
    return _awardXp(userId, amount, reason, null);
};

//#endregion TRIGGER_CHECKERS

//#region Handlers
exports.getAllAchievements = async (req, res) => {
    try {
        const { userEmail } = req.query;

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const earned = await UserAchievement.find({ user: user.userId }).select("achievementId unlockedAt seen");
        const earnedMap = new Map(earned.map((e) => [e.achievementId, e]));
        const result = ACHIEVEMENTS.map((def) => {
            const record = earnedMap.get(def.id);
            return {
                ...def,
                unlocked: !!record,
                unlockedAt: record?.unlockedAt ?? null,
                seen: record?.seen ?? false,
            }
        });

        const grouped = result.reduce((acc, a) => {
            if (!acc[a.category]) acc[a.category] = [];
            acc[a.category].push(a);
            return acc;
        }, {})

        res.status(200).json({ success: true, data: { total: ACHIEVEMENTS.length, unlocked: earned.length, grouped } })
    } catch (err) {
        console.log(err)
        res.status(500).json({ success: false, message: err.message });
    }
}

exports.getMyAchievements = async (req, res) => {
    try {
        const { userEmail } = req.query;

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const achievements = await UserAchievement.find({ user: user.userId }).sort({ unlockedAt: -1 }).lean();
        res.status(200).json({ success: true, data: achievements });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

exports.markAchievementsSeen = async (req, res) => {
    try {
        const { userEmail } = req.query;
        const { achievemets } = req.body;
        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }
        if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
            return res.status(400).json({ success: false, message: "achievementIds must be a non-empty array." });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await UserAchievement.updateMany({ user: user.userId, achievementId: { $in: achievementIds } },
            { $set: { seen: true } }
        );

        res.status(200).json({ success: true, message: "Achievements marked as seen" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

exports.getUnseenCount = async (req, res) => {
    try {
        const { userEmail } = req.query;
        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const count = await UserAchievement.countDocuments({ user: user.userId, seen: false });
        return res.status(200).json({ success: true, data: { unseenCount: count } });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

exports.getMyXp = async (req, res) => {
    try {
        const { userEmail } = req.query;
        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const xpDoc = await _getOrCreateXpDoc(user.userId);
        res.status(200).json({ success: true, data: xpDoc });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
}

exports.getXpHistory = async (req, res) => {
    try {
        const { userEmail } = req.query;
        const { page } = Math.max(1, parseInt(req.query) || 1);
        const { limit } = Math.max(50, parseInt(req.query) || 20);
        const skip = (page - 1) * limit;
        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const [transactions, total] = await Promise.all([(await XpTransaction.find({ user: user.userId })).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), XpTransaction.countDocuments({ user: user.userId })]);

        res.status(200).json({ success: true, data: { transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), } } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

exports.getLeaderBoard = async (req, res) => {
    try {
        const limit = Math.min(100, parseInt(req.query.limit) || 20);

        const leaders = (await UserXp.find()).sort({ totalXp: -1 }).limit(limit).populate("user", "name avatar username").lean();
        const result = leaders.map((entry, idx) => ({
            rank: idx + 1,
            userId: entry.user?._id,
            name: entry.user?.name,
            avatar: entry.user?.avatar,
            username: entry.user?.username,
            totalXp: entry.totalXp,
            level: entry.level,
            achievementCount: entry.achievementCount,

        }))

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.log(err)
        res.status(500).json({ success: false, message: err.message })
    }
} 