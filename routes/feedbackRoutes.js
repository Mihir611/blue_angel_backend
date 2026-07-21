const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const feedbackController = require('../controllers/feedbackController');

router.post('/giveFeedback', authMiddleware.authenticateToken, feedbackController.postFeedback);
router.get('/viewFeedbacks', authMiddleware.authenticateToken, feedbackController.getFeedback);
router.get('/getUnratedItineraries', authMiddleware.authenticateToken, feedbackController.getUnmarkedFeedbacks);

module.exports = router; 