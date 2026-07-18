const mongoose = require('mongoose');

const xpTransactionSchema = new mongoose.Schema({
    user: {
        type: String,
        ref: 'User',
        required: true,
        inex: true
    },
    amount: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    achievementId: {
        type: String,
        default: null
    },
    balanceAfter: {
        type: Number,
        required: true
    }
}, { timestamps: true })

const userAchievementSchema = new mongoose.Schema({
    user: {
        type: String,
        ref: 'User',
        required: true,
        inex: true
    },
    achievementId: {
        type: String,
        required: true,
        trim: true
    },
    snapshot: {
        title: String,
        description: String,
        icon: String,
        category: String,
        xp: Number,
        rarity: String,
    },
    unlockedAt: {
        type: Date,
        default: Date.now
    },
    seen: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

const userXpSchema = new mongoose.Schema({
    user: {
        type: String,
        ref: "User",
        required: true,
        unique: true,
    },
    totalXp: {
        type: Number,
        default: 0,
        min: 0
    },
    level: {
        type: Number,
        default: 1,
        min: 1
    },
    xpToNextLevel: {
        type: Number,
        default: 1,
        min: 1
    },
    achievementCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true })

xpTransactionSchema.index({ user: 1, createdAt: -1 })
userAchievementSchema.index({ user: 1, achievementId: 1 }, { unique: true }); //one achievement only once per user
userXpSchema.index({ totalXp: -1 }) //leaderboard sorting

/**
 * Derive level and XP thresholds from a raw XP total.
 *
 * Formula: level N requires N * 500 XP to reach.
 *   Level 1 →    0 XP
 *   Level 2 →  500 XP
 *   Level 3 → 1500 XP  (500 + 1000)
 *   Level 4 → 3000 XP  …
 *
 * @param {number} totalXp
 * @returns {{ level: number, xpToNextLevel: number }}
 */
userXpSchema.statics.computeLevel = function (totalXp) {
    let level = 1;
    let threshold = 0;

    while (true) {
        const nextThreshold = threshold + level * 500;
        if (totalXp < nextThreshold) break;
        threshold = nextThreshold;
        level++;
    }

    const nextThreshold = threshold + level * 500;
    return {
        level,
        xpToNextLevel: nextThreshold - totalXp,
    };
};

const XpTransaction  = mongoose.model("XpTransaction",  xpTransactionSchema);
const UserAchievement = mongoose.model("UserAchievement", userAchievementSchema);
const UserXp          = mongoose.model("UserXp",          userXpSchema);

module.exports = { XpTransaction, UserAchievement, UserXp };