const mongoose = require('mongoose');

const BikeSchema = new mongoose.Schema({
    bikeName: { type: String, required: true, unique: true },
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    KmsDriven: { type: Number, default: 0 },
    owner: {
        type: String,
        ref: 'User',
        required: true
    },
    odoStatus: { type: String, enum: ['processing', 'done', 'failed'], default: 'processing' },
    bikeStatus: { type: String, enum: ['primary', 'inUse', 'sold', 'inactive', 'underMaintainance'], default: 'primary' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Bike', BikeSchema);