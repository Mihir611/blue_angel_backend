const mongoose = require('mongoose');

const riderStatsSchema = new mongoose.Schema({
    user: {
        type: String,
        ref: "User",
        required: true,
        unique: true
    },

    ridesCompleted: {type: Number, default: 0},
    groupRidesCompleted: {type: Number, default: 0},
    soloRidesCompleted: {type: Number, default: 0},
    totalKmsDriven: {type: Number, default: 0},
    totalFuelConsumed: {type: Number, default: 0},
    longestRide: {type: Number, default: 0},
    totalRideMinutes: {type: Number, default: 0},
    avgMilage: {type: Number, default: 0}
}, {timestamps: true});

module.exports = mongoose.model("RideStats", riderStatsSchema);