const mongoose = require('mongoose');

const applicationFeedback = new mongoose.Schema({
    user: {
        type: String,
        ref: "User",
        required: true
    },
    overallExp:{
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    navigation: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    performance: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    design: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    message: {
        type: String,
        trim: true,
        maxlength: [2000, 'Message cannot exceed 2000 characters'],
        required: [true, 'App feedback message is required'],
    },
}, {timestamp: true});

module.exports = mongoose.model('AppFeedback', applicationFeedback);