const mongoose = require('mongoose');

const itineraryRequestSchema = new mongoose.Schema(
    {
        user: {
            type: String,
            ref: "User",
            required: true,
            trim: true,
            lowercase: true
        },
        rideType: {
            type: String,
            required: true,
            trim: true
        },
        rideSource: {
            type: String,
            required: true,
            trim: true
        },
        rideDestination: {
            type: String,
            required: true,
            trim: true
        },
        rideDuration: {
            type: Number,
            required: true,
            min: 1
        },
        locationPreference: {
            type: String,
            trim: true,
            default: ''
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending'
        }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
    }
);

itineraryRequestSchema.index({ user: 1 });
itineraryRequestSchema.index({ status: 1 });
itineraryRequestSchema.index({ rideSource: 1, rideDestination: 1 });

module.exports = mongoose.model('ItineraryRequest', itineraryRequestSchema);