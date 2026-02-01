const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { authenticate } = require('../middleware/auth');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('Warning: Cloudinary environment variables not configured');
}

// Get Cloudinary signature for direct browser upload (product photos)
router.post('/signature/photo', authenticate, async (req, res, next) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const { product_id } = req.body;

    const params = {
      timestamp,
      folder: 'warehouse/products',
      public_id: `product_${product_id}_${timestamp}`
    };

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      ...params
    });
  } catch (error) {
    next(error);
  }
});

// Get Cloudinary signature for shipping label PDF upload
router.post('/signature/label', authenticate, async (req, res, next) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const { inventory_item_id } = req.body;

    const params = {
      timestamp,
      folder: 'warehouse/labels',
      public_id: `label_${inventory_item_id}_${timestamp}`,
      resource_type: 'raw'
    };

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      ...params
    });
  } catch (error) {
    next(error);
  }
});

// Get Cloudinary signature for receiving photo upload
router.post('/signature/receiving', authenticate, async (req, res, next) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const { receiving_id } = req.body;

    const params = {
      timestamp,
      folder: 'warehouse/receiving',
      public_id: `receiving_${receiving_id}_${timestamp}`
    };

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      ...params
    });
  } catch (error) {
    next(error);
  }
});

// Get Cloudinary config for frontend
router.get('/config', async (req, res, next) => {
  try {
    res.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
