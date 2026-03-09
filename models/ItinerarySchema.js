const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
    {
        time: { type: String, required: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        location: { type: String, trim: true },
        duration_minutes: { type: Number, min: 0 }
    },
    { _id: false }
);

const daySchema = new mongoose.Schema(
    {
        day: { type: Number, required: true, min: 1 },
        date: { type: Date, required: true },
        activities: { type: [activitySchema], default: [] }
    },
    { _id: false }
);

const itinerarySchema = new mongoose.Schema(
    {
        request_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ItineraryRequest',
            required: true
        },
        rideSource: { type: String, required: true, trim: true },
        rideDestination: { type: String, required: true, trim: true },
        days: { type: [daySchema], default: [] },

        // Gemini-generated metadata
        meta: {
            title: { type: String },
            theme: { type: String },
            overview: { type: mongoose.Schema.Types.Mixed, default: {} }
        }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
    }
);

itinerarySchema.index({ request_id: 1 });
itinerarySchema.index({ rideSource: 1, rideDestination: 1 });

module.exports = mongoose.model('ItinerarySchema', itinerarySchema);