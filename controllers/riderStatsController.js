const RiderStats = require("../models/RiderStats");
const {getUserByEmail} = require('../utils/getUserDetailsHelper');

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
        const stats = await RiderStats.findOne({ user: userId });
        if (!stats) {
            return res.status(404).json({ success: false, messsage: 'Rider Stats not found' });
        }
        res.status(200).json({ success: true, message: 'Rider stats found', data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
}

