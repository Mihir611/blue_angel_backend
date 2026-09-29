const mongoose = require('mongoose');

const communityMembershipSchema = new mongoose.Schema({
    userId: { type: String, required: true, ref: 'User' },
    communityId: { type: String, required: true, ref: 'Community' },
    roleInCommunity: {
        type: String,
        enum: ['Member', 'Moderator', 'Admin'],
        default: 'Member'
    },
    status: {
        type: String,
        enum: ['Active', 'Pending', 'Left', 'Removed'],
        default: 'Active'
    },
    joinedAt: { type: Date, default: Date.now },
}, { timestamps: true })

communityMembershipSchema.index({ userId: 1, communityId: 1 }, { unique: true });

// Fast lookups in both directions
communityMembershipSchema.index({ userId: 1, status: 1 });
communityMembershipSchema.index({ communityId: 1, status: 1 });

module.exports = mongoose.model('CommunityMembership', communityMembershipSchema);