const waitList = require('../models/waitlist');

exports.joinWaitlist = async (req, res) => {
    try {
        const { title, name, userEmail, contactNumber, riderType } = req.body;

        // ✅ Validate input
        if (!title || !name || !userEmail || !contactNumber) {
            return res.status(400).json({
                success: false,
                message: "Email, Name and phone number are required"
            });
        }

        // ✅ Check if already exists
        const list = await waitList.exists({ userEmail, title });
        if (list) {
            return res.status(409).json({
                success: false,
                message: "You are already on the waitlist"
            });
        }

        // ✅ Create new entry
        const newWaitlist = new waitList({
            waitlistTitle: title,
            userName: name,
            userEmail,
            contactNumber: contactNumber,
            riderType
        });

        await newWaitlist.save();

        // ✅ Send success response
        return res.status(200).json({
            success: true,
            message: "You have successfully entered the waiting room"
        });

    } catch (error) {
        console.log("Waitlist Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};