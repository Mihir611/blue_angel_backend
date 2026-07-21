const RiderStats = require("../models/RiderStats");
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const { UserAchievement, UserXp } = require('../models/achievementsMaster');

exports.getRiderStats = async (req, res) => {
    try {
        const { userEmail } = req.query;
        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'Users Email is required' });
        }
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const userId = user.userId;
        const [stats, achievements, xpInfo] = await Promise.all([
            RiderStats.findOne({ user: userId }),
            UserAchievement.find({ user: userId }).sort({ unlockedAt: -1 }).lean(),
            UserXp.findOne({ user: userId })
        ]);
        if (!stats) {
            return res.status(404).json({ success: false, messsage: 'Rider Stats not found' });
        }
        const responseData = {
            ...stats.toObject(),
            achievements: achievements ?? [],
            xp: xpInfo ?? null
        };
        res.status(200).json({ success: true, message: 'Rider stats found', data: responseData });
    } catch (error) {
        console.log(err)
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
}

