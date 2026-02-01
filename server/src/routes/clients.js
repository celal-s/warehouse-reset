const express = require('express');
const router = express.Router();
const db = require('../db');
const clientIsolation = require('../middleware/clientIsolation');
const activityService = require('../services/activityService');
const { authenticate, authorize } = require('../middleware/auth');

// Get all clients (for admin/employee selection)
router.get('/', authenticate, authorize('manager', 'admin', 'employee'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM clients ORDER BY client_code');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Middleware to check client access for client-role users
const checkClientAccess = (req, res, next) => {
  // If user is a client, verify they can only access their own client
  if (req.user.role === 'client' && req.user.client_id !== req.client.id) {
    return res.status(403).json({ error: 'Access denied: You can only access your own client data' });
  }
  next();
};

// Client-specific routes (with isolation middleware)

// Get client info
router.get('/:clientCode', authenticate, clientIsolation, checkClientAccess, async (req, res) => {
  res.json(req.client);
});

// Get client dashboard stats
router.get('/:clientCode/dashboard', authenticate, clientIsolation, checkClientAccess, async (req, res, next) => {
  try {
    const clientId = req.client.id;

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
      WHERE client_id = $1
    `, [clientId]);

    const decisionBreakdown = await db.query(`
      SELECT
        client_decision,
        COUNT(*) as count
      FROM inventory_items
      WHERE client_id = $1 AND client_decision IS NOT NULL
      GROUP BY client_decision
    `, [clientId]);

    // Receiving stats: orders pending receiving count (awaiting + partial status)
    const receivingStats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE receiving_status = 'awaiting') as orders_awaiting,
        COUNT(*) FILTER (WHERE receiving_status = 'partial') as orders_partial,
        COUNT(*) FILTER (WHERE receiving_status IN ('awaiting', 'partial')) as orders_pending_total,
        COALESCE(SUM(received_damaged_units), 0)::integer as total_damaged_units,
        COUNT(*) FILTER (WHERE received_damaged_units > 0) as orders_with_damage
      FROM warehouse_orders
      WHERE client_id = $1
    `, [clientId]);

    // Recent receiving activity (last 10 entries from receiving_log)
    const recentReceiving = await db.query(`
      SELECT
        rl.id,
        rl.receiving_id,
        rl.receiving_date,
        rl.warehouse_order_id,
        rl.warehouse_order_line_id,
        rl.purchase_order_no,
        rl.vendor,
        rl.sku,
        rl.asin,
        rl.product_title,
        rl.received_good_units,
        rl.received_damaged_units,
        rl.sellable_units,
        rl.tracking_number,
        rl.notes,
        rl.receiver_name,
        wo.receiving_status
      FROM receiving_log rl
      LEFT JOIN warehouse_orders wo ON rl.warehouse_order_id = wo.id
      WHERE rl.client_id = $1
      ORDER BY rl.receiving_date DESC
      LIMIT 10
    `, [clientId]);

    // Order status breakdown (count by receiving_status)
    const orderStatusBreakdown = await db.query(`
      SELECT
        receiving_status as status,
        COUNT(*) as count
      FROM warehouse_orders
      WHERE client_id = $1
      GROUP BY receiving_status
      ORDER BY
        CASE
          WHEN receiving_status = 'awaiting' THEN 1
          WHEN receiving_status = 'partial' THEN 2
          WHEN receiving_status = 'complete' THEN 3
          WHEN receiving_status = 'extra_units' THEN 4
          WHEN receiving_status = 'cancelled' THEN 5
          ELSE 6
        END
    `, [clientId]);

    res.json({
      ...stats.rows[0],
      decision_breakdown: decisionBreakdown.rows,
      receiving_stats: receivingStats.rows[0] || {
        orders_awaiting: 0,
        orders_partial: 0,
        orders_pending_total: 0,
        total_damaged_units: 0,
        orders_with_damage: 0
      },
      recent_receiving: recentReceiving.rows,
      order_status_breakdown: orderStatusBreakdown.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get client's inventory
router.get('/:clientCode/inventory', authenticate, clientIsolation, checkClientAccess, async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { status, condition } = req.query;

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
        i.listing_id,
        i.created_at,
        i.updated_at,
        p.id as product_id,
        p.upc,
        p.title as product_title,
        sl.label as location_label,
        sl.type as location_type,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type, 'source', COALESCE(pp.photo_source, 'warehouse')))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        (SELECT json_agg(jsonb_build_object('id', ip.id, 'url', ip.photo_url, 'type', ip.photo_type, 'notes', ip.notes))
         FROM inventory_photos ip WHERE ip.inventory_item_id = i.id) as inventory_photos,
        cpl.sku,
        cpl.asin,
        cpl.fnsku,
        m.code as marketplace,
        (SELECT pp.photo_url FROM product_photos pp WHERE pp.product_id = p.id ORDER BY pp.uploaded_at DESC LIMIT 1) as display_image_url,
        CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END as amazon_url
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      LEFT JOIN client_product_listings cpl ON i.listing_id = cpl.id OR (i.listing_id IS NULL AND cpl.product_id = p.id AND cpl.client_id = i.client_id)
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE i.client_id = $1
    `;

    const params = [clientId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND i.status = $${paramIndex}`;
      params.push(status);
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

// Get single inventory item for client
router.get('/:clientCode/inventory/:itemId', authenticate, clientIsolation, checkClientAccess, async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { itemId } = req.params;

    const result = await db.query(`
      SELECT
        i.id,
        i.product_id,
        i.client_id,
        i.storage_location_id,
        i.listing_id,
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
        sl.label as location_label,
        sl.type as location_type,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type, 'source', COALESCE(pp.photo_source, 'warehouse')))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        (SELECT json_agg(jsonb_build_object('id', ip.id, 'url', ip.photo_url, 'type', ip.photo_type, 'notes', ip.notes, 'uploaded_at', ip.uploaded_at))
         FROM inventory_photos ip WHERE ip.inventory_item_id = i.id) as inventory_photos,
        cpl.sku,
        cpl.asin,
        cpl.fnsku,
        m.code as marketplace,
        CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END as amazon_url,
        (SELECT pp.photo_url FROM product_photos pp WHERE pp.product_id = p.id ORDER BY pp.uploaded_at DESC LIMIT 1) as display_image_url,
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
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      LEFT JOIN client_product_listings cpl ON i.listing_id = cpl.id OR (i.listing_id IS NULL AND cpl.product_id = p.id AND cpl.client_id = i.client_id)
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE i.id = $1 AND i.client_id = $2
    `, [itemId, clientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get client's product catalog (separate from inventory)
// Groups by listing to show per-marketplace inventory
router.get('/:clientCode/products', authenticate, clientIsolation, checkClientAccess, async (req, res, next) => {
  try {
    const clientId = req.client.id;

    const result = await db.query(`
      SELECT
        cpl.id as listing_id,
        p.id as product_id,
        p.upc,
        p.title,
        COALESCE(p.warehouse_notes, '') as warehouse_notes,
        COALESCE(p.warehouse_condition, '') as warehouse_condition,
        cpl.sku,
        cpl.asin,
        cpl.fnsku,
        m.code as marketplace,
        CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END as amazon_url,
        (SELECT pp.photo_url FROM product_photos pp WHERE pp.product_id = p.id ORDER BY pp.uploaded_at DESC LIMIT 1) as display_image_url,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type, 'source', COALESCE(pp.photo_source, 'warehouse')))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        COALESCE(
          (SELECT SUM(ii.quantity) FROM inventory_items ii WHERE ii.listing_id = cpl.id),
          0
        )::integer as inventory_quantity,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.listing_id = cpl.id)::integer as inventory_entries
      FROM client_product_listings cpl
      JOIN products p ON cpl.product_id = p.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE cpl.client_id = $1
      ORDER BY p.title, m.code
    `, [clientId]);

    res.json({ products: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single product detail for client
router.get('/:clientCode/products/:productId', authenticate, clientIsolation, checkClientAccess, async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { productId } = req.params;

    const result = await db.query(`
      SELECT
        p.id,
        p.upc,
        p.title,
        COALESCE(p.warehouse_notes, '') as warehouse_notes,
        COALESCE(p.warehouse_condition, '') as warehouse_condition,
        p.created_at,
        COALESCE(p.updated_at, p.created_at) as updated_at,
        cpl.sku,
        cpl.asin,
        cpl.fnsku,
        CASE WHEN cpl.asin IS NOT NULL AND m.domain IS NOT NULL THEN 'https://www.' || m.domain || '/dp/' || cpl.asin ELSE NULL END as amazon_url,
        (SELECT pp.photo_url FROM product_photos pp WHERE pp.product_id = p.id ORDER BY pp.uploaded_at DESC LIMIT 1) as display_image_url,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type, 'source', COALESCE(pp.photo_source, 'warehouse')))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        COALESCE(
          (SELECT SUM(ii.quantity) FROM inventory_items ii WHERE ii.product_id = p.id AND ii.client_id = $2),
          0
        )::integer as inventory_quantity
      FROM products p
      JOIN client_product_listings cpl ON cpl.product_id = p.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE p.id = $1 AND cpl.client_id = $2
    `, [productId, clientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get inventory items for this product
    const inventoryResult = await db.query(`
      SELECT
        i.id,
        i.quantity,
        i.condition,
        i.status,
        i.client_decision,
        i.received_at,
        i.lot_number,
        sl.label as location_label
      FROM inventory_items i
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      WHERE i.product_id = $1 AND i.client_id = $2
      ORDER BY i.received_at DESC
    `, [productId, clientId]);

    res.json({
      ...result.rows[0],
      inventory_items: inventoryResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Make decision on inventory item
router.post('/:clientCode/inventory/:itemId/decision', authenticate, clientIsolation, checkClientAccess, async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { itemId } = req.params;
    const { decision, shipping_label_url, notes } = req.body;

    // Validate decision
    const validDecisions = ['ship_to_fba', 'return', 'dispose', 'keep_in_stock', 'other'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision', valid_decisions: validDecisions });
    }

    // Validate return requires shipping label
    if (decision === 'return' && !shipping_label_url) {
      return res.status(400).json({ error: 'Shipping label URL is required for return decisions' });
    }

    // Verify item belongs to client
    const itemCheck = await db.query(
      'SELECT id FROM inventory_items WHERE id = $1 AND client_id = $2',
      [itemId, clientId]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Update inventory item
    await db.query(`
      UPDATE inventory_items
      SET client_decision = $1, decision_notes = $2, status = 'decision_made', updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [decision, notes, itemId]);

    // Create decision record
    const decisionResult = await db.query(`
      INSERT INTO client_decisions (inventory_item_id, decision, shipping_label_url, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [itemId, decision, shipping_label_url, notes]);

    // Log activity (fire and forget)
    activityService.log(
      'inventory_item',
      parseInt(itemId),
      'decision_made',
      'client',
      req.client.client_code,
      { decision, notes }
    ).catch(err => console.error('Activity log failed:', err));

    res.json({
      message: 'Decision recorded',
      decision: decisionResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
