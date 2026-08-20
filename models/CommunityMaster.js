const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
    communityName: { type: String, required: [true, 'Community name is required'], trim: true, unique: true, maxLength: 100, },
    email: { type: String, required: [true, 'Commander email is required'], trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'], },
    phoneNumber: {
        type: String, required: [true, 'Commander phone number is required'], trim: true,
        validate: {
            validator(value) {
                const normalized = value.replace(/[\s()-]/g, '');
                return /^\+?[0-9]{7,15}$/.test(normalized);
            },
            message: 'Invalid phone number',
        },
    },
    logo: { type: String, required: true },
    incorporationDate: { type: Date, required: [true, 'Incorporation date is required'], },
    description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 1000, },
    tagline: { type: String, trim: true, maxlength: 150, },
    instagramHandle: { type: String, trim: true, lowercase: true, set: (v) => (v ? v.replace(/^@/, '') : v), match: [/^[a-zA-Z0-9._]{1,30}$/, 'Invalid Instagram handle'], },
    location: {
        city: { type: String, required: [true, 'City is required'], trim: true, },
        state: { type: String, required: [true, 'State is required'], trim: true, },
        country: { type: String, required: [true, 'Country is required'], trim: true, },
    },
    general: {
        name: { type: String, required: [true, 'Commander name is required'], trim: true, },
        email: { type: String, required: [true, 'Commander email is required'], trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'], },
        phoneNumber: {
            type: String, required: [true, 'Commander phone number is required'], trim: true,
            validate: {
                validator(value) {
                    const normalized = value.replace(/[\s()-]/g, '');
                    return /^\+?[0-9]{7,15}$/.test(normalized);
                },
                message: 'Invalid phone number',
            },
        },
    },
    hasSubCommunities: { type: Boolean, default: false, },
    communityLevel: { type: Number, default: 1 }
});

communitySchema.index({ 'location.city': 1, 'location.state': 1, 'location.country': 1 });
communitySchema.index({ communityLevel: -1 });

module.exports = mongoose.model("Community", communitySchema);