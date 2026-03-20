const express = require('express');
const router = express.Router();
const bikeController = require('../controllers/bikeController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/getBikes', authMiddleware.authenticateToken, bikeController.GetUserBikes);
router.post('/addBike', authMiddleware.authenticateToken, bikeController.AddUserBike);
router.put('/updateBikeStatus', authMiddleware.authenticateToken, bikeController.UpdateBikeStatus);

module.exports = router;