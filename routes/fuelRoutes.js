const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const fuelPriceGenerator = require('../controllers/fuelController');

router.get("/fuel-price", fuelPriceGenerator.getPrice);

module.exports = router;