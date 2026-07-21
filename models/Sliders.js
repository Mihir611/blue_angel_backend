const mongoose = require('mongoose');

const sliderSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    displayOrder: { type: Number, default: 0 },
    creationDate: {type: Date, default: new Date()},
    validTill: {type: Number, default: 5},
    isActive: { type: Boolean, default: true },
})

module.exports = mongoose.model('Sliders', sliderSchema);