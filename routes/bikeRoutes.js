const express = require('express');
const router = express.Router();
const bikeController = require('../controllers/bikeController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/getBikes', authMiddleware.authenticateToken, bikeController.GetUserBikes);
router.post('/addBike', authMiddleware.authenticateToken, bikeController.AddUserBike);
router.put('/updateBikeStatus', authMiddleware.authenticateToken, bikeController.UpdateBikeStatus);
router.get('/getBikeInfo', bikeController.FetchVehicleDetails);

module.exports = router;