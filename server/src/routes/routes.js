const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');
const { validateUrl, rateLimiter } = require('../middleware/security');

// Apply rate limiter to all routes
router.use(rateLimiter);

// Metadata extraction endpoint
router.post('/metadata', validateUrl, downloadController.getMetadata);

// Job initiation endpoint
router.post('/download/prepare', validateUrl, downloadController.prepareDownload);

// Job status endpoint (polling fallback)
router.get('/download/status/:jobId', downloadController.getJobStatus);

// Real-time Job progress streaming endpoint (Server-Sent Events)
router.get('/download/events/:jobId', downloadController.streamJobProgress);

// File retrieval endpoint
router.get('/download/file/:jobId', downloadController.downloadFile);

// Job cancellation endpoint
router.post('/download/cancel/:jobId', downloadController.cancelDownload);

module.exports = router;
