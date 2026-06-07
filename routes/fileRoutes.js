const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const upload = require('../middleware/multer');

router.post('/uploadManual', upload.fields([{ name: 'file', maxCount: 1 }]), fileController.createManual);
router.get('/manuals/get', fileController.getUserManual)
module.exports = router;