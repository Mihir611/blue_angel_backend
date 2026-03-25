const waitList = require('../models/waitlist');

exports.joinWaitlist = async (req, res) => {
    const { title, name, email, phone, riderType } = req.body;

    if (!title || !name || !email || !phone) {
        res.status(400).send({ success: false, message: "Email, FirstNAme, LastName and phone number fields are required" });

        try {
            const list = await waitList.exists({ userEmail: userEmail, title: title });
            if (list) {
                res.status(409).send({ status: false, message: "You are already on the waitlist" });
            }
            const newWaitlist = new waitList({
                title: title,
                userName: name,
                userEmail: email,
                contactNumber: Number(phone),
                riderType: riderType
            });
            await newWaitlist.save();
            res.status(200).send({ success: true, message: 'You have successfully enterd the waiting room' });
        } catch (error) {
            console.log("Waitlist Error:", error);
            res.status(500).send({ success: false, message: "Internal Server Error" });
        }
    }
}