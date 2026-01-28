const express = require('express');
const router = express.Router();
const db = require('../db');
const activityService = require('../services/activityService');
const { authenticate, authorize } = require('../middleware/auth');

// Get all inventory items (with optional filters)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { client_id, status, location_id, condition } = req.query;

    let sql = `
      SELECT
        i.id,
        i.quantity,
        i.condition,
        i.status,
        i.client_decision,
        i.decision_notes,
        i.created_at,
        i.updated_at,
        p.id as product_id,
        p.upc,
        p.title as product_title,
        c.id as client_id,
        c.client_code,
        c.name as client_name,
        sl.id as location_id,
        sl.type as location_type,
        sl.label as location_label,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (client_id) {
      sql += ` AND i.client_id = $${paramIndex}`;
      params.push(client_id);
      paramIndex++;
    }

    if (status) {
      sql += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (location_id) {
      sql += ` AND i.storage_location_id = $${paramIndex}`;
      params.push(location_id);
      paramIndex++;
    }

    if (condition) {
      sql += ` AND i.condition = $${paramIndex}`;
      params.push(condition);
      paramIndex++;
    }

    sql += ' ORDER BY i.created_at DESC';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get single inventory item
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        i.*,
        p.id as product_id,
        p.upc,
        p.title as product_title,
        c.id as client_id,
        c.client_code,
        c.name as client_name,
        sl.id as location_id,
        sl.type as location_type,
        sl.label as location_label,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        (SELECT json_agg(jsonb_build_object('id', cd.id, 'decision', cd.decision, 'shipping_label_url', cd.shipping_label_url, 'notes', cd.notes, 'decided_at', cd.decided_at))
         FROM client_decisions cd WHERE cd.inventory_item_id = i.id) as decision_history
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      WHERE i.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create inventory item (employee adds from scan)
router.post('/', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { product_id, client_id, storage_location_id, quantity, condition, new_location } = req.body;

    if (!product_id || !client_id) {
      return res.status(400).json({ error: 'Product ID and Client ID are required' });
    }

    if (quantity !== undefined && (isNaN(quantity) || quantity < 1)) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    let locationId = storage_location_id;

    // Create new location if provided
    if (new_location && new_location.type && new_location.label) {
      try {
        const locationResult = await db.query(
          'INSERT INTO storage_locations (type, label) VALUES ($1, $2) RETURNING id',
          [new_location.type, new_location.label]
        );
        locationId = locationResult.rows[0].id;
      } catch (err) {
        if (err.code === '23505') {
          // Location already exists, fetch it
          const existing = await db.query(
            'SELECT id FROM storage_locations WHERE label = $1',
            [new_location.label]
          );
          if (existing.rows.length > 0) {
            locationId = existing.rows[0].id;
          }
        } else {
          throw err;
        }
      }
    }

    const result = await db.query(`
      INSERT INTO inventory_items (product_id, client_id, storage_location_id, quantity, condition, status)
      VALUES ($1, $2, $3, $4, $5, 'awaiting_decision')
      RETURNING *
    `, [product_id, client_id, locationId, quantity || 1, condition || 'sellable']);

    // Log activity (fire and forget)
    activityService.log(
      'inventory_item',
      result.rows[0].id,
      'created',
      'employee',
      'warehouse',
      { product_id, client_id, quantity, condition, location_id: locationId }
    ).catch(err => console.error('Activity log failed:', err));

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update inventory item (location, quantity, condition)
router.patch('/:id', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { storage_location_id, quantity, condition, status } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (storage_location_id !== undefined) {
      updates.push(`storage_location_id = $${paramIndex}`);
      params.push(storage_location_id);
      paramIndex++;
    }

    if (quantity !== undefined) {
      updates.push(`quantity = $${paramIndex}`);
      params.push(quantity);
      paramIndex++;
    }

    if (condition !== undefined) {
      updates.push(`condition = $${paramIndex}`);
      params.push(condition);
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await db.query(
      `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete inventory item
router.delete('/:id', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM inventory_items WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ message: 'Inventory item deleted', item: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
