const express = require('express');
const router = express.Router();
const db = require('../db');
const searchService = require('../services/searchService');
const { authenticate, authorize } = require('../middleware/auth');

// Search products (by UPC, SKU, ASIN, FNSKU, or title)
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, client_id } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const products = await searchService.searchProducts(q, client_id);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// Scan UPC (exact match for barcode scanning)
router.get('/scan/:upc', authenticate, async (req, res, next) => {
  try {
    const { upc } = req.params;
    const product = await searchService.searchByUPC(upc);

    if (!product) {
      return res.status(404).json({ error: 'Product not found', upc });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Get product by ID with all details
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT
        p.id,
        p.upc,
        p.title,
        json_agg(DISTINCT jsonb_build_object(
          'client_id', c.id,
          'client_code', c.client_code,
          'client_name', c.name,
          'sku', cpl.sku,
          'asin', cpl.asin,
          'fnsku', cpl.fnsku,
          'marketplace', m.code
        )) FILTER (WHERE c.id IS NOT NULL) as client_listings,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos
      FROM products p
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id
      LEFT JOIN clients c ON cpl.client_id = c.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create a new product
router.post('/', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { upc, title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await db.query(
      'INSERT INTO products (upc, title) VALUES ($1, $2) RETURNING *',
      [upc, title]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Add photo to product
router.post('/:id/photos', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { photo_url, photo_type = 'main' } = req.body;

    if (!photo_url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    const result = await db.query(
      'INSERT INTO product_photos (product_id, photo_url, photo_type) VALUES ($1, $2, $3) RETURNING *',
      [id, photo_url, photo_type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Check if product has photos
router.get('/:id/has-photos', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT COUNT(*) > 0 as has_photos FROM product_photos WHERE product_id = $1',
      [id]
    );
    res.json({ has_photos: result.rows[0].has_photos });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
