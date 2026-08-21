const express = require('express');
const router = express.Router();
const bloodRequestController = require('../controllers/bloodController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.authenticateToken, bloodRequestController.getAllBloodRequests);
router.get('/nearby', authMiddleware.authenticateToken, bloodRequestController.getNearbyBloodRequests);
router.get('/:requestId', authMiddleware.authenticateToken, bloodRequestController.getBloodRequest);

// router.use(authController.protect, authController.restrictTo('admin'));

router.post('/', authMiddleware.authenticateToken, bloodRequestController.createBloodRequest);
router.patch('/:requestId', authMiddleware.authenticateToken, bloodRequestController.updateBloodRequest);
router.delete('/:requestId', authMiddleware.authenticateToken, bloodRequestController.deleteBloodRequest);

module.exports = router;