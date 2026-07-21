const express = require('express');
const router = express.Router();
const bikeController = require('../controllers/bikeController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/multer');

router.get('/getBikes', authMiddleware.authenticateToken, bikeController.GetUserBikes);
router.post('/addBike', authMiddleware.authenticateToken, bikeController.AddUserBike);
router.put('/updateBikeStatus', authMiddleware.authenticateToken, bikeController.UpdateBikeStatus);
router.get('/getBikeInfo', bikeController.FetchVehicleDetails);
router.post('/uploadServiceBill', authMiddleware.authenticateToken, upload.fields([
    { name: 'serviceBill', maxCount: 1 },
    { name: 'odometerImage', maxCount: 1 },
    { name: 'partsBills', maxCount: 5 },
]), bikeController.CreateMaintenanceRecord);

module.exports = router;