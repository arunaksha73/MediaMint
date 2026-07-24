const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');
const validateUrl = require('../middleware/validateUrl');

// POST /api/download
router.post('/', validateUrl, downloadController.getMedia);

module.exports = router;