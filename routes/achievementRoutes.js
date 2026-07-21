const express = require('express');
const router = express.Router();
const controller = require('../controllers/achievementController');
const authMiddleware = require('../middleware/authMiddleware');

router.get("/allAchievements",controller.getAllAchievements);
router.get("/myAchievements", controller.getMyAchievements);
router.get("/unseen-count", controller.getUnseenCount);
router.patch("/seen", controller.markAchievementsSeen);
router.get("/myXP", controller.getMyXp);
router.get("/myXP-history", controller.getXpHistory);
router.get("/leaderboard", controller.getLeaderBoard);

module.exports = router;