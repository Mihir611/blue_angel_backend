const mongoose = require('mongoose');

const itineraryFeedbackSchema = new mongoose.Schema({
    user: {
        type: String,
        ref: "User",
        required: true
    },
    itineraryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Itinerary',
        required: [true, 'Itinerary ID is required'],
    },
    itineraryTitle: {
        type: String,
        trim: true,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: [true, 'Itinerary rating is required'],
    },
    message: {
        type: String,
        trim: true,
        maxlength: [2000, 'Message cannot exceed 2000 characters'],
        required: [true, 'Itinerary feedback message is required'],
    },
    highlights: {
        type: [String], // things they loved about the itinerary
        default: [],
    },
    improvements: {
        type: [String], // things they'd change
        default: [],
    },
    wouldFollow: {
        type: Boolean, // would they follow this itinerary again?
        default: false,
    },
    accuracy: {
        type: Number,
        min: 1,
        max: 5,
        default: 0
    },
    roadQuality: {
        type: Number,
        min: 1,
        max: 5,
        default: 0
    },
    sceneryRating: {
        type: Number,
        min: 1,
        max: 5,
        default: 0
    },
    navigationEase: {
        type: Number,
        min: 1,
        max: 5,
        default: 0
    },

    actualDuration: Number,

    completedItinerary: Boolean,

    favoriteStop: String,

    safetyRating: {
        type: Number,
        min: 1,
        max: 5,
        default: 0
    },
}, {timestamp: true});

module.exports = mongoose.model('ItineraryFeedback', itineraryFeedbackSchema);