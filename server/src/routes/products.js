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
        p.warehouse_notes,
        p.warehouse_condition,
        p.created_at,
        p.updated_at,
        json_agg(DISTINCT jsonb_build_object(
          'client_id', c.id,
          'client_code', c.client_code,
          'client_name', c.name,
          'sku', cpl.sku,
          'asin', cpl.asin,
          'fnsku', cpl.fnsku,
          'marketplace', m.code,
          'image_url', cpl.image_url
        )) FILTER (WHERE c.id IS NOT NULL) as client_listings,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type, 'source', pp.photo_source))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos
      FROM products p
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id
      LEFT JOIN clients c ON cpl.client_id = c.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE p.id = $1
      GROUP BY p.id, p.upc, p.title, p.warehouse_notes, p.warehouse_condition, p.created_at, p.updated_at
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get full product detail with observations and inventory summary
router.get('/:id/detail', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get product with warehouse observations
    const productResult = await db.query(`
      SELECT
        p.id,
        p.upc,
        p.title,
        p.warehouse_notes,
        p.warehouse_condition,
        p.created_at,
        p.updated_at
      FROM products p
      WHERE p.id = $1
    `, [id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get client listings
    const listingsResult = await db.query(`
      SELECT
        c.id as client_id,
        c.client_code,
        c.name as client_name,
        cpl.sku,
        cpl.asin,
        cpl.fnsku,
        cpl.image_url,
        m.code as marketplace
      FROM client_product_listings cpl
      JOIN clients c ON cpl.client_id = c.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE cpl.product_id = $1
    `, [id]);

    // Get photos (warehouse and listing)
    const photosResult = await db.query(`
      SELECT id, photo_url as url, photo_type as type, photo_source as source, uploaded_at
      FROM product_photos
      WHERE product_id = $1
      ORDER BY uploaded_at DESC
    `, [id]);

    // Separate photos by source
    const photos = {
      warehouse: photosResult.rows.filter(p => p.source === 'warehouse'),
      listing: photosResult.rows.filter(p => p.source === 'listing')
    };

    // Add client-provided listing images
    listingsResult.rows.forEach(listing => {
      if (listing.image_url) {
        photos.listing.push({
          url: listing.image_url,
          type: 'listing',
          source: 'client_import',
          client_code: listing.client_code
        });
      }
    });

    // Get inventory summary
    const inventoryResult = await db.query(`
      SELECT
        c.id as client_id,
        c.client_code,
        c.name as client_name,
        SUM(i.quantity)::integer as total_quantity,
        COUNT(i.id)::integer as item_count,
        COUNT(CASE WHEN i.condition = 'sellable' THEN 1 END)::integer as sellable_count,
        COUNT(CASE WHEN i.condition = 'damaged' THEN 1 END)::integer as damaged_count
      FROM inventory_items i
      JOIN clients c ON i.client_id = c.id
      WHERE i.product_id = $1
      GROUP BY c.id, c.client_code, c.name
    `, [id]);

    const totalQuantity = inventoryResult.rows.reduce((sum, r) => sum + (r.total_quantity || 0), 0);

    res.json({
      ...product,
      client_listings: listingsResult.rows,
      warehouse_observations: {
        notes: product.warehouse_notes,
        condition: product.warehouse_condition
      },
      photos,
      inventory_summary: {
        total_quantity: totalQuantity,
        by_client: inventoryResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update warehouse observations
router.patch('/:id/observations', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, condition } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (notes !== undefined) {
      updates.push(`warehouse_notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }

    if (condition !== undefined) {
      const validConditions = ['new', 'like_new', 'good', 'acceptable', 'damaged', null];
      if (!validConditions.includes(condition)) {
        return res.status(400).json({ error: 'Invalid condition', valid_conditions: validConditions });
      }
      updates.push(`warehouse_condition = $${paramIndex}`);
      params.push(condition);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await db.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      ...result.rows[0],
      warehouse_observations: {
        notes: result.rows[0].warehouse_notes,
        condition: result.rows[0].warehouse_condition
      }
    });
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
    const { photo_url, photo_type = 'main', photo_source = 'warehouse' } = req.body;

    if (!photo_url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    const result = await db.query(
      'INSERT INTO product_photos (product_id, photo_url, photo_type, photo_source) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, photo_url, photo_type, photo_source]
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
