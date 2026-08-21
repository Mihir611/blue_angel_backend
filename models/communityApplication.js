const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const communityApplicationSchema = new mongoose.Schema({
    applicationId: { type: String, unique: true, default: () => `MotonomaadCommApp${nanoid(10)}` },
    applicantUserId: { type: String, required: true },

    // same shape as what Community will eventually need
    communityName: { type: String, required: true, trim: true, maxLength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
    phoneNumber: {
        type: String, required: true, trim: true,
        validate: {
            validator(value) {
                const normalized = value.replace(/[\s()-]/g, '');
                return /^\+?[0-9]{7,15}$/.test(normalized);
            },
            message: 'Invalid phone number',
        },
    },
    logo: { type: String, required: true },
    incorporationDate: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    location: {
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        country: { type: String, required: true, trim: true },
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

    reviewedBy: { type: String, default: null },   // platform owner's userId
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
}, { timestamps: true });

communityApplicationSchema.index({ status: 1 });
communityApplicationSchema.index({ applicantUserId: 1 });

module.exports = mongoose.model('CommunityApplication', communityApplicationSchema);