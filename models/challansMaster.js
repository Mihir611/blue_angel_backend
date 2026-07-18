const mongoose = require('mongoose');

const challanItemsSchema = new mongoose.Schema({
    challanId: { type: String, trim: true },
    challanNo: { type: String, trim: true },
    // Challan Info
    challanDate: { type: Date },
    challanPlace: { type: String, trim: true },
    challanStatus: { type: String, trim: true },
    challanType: { type: String, trim: true },
    offenseDetails: { type: String, trim: true },
    state: { type: String, trim: true },
    rto: { type: String, trim: true },

    // Amount & Payment
    amount: { type: Number, default: 0 },
    paymentStatus: { type: String, trim: true },
    isAlreadyPaid: { type: Boolean, default: false },
    disposed: { type: Boolean, default: false },
    wasZeroAmount: { type: Boolean, default: false },

    // Court Details
    courtChallan: { type: Boolean, default: false },
    courtName: { type: String, default: null },
    courtAddress: { type: String, default: null },
    sentToRegCourt: { type: Boolean, default: false },
    sentToVirtualCourt: { type: Boolean, default: false },
}, { _id: false })

const challanSchema = new mongoose.Schema({
    user: {
        type: String,
        ref: "User",
        required: true
    },
    vehicleNo: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    lastChecked: { type: Date, default: null },
    challans: [challanItemsSchema],
    summary: {
        challanCount: {type: Number, default: 0},
        pendingCount: { type: Number, default: 0 },
        pendingAmount: { type: Number, default: 0 },
        paidCount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        disposedCount: { type: Number, default: 0 },
        disposedAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
    }
},
    {
        timestamps: true,    // createdAt / updatedAt added automatically
    }
);

// Fetch all challans for a vehicle, newest first
challanSchema.index({ vehicleNo: 1, createdAt: -1 });

module.exports = mongoose.model('Callans', challanSchema);