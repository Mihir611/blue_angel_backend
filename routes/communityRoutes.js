const express = require('express');
const router = express.Router();
const communityCtrl = require('../controllers/communityController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/search', authMiddleware.authenticateToken, communityCtrl.searchCommunities);
router.get('/landing/featuredCommunities', communityCtrl.getCommunity);
router.get('/getApplications', authMiddleware.authenticateToken, communityCtrl.getApplications);
router.route('/').get(authMiddleware.authenticateToken, communityCtrl.getCommunity)
    .post(authMiddleware.authenticateToken, communityCtrl.RequestNewCommunity);
router.post('/:id/join', authMiddleware.authenticateToken, communityCtrl.CommunityJoin);
router.route('/:id').patch(authMiddleware.authenticateToken, communityCtrl.updateCommunity)
    .get(authMiddleware.authenticateToken, communityCtrl.getCommunityById)
    .delete(authMiddleware.authenticateToken, communityCtrl.deleteCommunity);

module.exports = router;