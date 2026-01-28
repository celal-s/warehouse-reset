const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const importService = require('../services/importService');
const activityService = require('../services/activityService');
const { authenticate, authorize } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Dashboard stats
router.get('/dashboard', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE status = 'awaiting_decision') as pending_decisions,
        COUNT(*) FILTER (WHERE status = 'decision_made') as decided,
        COUNT(*) FILTER (WHERE status = 'processed') as processed,
        COUNT(*) FILTER (WHERE condition = 'sellable') as sellable_items,
        COUNT(*) FILTER (WHERE condition = 'damaged') as damaged_items,
        SUM(quantity) as total_quantity
      FROM inventory_items
    `);

    const byClient = await db.query(`
      SELECT
        c.client_code,
        c.name,
        COUNT(i.id) as item_count,
        COUNT(i.id) FILTER (WHERE i.status = 'awaiting_decision') as pending
      FROM clients c
      LEFT JOIN inventory_items i ON c.id = i.client_id
      GROUP BY c.id, c.client_code, c.name
      ORDER BY c.client_code
    `);

    const productCount = await db.query('SELECT COUNT(*) as count FROM products');

    res.json({
      ...stats.rows[0],
      product_count: productCount.rows[0].count,
      by_client: byClient.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get activity log
router.get('/activity', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const activity = await activityService.getRecentActivity(parseInt(limit));
    res.json(activity);
  } catch (error) {
    next(error);
  }
});

// Storage locations CRUD
router.get('/locations', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        sl.*,
        COUNT(i.id) as item_count
      FROM storage_locations sl
      LEFT JOIN inventory_items i ON sl.id = i.storage_location_id
      GROUP BY sl.id
      ORDER BY sl.type, sl.label
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/locations', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { type, label } = req.body;

    if (!type || !label) {
      return res.status(400).json({ error: 'Type and label are required' });
    }

    const result = await db.query(
      'INSERT INTO storage_locations (type, label) VALUES ($1, $2) RETURNING *',
      [type, label]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Location label already exists' });
    }
    next(error);
  }
});

router.delete('/locations/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if location has items
    const itemCheck = await db.query(
      'SELECT COUNT(*) as count FROM inventory_items WHERE storage_location_id = $1',
      [id]
    );

    if (parseInt(itemCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete location with items',
        item_count: itemCheck.rows[0].count
      });
    }

    const result = await db.query('DELETE FROM storage_locations WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ message: 'Location deleted', location: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Import products from Excel
router.post('/import', authenticate, authorize('admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const { client_code, marketplace = 'us' } = req.body;

    if (!client_code) {
      return res.status(400).json({ error: 'Client code is required' });
    }

    const rows = importService.parseExcel(req.file.buffer);
    const result = await importService.importProducts(rows, client_code, marketplace);

    // Log activity (fire and forget)
    activityService.log(
      'import',
      null,
      'products_imported',
      'admin',
      'admin',
      { client_code, marketplace, ...result }
    ).catch(err => console.error('Activity log failed:', err));

    res.json({
      message: 'Import completed',
      rows_processed: rows.length,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// Get all products (for admin view)
router.get('/products', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT
        p.id,
        p.upc,
        p.title,
        p.created_at,
        json_agg(DISTINCT jsonb_build_object(
          'client_code', c.client_code,
          'sku', cpl.sku,
          'marketplace', m.code
        )) FILTER (WHERE c.id IS NOT NULL) as listings,
        (SELECT COUNT(*) FROM product_photos pp WHERE pp.product_id = p.id) as photo_count
      FROM products p
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id
      LEFT JOIN clients c ON cpl.client_id = c.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await db.query('SELECT COUNT(*) FROM products');

    res.json({
      products: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
});

// Get marketplaces
router.get('/marketplaces', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM marketplaces ORDER BY code');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
