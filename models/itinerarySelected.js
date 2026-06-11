const mongoose = require('mongoose');

const selectedItinerarySchema = new mongoose.Schema(
    {
        user: {
            type: String,
            ref: "User",
            required: true,
            trim: true,
            lowercase: true
        },
        itinerary_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ItinerarySchema',
            required: true
        },
        itinerary_title: {
            type: String,
            required: true,
            trim: true
        },
        itineraryStatus: {
            type: String,
            enum: ['Selected', 'Completed', 'Expired'],
        }
    }, {
    timestamps: { createsdAt: 'created_at', updatedAt: 'updated_at' }
}
);

selectedItinerarySchema.index({ user: 1 });
selectedItinerarySchema.index({ itinerary_id: 1 });
selectedItinerarySchema.index({ user: 1, itinerary_id: 1 }, { unique: true });

module.exports = mongoose.model('SelectedItinerary', selectedItinerarySchema)
