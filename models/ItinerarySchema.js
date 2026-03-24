const mongoose = require('mongoose');

const bookingInfoSchema = new mongoose.Schema(
    {
        contact_phone: { type: String, trim: true, default: null },
        contact_email: { type: String, trim: true, default: null },
        website:       { type: String, trim: true, default: null },
        advance_booking_days: { type: Number, min: 0, default: null },
        notes:         { type: String, trim: true, default: null }
    },
    { _id: false }
);

const coordinatesSchema = new mongoose.Schema(
    {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    { _id: false }
);

const activitySchema = new mongoose.Schema(
    {
        time:             { type: String, required: true },
        title:            { type: String, required: true, trim: true },
        description:      { type: String, trim: true, default: '' },
        location:         { type: String, trim: true, default: '' },
        coordinates:      { type: coordinatesSchema, default: null },
        duration_minutes: { type: Number, min: 0, default: 60 },
        entry_fee:        { type: String, trim: true, default: 'Free' },
        booking_required: { type: Boolean, default: false },
        booking_info:     { type: bookingInfoSchema, default: null }
    },
    { _id: false }
);

const daySchema = new mongoose.Schema(
    {
        day:        { type: Number, required: true, min: 1 },
        date:       { type: Date, required: true },
        title:      { type: String, trim: true, default: '' },
        route:      { type: String, trim: true, default: '' },
        distance:   { type: String, trim: true, default: '' },
        coordinates: {
            start: { type: coordinatesSchema, default: null },
            end:   { type: coordinatesSchema, default: null }
        },
        activities:    { type: [activitySchema], default: [] },
        accommodation: { type: String, trim: true, default: '' },
        meals:         { type: String, trim: true, default: '' },
        budget:        { type: String, trim: true, default: '' },
        highlights:    { type: [String], default: [] }
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