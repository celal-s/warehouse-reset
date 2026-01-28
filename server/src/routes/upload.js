const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Get Cloudinary signature for direct browser upload (product photos)
router.post('/signature/photo', (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const { product_id } = req.body;

  const params = {
    timestamp,
    folder: 'warehouse/products',
    public_id: `product_${product_id}_${timestamp}`,
    transformation: 'c_limit,w_1200,h_1200,q_auto'
  };

  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

  res.json({
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    ...params
  });
});

// Get Cloudinary signature for shipping label PDF upload
router.post('/signature/label', (req, res) => {
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
});

// Get Cloudinary config for frontend
router.get('/config', (req, res) => {
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY
  });
});

module.exports = router;
