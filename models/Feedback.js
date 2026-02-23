const mongoose = require('mongoose');

const appFeedbackSchema = new mongoose.Schema(
    {
        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: [true, 'App rating is required'],
        },
        category: {
            type: String,
            enum: ['bug', 'feature_request', 'general', 'complaint', 'praise'],
            default: 'general',
        },
        message: {
            type: String,
            trim: true,
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
            required: [true, 'App feedback message is required'],
        },
        easeOfUse: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
        wouldRecommend: {
            type: Boolean,
            default: null,
        },
    },
    { _id: false } // no separate _id for sub-documents
);

const itineraryFeedbackSchema = new mongoose.Schema(
    {
        itineraryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Itinerary',
            required: [true, 'Itinerary ID is required'],
        },
        itineraryTitle: {
            type: String,
            trim: true,
            required: [true, 'Itinerary title is required'],
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
            default: null,
        },
    },
    { _id: false }
);

const feedbackSchema = new mongoose.Schema(
    {
        userEmail: {
            type: String,
            required: [true, 'User email is required'],
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
        },
        status: {
            type: String,
            enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
            default: 'pending',
        },
        appFeedback: {
            type: appFeedbackSchema,
            required: [true, 'App feedback is required'],
        },
        itineraryFeedback: {
            type: itineraryFeedbackSchema,
            required: [true, 'Itinerary feedback is required'],
        },
        metadata: {
            userAgent: String,
            ipAddress: String,
            page: String,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
feedbackSchema.index({ userEmail: 1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ 'itineraryFeedback.itineraryId': 1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;