const mongoose = require('mongoose');

const challanSchema = new mongoose.Schema({
    user: {
        type: String,
        ref: "User",
        required: true
    },

    challanNo: {
        type: String,
        required: true,
        unique: true,    // dedup key — prevents saving the same challan twice
        trim: true,
    },
    vehicleNo: {
        type: String,
        required: true,
        trim: true,
        index: true,    // queried on every result fetch: find({ vehicleNo })
    },

    // ── Full API response stored as-is — no field assumptions ────────────────
    rawData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
},
    {
        timestamps: true,    // createdAt / updatedAt added automatically
        strict: false,   // allows any extra top-level fields if needed later
    }
);

// Fetch all challans for a vehicle, newest first
challanSchema.index({ vehicleNo: 1, createdAt: -1 });

module.exports = mongoose.model('Callans', challanSchema);