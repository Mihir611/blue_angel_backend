const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const riderStatsController = require('../controllers/riderStatsController');

router.get('/stats', authMiddleware.authenticateToken, riderStatsController.getRiderStats)

module.exports = router;