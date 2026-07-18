const mongoose = require('mongoose');

const eventsSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    eventDate: { type: Date, required: true },
    location: { 
                city: {type: String, required: true, trim: true },
                state: { type: String, required: true, trim: true },
                country: { type: String, required: true, trim: true } 
        },
    address: { type: String, trim: true },
    category: {type: String, enum:['Adventure', 'hangout', 'breakfast-ride', 'lunch-ride', 'dinner-ride', 'touring', 'racing', 'other'], default: 'Adventure' },
    price: { type: Number, default: 0 },
    contactInfo: {
        email: { type: String, trim: true },
        phone: { type: String, trim: true }
    },
    tags: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
})

module.exports = mongoose.model('Events', eventsSchema);