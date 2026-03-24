const mongoose = require('mongoose');

const WaitlistSchema = mongoose.Schema({
    waitlistTitle: { type: String, required: true },
    userEmail: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    contactNumber: { type: Number, required: true, default: 0 },
    riderType: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("WaitList", WaitlistSchema);