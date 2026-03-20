const mongoose = require('mongoose');

const applicationFeedback = new mongoose.Schema({
    user: {
        type: String,
        ref: "User",
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: [true, 'App rating is required'],
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
        default: 0,
    },
    wouldRecommend: {
        type: Boolean,
        default: false,
    },
}, {timestamp: true});

module.exports = mongoose.model('AppFeedback', applicationFeedback);