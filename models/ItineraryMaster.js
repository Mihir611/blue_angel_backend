const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema(
    {
        user: {
            type: String,
            ref: "User",
            required: true,
            trim: true,
            lowercase: true
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
        itinerary_request_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ItineraryRequest',
            required: true
        },
        itinerary_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Itinerary',
            default: null
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

masterSchema.index({ rideSource: 1, rideDestination: 1 });
masterSchema.index({ user: 1 });
masterSchema.index({ itinerary_request_id: 1 });
masterSchema.index({ itinerary_id: 1 });

module.exports = mongoose.model('ItineraryMasterSchema', masterSchema);