const mongoose = require('mongoose');

const SERVICE_TYPES = ['selfService', 'dealershipService', 'thirdPartService'];

const MaintenanceRecordSchema = new mongoose.Schema({
    userId: {type: String, ref: 'User', required: true},
    bikeId: {type:mongoose.Schema.Types.ObjectId, ref: 'Bike', required: true},
    serviceType: {type: String, enum: SERVICE_TYPES},
    serviceDate: {type: Date},
    odometerReading: {type: Number},
    cost: {type: Number},
    billNumber: {type: String},
    billImageUrls: { type: [String], required: true },
    odometerImageUrl: { type: String },
    partsBillUrls: { type: [String] },
    notes: {type: String}
}, {timestamps: true});

module.exports = mongoose.model('MaintenanceRecord', MaintenanceRecordSchema);
module.exports.SERVICE_TYPES = SERVICE_TYPES