const mongoose = require('mongoose');
const { customAlphabet } = require('nanoid');

const genrateRequestId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

const bloodRequestSchema = new mongoose.Schema({
    requestId: { type: String, required: true, unique: true, index: true, default: () => `BR${genrateRequestId()}` },
    patientName: { type: String, required: true, trim: true },
    bloodGroup: { type: String, required: true, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], index: true },
    unitsRequired: { type: Number, required: true, min: 1 },
    urgency: {
        type: String,
        enum: ['critical', 'urgent', 'normal'],
        default: 'normal',
        index: true
    },

    hospital: {
        name: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        state: { type: String, trim: true },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [lng, lat]
                required: true
            }
        }
    },

    contactNumber: {
        type: String,
        required: true,
        trim: true
    },

    alternateContactNumber: {
        type: String,
        trim: true
    },

    requiredBy: {
        type: Date,
        required: true
    },

    additionalNotes: {
        type: String,
        trim: true,
        maxlength: 500
    },

    status: {
        type: String,
        enum: ['active', 'fulfilled', 'expired', 'cancelled'],
        default: 'active',
        index: true
    },

    // admin who created/last touched this entry
    createdBy: {
        type: String,
    },

    updatedBy: {
        type: String,
        ref: 'User',
        default: null
    },

    respondersCount: {
        type: Number,
        default: 0
    }
},
    { timestamps: true }
)

bloodRequestSchema.index({ 'hospital.location': '2dsphere' });
bloodRequestSchema.index({ status: 1, bloodGroup: 1, urgency: 1, createdAt: -1 });
bloodRequestSchema.index({ 'hospital.city': 1, status: 1 });

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);