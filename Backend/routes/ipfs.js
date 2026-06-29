const express = require('express');
const ipfsService = require('../services/ipfsService');
const multer = require('multer');
const { Readable } = require('stream');

const router = express.Router();
const upload = multer(); // For handling file uploads

/**
 * Error handling middleware
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('IPFS Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'IPFS_ERROR',
    });
  }
};

/**
 * POST /api/ipfs/upload-json
 * Upload JSON data to IPFS
 */
router.post('/upload-json', handleErrors(async (req, res) => {
  const { data, metadata } = req.body;
  
  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'Data object is required',
      code: 'VALIDATION_ERROR'
    });
  }

  const hash = await ipfsService.uploadJSON(data, { metadata });
  res.json({
    success: true,
    data: {
      hash,
      url: ipfsService.getGatewayUrl(hash)
    }
  });
}));

/**
 * POST /api/ipfs/upload-file
 * Upload a file to IPFS
 */
router.post('/upload-file', upload.single('file'), handleErrors(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      code: 'VALIDATION_ERROR'
    });
  }

  // Convert buffer to stream for Pinata
  const stream = Readable.from(req.file.buffer);
  stream.path = req.file.originalname; // Pinata uses .path for the filename

  const hash = await ipfsService.uploadFile(stream, req.file.originalname);
  res.json({
    success: true,
    data: {
      hash,
      url: ipfsService.getGatewayUrl(hash)
    }
  });
}));

/**
 * GET /api/ipfs/retrieve/:hash
 * Retrieve data from IPFS by hash
 */
router.get('/retrieve/:hash', handleErrors(async (req, res) => {
  const { hash } = req.params;
  const data = await ipfsService.retrieve(hash);
  res.json({ success: true, data });
}));

/**
 * POST /api/ipfs/pin/:hash
 * Pin an existing IPFS hash
 */
router.post('/pin/:hash', handleErrors(async (req, res) => {
  const { hash } = req.params;
  const { name } = req.body;
  
  await ipfsService.pinHash(hash, name);
  res.json({
    success: true,
    message: `Hash ${hash} pinned successfully`
  });
}));

/**
 * GET /api/ipfs/gateway/:hash
 * Get gateway URL for a hash
 */
router.get('/gateway/:hash', (req, res) => {
  const { hash } = req.params;
  res.json({
    success: true,
    data: {
      url: ipfsService.getGatewayUrl(hash)
    }
  });
});

module.exports = router;
