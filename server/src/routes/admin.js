const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const importService = require('../services/importService');
const activityService = require('../services/activityService');
const authService = require('../services/authService');
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
      totalItems: parseInt(stats.rows[0].total_items) || 0,
      pendingDecisions: parseInt(stats.rows[0].pending_decisions) || 0,
      decided: parseInt(stats.rows[0].decided) || 0,
      processed: parseInt(stats.rows[0].processed) || 0,
      sellableItems: parseInt(stats.rows[0].sellable_items) || 0,
      damagedItems: parseInt(stats.rows[0].damaged_items) || 0,
      totalQuantity: parseInt(stats.rows[0].total_quantity) || 0,
      totalProducts: parseInt(productCount.rows[0].count) || 0,
      activeClients: byClient.rows.filter(c => parseInt(c.item_count) > 0).length,
      itemsByClient: byClient.rows.map(c => ({
        clientCode: c.client_code,
        clientName: c.name,
        totalItems: parseInt(c.item_count) || 0,
        awaitingDecision: parseInt(c.pending) || 0,
        processed: (parseInt(c.item_count) || 0) - (parseInt(c.pending) || 0)
      }))
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
router.get('/locations', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
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

// ==================== DATABASE DIAGNOSTICS ====================

// Get product duplicate diagnostics
router.get('/diagnostics/duplicates', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // 1. Find duplicate UPCs
    const dupUpc = await db.query(`
      SELECT upc, COUNT(*) as count, array_agg(id ORDER BY id) as product_ids
      FROM products
      WHERE upc IS NOT NULL AND upc != ''
      GROUP BY upc
      HAVING COUNT(*) > 1
    `);

    // 2. Find products sharing same ASIN+client+marketplace
    const dupAsin = await db.query(`
      SELECT cpl.asin, cpl.client_id, cpl.marketplace_id,
             COUNT(DISTINCT cpl.product_id) as product_count,
             array_agg(DISTINCT cpl.product_id ORDER BY cpl.product_id) as product_ids
      FROM client_product_listings cpl
      WHERE cpl.asin IS NOT NULL
      GROUP BY cpl.asin, cpl.client_id, cpl.marketplace_id
      HAVING COUNT(DISTINCT cpl.product_id) > 1
    `);

    // 3. Count orphan products
    const orphans = await db.query(`
      SELECT COUNT(*) as count
      FROM products p
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id
      LEFT JOIN inventory_items i ON p.id = i.product_id
      WHERE cpl.id IS NULL AND i.id IS NULL
    `);

    res.json({
      duplicateUpcGroups: dupUpc.rows,
      duplicateAsinGroups: dupAsin.rows,
      orphanProductCount: parseInt(orphans.rows[0].count),
      summary: {
        duplicateUpcCount: dupUpc.rows.length,
        duplicateAsinCount: dupAsin.rows.length,
        orphanCount: parseInt(orphans.rows[0].count),
        hasIssues: dupUpc.rows.length > 0 || dupAsin.rows.length > 0 || parseInt(orphans.rows[0].count) > 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Cleanup duplicate products
router.post('/diagnostics/cleanup', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const results = { upcMerges: 0, orphansDeleted: 0, errors: [] };

    // 1. Merge UPC duplicates (keep lowest ID)
    await db.query(`
      CREATE TEMP TABLE IF NOT EXISTS product_merge_map AS
      WITH ranked AS (
          SELECT id, upc, ROW_NUMBER() OVER (PARTITION BY upc ORDER BY id) as rn
          FROM products
          WHERE upc IS NOT NULL AND upc != ''
            AND upc IN (SELECT upc FROM products WHERE upc IS NOT NULL AND upc != '' GROUP BY upc HAVING COUNT(*) > 1)
      )
      SELECT d.id as duplicate_id, c.id as canonical_id
      FROM ranked d
      JOIN ranked c ON d.upc = c.upc AND c.rn = 1
      WHERE d.rn > 1
    `);

    const mergeCount = await db.query('SELECT COUNT(*) FROM product_merge_map');

    if (parseInt(mergeCount.rows[0].count) > 0) {
      // Update inventory_items references
      await db.query(`
        UPDATE inventory_items SET product_id = m.canonical_id
        FROM product_merge_map m WHERE product_id = m.duplicate_id
      `);

      // Update product_photos references
      await db.query(`
        UPDATE product_photos SET product_id = m.canonical_id
        FROM product_merge_map m WHERE product_id = m.duplicate_id
      `);

      // Delete conflicting listings, then update remaining
      await db.query(`
        DELETE FROM client_product_listings cpl
        USING product_merge_map m
        WHERE cpl.product_id = m.duplicate_id
          AND EXISTS (SELECT 1 FROM client_product_listings e
                      WHERE e.product_id = m.canonical_id
                        AND e.client_id = cpl.client_id
                        AND e.marketplace_id = cpl.marketplace_id)
      `);

      await db.query(`
        UPDATE client_product_listings SET product_id = m.canonical_id
        FROM product_merge_map m WHERE product_id = m.duplicate_id
      `);

      // Delete duplicate products
      const deleteResult = await db.query(`
        DELETE FROM products WHERE id IN (SELECT duplicate_id FROM product_merge_map)
      `);
      results.upcMerges = deleteResult.rowCount;
    }

    await db.query('DROP TABLE IF EXISTS product_merge_map');

    // 2. Delete orphan products
    const orphanResult = await db.query(`
      DELETE FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM client_product_listings WHERE product_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM inventory_items WHERE product_id = p.id)
    `);
    results.orphansDeleted = orphanResult.rowCount;

    // Log activity
    activityService.log(
      'system',
      null,
      'duplicate_cleanup',
      'admin',
      req.user.email,
      results
    ).catch(err => console.error('Activity log failed:', err));

    res.json({
      message: 'Cleanup completed',
      ...results
    });
  } catch (error) {
    next(error);
  }
});

// ==================== USER MANAGEMENT ====================

// Get all users
router.get('/users', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.email, u.name, u.role, u.client_id, u.is_active, u.created_at,
             c.client_code, c.name as client_name
      FROM users u
      LEFT JOIN clients c ON u.client_id = c.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get single user
router.get('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT u.id, u.email, u.name, u.role, u.client_id, u.is_active, u.created_at,
             c.client_code, c.name as client_name
      FROM users u
      LEFT JOIN clients c ON u.client_id = c.id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create new user (admin only)
router.post('/users', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { email, password, name, role, client_code } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }

    // Validate role
    const validRoles = ['admin', 'employee', 'client'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    let clientId = null;

    // For client role, validate client_code
    if (role === 'client') {
      if (!client_code) {
        return res.status(400).json({ error: 'Client code is required for client role' });
      }

      const clientResult = await db.query(
        'SELECT id FROM clients WHERE client_code = $1',
        [client_code]
      );

      if (clientResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid client code' });
      }

      clientId = clientResult.rows[0].id;
    }

    // Hash password
    const hashedPassword = await authService.hashPassword(password);

    // Create user
    const result = await db.query(`
      INSERT INTO users (email, password_hash, name, role, client_id, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, email, name, role, client_id, is_active, created_at
    `, [email, hashedPassword, name, role, clientId]);

    const newUser = result.rows[0];

    // Log activity
    activityService.log(
      'user',
      newUser.id,
      'user_created',
      'admin',
      req.user.email,
      { email: newUser.email, role: newUser.role }
    ).catch(err => console.error('Activity log failed:', err));

    res.status(201).json({
      ...newUser,
      client_code: role === 'client' ? client_code : null
    });
  } catch (error) {
    next(error);
  }
});

// Update user (name, role, is_active)
router.patch('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, is_active, client_code } = req.body;

    // Prevent admin from deactivating themselves
    if (parseInt(id) === req.user.id && is_active === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (role !== undefined) {
      const validRoles = ['admin', 'employee', 'client'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }

    // Handle client_id update
    if (client_code !== undefined) {
      if (client_code === null || client_code === '') {
        updates.push(`client_id = NULL`);
      } else {
        const clientResult = await db.query(
          'SELECT id FROM clients WHERE client_code = $1',
          [client_code]
        );
        if (clientResult.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid client code' });
        }
        updates.push(`client_id = $${paramIndex}`);
        params.push(clientResult.rows[0].id);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(id);

    const result = await db.query(`
      UPDATE users SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, client_id, is_active, created_at
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get client_code if applicable
    const user = result.rows[0];
    if (user.client_id) {
      const clientResult = await db.query(
        'SELECT client_code FROM clients WHERE id = $1',
        [user.client_id]
      );
      user.client_code = clientResult.rows[0]?.client_code;
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Reset user password
router.post('/users/:id/reset-password', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await authService.hashPassword(password);

    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log activity
    activityService.log(
      'user',
      parseInt(id),
      'password_reset',
      'admin',
      req.user.email,
      { target_user_email: result.rows[0].email }
    ).catch(err => console.error('Activity log failed:', err));

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete (deactivate) user
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deactivated', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
