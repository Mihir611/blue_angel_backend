const express = require('express');
const wetherController = require('../controllers/weatherConditionController');
const router = express.Router();

router.get('/getRideConditions', wetherController.getRideAndWeatherConditions);
module.exports = router;