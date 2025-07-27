const express = require('express');
const router = express.Router();
const bikeController = require('../controllers/bikeController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticateToken, bikeController.GetUserBikes);
router.post('/', authMiddleware.authenticateToken, bikeController.AddUserBike);

module.exports = router;