const mongoose = require('mongoose');

const ClubJoinRequestSchema = new mongoose.Schema({
    riderName: { type: String, required: true },
    riderEmail: { type: String, required: true },
    riderContactNumber: { type: String, required: true },
    riderAddress: {
        city: { type: String, required: [true, 'City is required'], trim: true, },
        state: { type: String, required: [true, 'State is required'], trim: true, },
        country: { type: String, required: [true, 'Country is required'], trim: true, },
    },
    bikeDetails: {
        make: { type: String, required: true },
        model: { type: String, required: true }
    },
    emergencyContact: {
        name: { type: String, required: true },
        number: { type: String, required: true },
    },
    JoiningClubDetails: {
        name: { type: String, required: true },
        clubId: { type: String, required: true }
    },
    hasApplication: { type: Boolean, default: false },
    status: {type: String, default: 'Requested', enum:['Joined', 'Requested', 'Ignored']}
});

ClubJoinRequestSchema.index({ 'location.city': 1, 'location.state': 1, 'location.country': 1 });
module.exports = mongoose.model("ClubRequest", ClubJoinRequestSchema);