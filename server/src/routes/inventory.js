const express = require('express');
const router = express.Router();
const db = require('../db');
const activityService = require('../services/activityService');
const inventoryService = require('../services/inventoryService');
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
        COALESCE(i.received_at, i.created_at) as received_at,
        COALESCE(i.condition_notes, '') as condition_notes,
        COALESCE(i.lot_number, '') as lot_number,
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
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type, 'source', COALESCE(pp.photo_source, 'warehouse')))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        (SELECT json_agg(jsonb_build_object('id', ip.id, 'url', ip.photo_url, 'type', ip.photo_type, 'notes', ip.notes))
         FROM inventory_photos ip WHERE ip.inventory_item_id = i.id) as inventory_photos,
        COALESCE(
          (SELECT pp.photo_url FROM product_photos pp WHERE pp.product_id = p.id ORDER BY pp.uploaded_at DESC LIMIT 1),
          (SELECT CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END FROM client_product_listings cpl LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id WHERE cpl.product_id = p.id AND cpl.client_id = c.id LIMIT 1)
        ) as display_image_url,
        (SELECT CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END FROM client_product_listings cpl LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id WHERE cpl.product_id = p.id AND cpl.client_id = c.id LIMIT 1) as amazon_url
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
        i.id,
        i.product_id,
        i.client_id,
        i.storage_location_id,
        i.quantity,
        i.condition,
        i.status,
        i.client_decision,
        i.decision_notes,
        COALESCE(i.received_at, i.created_at) as received_at,
        COALESCE(i.condition_notes, '') as condition_notes,
        COALESCE(i.lot_number, '') as lot_number,
        i.created_at,
        i.updated_at,
        p.id as product_id,
        p.upc,
        p.title as product_title,
        COALESCE(p.warehouse_notes, '') as warehouse_notes,
        COALESCE(p.warehouse_condition, '') as warehouse_condition,
        c.id as client_id,
        c.client_code,
        c.name as client_name,
        sl.id as location_id,
        sl.type as location_type,
        sl.label as location_label,
        CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END as listing_image_url,
        CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END as amazon_url,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type, 'source', COALESCE(pp.photo_source, 'warehouse')))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        (SELECT json_agg(jsonb_build_object('id', ip.id, 'url', ip.photo_url, 'type', ip.photo_type, 'notes', ip.notes, 'uploaded_at', ip.uploaded_at))
         FROM inventory_photos ip WHERE ip.inventory_item_id = i.id) as inventory_photos,
        COALESCE(
          (SELECT pp.photo_url FROM product_photos pp WHERE pp.product_id = p.id ORDER BY pp.uploaded_at DESC LIMIT 1),
          CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END
        ) as display_image_url,
        (SELECT json_agg(jsonb_build_object('id', cd.id, 'decision', cd.decision, 'shipping_label_url', cd.shipping_label_url, 'notes', cd.notes, 'decided_at', cd.decided_at))
         FROM client_decisions cd WHERE cd.inventory_item_id = i.id) as decision_history,
        (SELECT json_agg(jsonb_build_object(
          'id', ih.id,
          'action', ih.action,
          'field_changed', ih.field_changed,
          'old_value', ih.old_value,
          'new_value', ih.new_value,
          'quantity_change', ih.quantity_change,
          'changed_at', ih.changed_at,
          'reason', ih.reason
        ) ORDER BY ih.changed_at DESC)
         FROM inventory_history ih WHERE ih.inventory_item_id = i.id) as history
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      LEFT JOIN client_product_listings cpl ON cpl.product_id = p.id AND cpl.client_id = c.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
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

// Receive inventory (primary way to add stock)
router.post('/receive', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { product_id, client_id, quantity, condition, storage_location_id, notes, lot_number, new_location } = req.body;

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

    const inventoryItem = await inventoryService.receiveInventory({
      productId: product_id,
      clientId: client_id,
      quantity: quantity || 1,
      condition: condition || 'sellable',
      storageLocationId: locationId,
      notes,
      lotNumber: lot_number,
      userId: req.user?.id
    });

    // Log activity
    activityService.log(
      'inventory_item',
      inventoryItem.id,
      'received',
      'employee',
      req.user?.name || 'warehouse',
      { product_id, client_id, quantity, condition, location_id: locationId }
    ).catch(err => console.error('Activity log failed:', err));

    res.status(201).json(inventoryItem);
  } catch (error) {
    next(error);
  }
});

// Adjust inventory quantity
router.post('/:id/adjust', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity_change, reason } = req.body;

    if (quantity_change === undefined || isNaN(quantity_change)) {
      return res.status(400).json({ error: 'Quantity change is required' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required for adjustments' });
    }

    const inventoryItem = await inventoryService.adjustInventory({
      inventoryItemId: id,
      quantityChange: parseInt(quantity_change),
      reason,
      userId: req.user?.id
    });

    activityService.log(
      'inventory_item',
      parseInt(id),
      'adjusted',
      'employee',
      req.user?.name || 'warehouse',
      { quantity_change, reason }
    ).catch(err => console.error('Activity log failed:', err));

    res.json(inventoryItem);
  } catch (error) {
    next(error);
  }
});

// Move inventory to different location
router.post('/:id/move', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { storage_location_id, reason, new_location } = req.body;

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

    if (!locationId) {
      return res.status(400).json({ error: 'Storage location is required' });
    }

    const inventoryItem = await inventoryService.moveInventory({
      inventoryItemId: id,
      newLocationId: locationId,
      reason,
      userId: req.user?.id
    });

    activityService.log(
      'inventory_item',
      parseInt(id),
      'moved',
      'employee',
      req.user?.name || 'warehouse',
      { storage_location_id: locationId, reason }
    ).catch(err => console.error('Activity log failed:', err));

    res.json(inventoryItem);
  } catch (error) {
    next(error);
  }
});

// Update condition
router.post('/:id/condition', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { condition, notes } = req.body;

    if (!condition) {
      return res.status(400).json({ error: 'Condition is required' });
    }

    const validConditions = ['sellable', 'damaged', 'refurbished', 'defective'];
    if (!validConditions.includes(condition)) {
      return res.status(400).json({ error: 'Invalid condition', valid_conditions: validConditions });
    }

    const inventoryItem = await inventoryService.updateCondition({
      inventoryItemId: id,
      condition,
      notes,
      userId: req.user?.id
    });

    res.json(inventoryItem);
  } catch (error) {
    next(error);
  }
});

// Get inventory history
router.get('/:id/history', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const history = await inventoryService.getHistory(id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Add photo to inventory item
router.post('/:id/photos', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { photo_url, photo_type, notes } = req.body;

    if (!photo_url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    const photo = await inventoryService.addPhoto({
      inventoryItemId: id,
      photoUrl: photo_url,
      photoType: photo_type || 'condition',
      notes,
      userId: req.user?.id
    });

    res.status(201).json(photo);
  } catch (error) {
    next(error);
  }
});

// Get photos for inventory item
router.get('/:id/photos', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const photos = await inventoryService.getPhotos(id);
    res.json(photos);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
