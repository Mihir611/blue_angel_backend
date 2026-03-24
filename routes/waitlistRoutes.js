const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlistController');

router.post('/join', waitlistController.joinWaitlist);

module.exports = router;