const mongoose = require('mongoose');

const BikeSchema = new mongoose.Schema({
    bikeName: { type: String, required: true },
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    owner: {
        type: String,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Bike', BikeSchema);