const express = require('express');
const clientRoutes = express.Router({ mergeParams: true });
const employeeRoutes = express.Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique order line ID for a client
 * Format: CLIENTCODE_0000001
 */
async function generateOrderLineId(clientId) {
  const client = await db.query('SELECT client_code FROM clients WHERE id = $1', [clientId]);
  const seq = await db.query(`
    INSERT INTO client_order_sequences (client_id, next_sequence)
    VALUES ($1, 2)
    ON CONFLICT (client_id)
    DO UPDATE SET next_sequence = client_order_sequences.next_sequence + 1
    RETURNING next_sequence - 1 as seq
  `, [clientId]);
  return `${client.rows[0].client_code}_${String(seq.rows[0].seq).padStart(7, '0')}`;
}

/**
 * Calculate the receiving status based on received vs expected units
 */
function calculateStatus(order) {
  if (order.receiving_status === 'cancelled') return 'cancelled';
  const totalReceived = order.received_good_units + order.received_damaged_units;
  const expected = order.expected_single_units;
  if (totalReceived === 0) return 'awaiting';
  if (totalReceived < expected) return 'partial';
  if (totalReceived === expected) return 'complete';
  return 'extra_units';
}

/**
 * Generate a unique receiving ID
 * Format: RCV + 6 random digits
 */
function generateReceivingId() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `RCV${randomDigits}`;
}

/**
 * Resolve clientCode to client_id
 */
async function resolveClientCode(clientCode) {
  const result = await db.query(
    'SELECT id, client_code, name FROM clients WHERE client_code = $1',
    [clientCode]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

// ============================================================================
// CLIENT ROUTES - /api/clients/:clientCode/warehouse-orders
// ============================================================================

// Middleware to resolve clientCode and check access
const resolveClient = async (req, res, next) => {
  const { clientCode } = req.params;

  if (!clientCode) {
    return res.status(400).json({ error: 'Client code is required' });
  }

  const client = await resolveClientCode(clientCode);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // If user is a client, verify they can only access their own data
  if (req.user.role === 'client' && req.user.client_id !== client.id) {
    return res.status(403).json({ error: 'Access denied: You can only access your own client data' });
  }

  req.client = client;
  next();
};

// Apply authentication and authorization to all client routes
clientRoutes.use(authenticate, authorize('client', 'manager', 'admin'), resolveClient);

/**
 * GET / - List warehouse orders with filters
 * Query params: status, search, start_date, end_date, page, limit
 */
clientRoutes.get('/', async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { status, search, start_date, end_date, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT
        wo.id,
        wo.warehouse_order_line_id,
        wo.warehouse_order_date,
        wo.purchase_order_date,
        wo.purchase_order_no,
        wo.vendor,
        wo.sku,
        wo.asin,
        wo.fnsku,
        wo.product_title,
        wo.product_id,
        wo.listing_id,
        wo.is_hazmat,
        wo.photo_link,
        wo.purchase_bundle_count,
        wo.purchase_order_quantity,
        wo.selling_bundle_count,
        wo.expected_single_units,
        wo.expected_sellable_units,
        wo.total_cost,
        wo.unit_cost,
        wo.receiving_status,
        wo.received_good_units,
        wo.received_damaged_units,
        wo.received_sellable_units,
        wo.first_received_date,
        wo.last_received_date,
        wo.notes_to_warehouse,
        wo.warehouse_notes,
        wo.created_at,
        wo.updated_at,
        m.id as marketplace_id,
        m.code as marketplace_code,
        m.name as marketplace_name
      FROM warehouse_orders wo
      LEFT JOIN marketplaces m ON wo.marketplace_id = m.id
      WHERE wo.client_id = $1
    `;

    const params = [clientId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND wo.receiving_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (
        wo.product_title ILIKE $${paramIndex} OR
        wo.sku ILIKE $${paramIndex} OR
        wo.asin ILIKE $${paramIndex} OR
        wo.fnsku ILIKE $${paramIndex} OR
        wo.purchase_order_no ILIKE $${paramIndex} OR
        wo.warehouse_order_line_id ILIKE $${paramIndex} OR
        wo.vendor ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (start_date) {
      sql += ` AND wo.warehouse_order_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      sql += ` AND wo.warehouse_order_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Get total count for pagination
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` ORDER BY wo.warehouse_order_date DESC, wo.id DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(sql, params);

    res.json({
      orders: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST / - Create new warehouse order(s)
 * Body: single order object or array of orders
 */
clientRoutes.post('/', async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const orders = Array.isArray(req.body) ? req.body : [req.body];
    const createdOrders = [];

    for (const order of orders) {
      const {
        purchase_order_date,
        purchase_order_no,
        vendor,
        marketplace_id,
        sku,
        asin,
        fnsku,
        product_title,
        product_id,
        listing_id,
        is_hazmat,
        photo_link,
        purchase_bundle_count = 1,
        purchase_order_quantity,
        selling_bundle_count = 1,
        total_cost,
        unit_cost,
        notes_to_warehouse
      } = order;

      if (!product_title) {
        return res.status(400).json({ error: 'Product title is required' });
      }

      if (!purchase_order_quantity || purchase_order_quantity < 1) {
        return res.status(400).json({ error: 'Purchase order quantity is required and must be positive' });
      }

      // Generate unique order line ID
      const warehouseOrderLineId = await generateOrderLineId(clientId);

      // Calculate expected units
      const expectedSingleUnits = purchase_bundle_count * purchase_order_quantity;
      const expectedSellableUnits = Math.floor(expectedSingleUnits / selling_bundle_count);

      const result = await db.query(`
        INSERT INTO warehouse_orders (
          warehouse_order_line_id,
          client_id,
          purchase_order_date,
          purchase_order_no,
          vendor,
          marketplace_id,
          sku,
          asin,
          fnsku,
          product_title,
          product_id,
          listing_id,
          is_hazmat,
          photo_link,
          purchase_bundle_count,
          purchase_order_quantity,
          selling_bundle_count,
          expected_single_units,
          expected_sellable_units,
          total_cost,
          unit_cost,
          notes_to_warehouse,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *
      `, [
        warehouseOrderLineId,
        clientId,
        purchase_order_date || null,
        purchase_order_no || null,
        vendor || null,
        marketplace_id || null,
        sku || null,
        asin || null,
        fnsku || null,
        product_title,
        product_id || null,
        listing_id || null,
        is_hazmat || false,
        photo_link || null,
        purchase_bundle_count,
        purchase_order_quantity,
        selling_bundle_count,
        expectedSingleUnits,
        expectedSellableUnits,
        total_cost || null,
        unit_cost || null,
        notes_to_warehouse || null,
        req.user?.id || null
      ]);

      createdOrders.push(result.rows[0]);
    }

    res.status(201).json({
      message: `Created ${createdOrders.length} order(s)`,
      orders: createdOrders
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id - Get single order with receiving history
 */
clientRoutes.get('/:id', async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        wo.id,
        wo.warehouse_order_line_id,
        wo.warehouse_order_date,
        wo.purchase_order_date,
        wo.purchase_order_no,
        wo.vendor,
        wo.sku,
        wo.asin,
        wo.fnsku,
        wo.product_title,
        wo.product_id,
        wo.listing_id,
        wo.is_hazmat,
        wo.photo_link,
        wo.purchase_bundle_count,
        wo.purchase_order_quantity,
        wo.selling_bundle_count,
        wo.expected_single_units,
        wo.expected_sellable_units,
        wo.total_cost,
        wo.unit_cost,
        wo.receiving_status,
        wo.received_good_units,
        wo.received_damaged_units,
        wo.received_sellable_units,
        wo.first_received_date,
        wo.last_received_date,
        wo.notes_to_warehouse,
        wo.warehouse_notes,
        wo.created_at,
        wo.updated_at,
        m.id as marketplace_id,
        m.code as marketplace_code,
        m.name as marketplace_name,
        (SELECT json_agg(jsonb_build_object(
          'id', rl.id,
          'receiving_id', rl.receiving_id,
          'receiving_date', rl.receiving_date,
          'received_good_units', rl.received_good_units,
          'received_damaged_units', rl.received_damaged_units,
          'sellable_units', rl.sellable_units,
          'tracking_number', rl.tracking_number,
          'notes', rl.notes,
          'receiver_name', rl.receiver_name,
          'created_at', rl.created_at
        ) ORDER BY rl.receiving_date DESC)
         FROM receiving_log rl WHERE rl.warehouse_order_id = wo.id) as receiving_history
      FROM warehouse_orders wo
      LEFT JOIN marketplaces m ON wo.marketplace_id = m.id
      WHERE wo.id = $1 AND wo.client_id = $2
    `, [id, clientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id - Update warehouse order
 */
clientRoutes.put('/:id', async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { id } = req.params;
    const {
      purchase_order_date,
      purchase_order_no,
      vendor,
      marketplace_id,
      sku,
      asin,
      fnsku,
      product_title,
      product_id,
      listing_id,
      is_hazmat,
      photo_link,
      purchase_bundle_count,
      purchase_order_quantity,
      selling_bundle_count,
      total_cost,
      unit_cost,
      notes_to_warehouse
    } = req.body;

    // Verify order exists and belongs to client
    const existingOrder = await db.query(
      'SELECT * FROM warehouse_orders WHERE id = $1 AND client_id = $2',
      [id, clientId]
    );

    if (existingOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse order not found' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    const fieldsToUpdate = {
      purchase_order_date,
      purchase_order_no,
      vendor,
      marketplace_id,
      sku,
      asin,
      fnsku,
      product_title,
      product_id,
      listing_id,
      is_hazmat,
      photo_link,
      purchase_bundle_count,
      purchase_order_quantity,
      selling_bundle_count,
      total_cost,
      unit_cost,
      notes_to_warehouse
    };

    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    // Recalculate expected units if bundle counts or quantity changed
    const newPurchaseBundleCount = purchase_bundle_count !== undefined ? purchase_bundle_count : existingOrder.rows[0].purchase_bundle_count;
    const newPurchaseOrderQuantity = purchase_order_quantity !== undefined ? purchase_order_quantity : existingOrder.rows[0].purchase_order_quantity;
    const newSellingBundleCount = selling_bundle_count !== undefined ? selling_bundle_count : existingOrder.rows[0].selling_bundle_count;

    const expectedSingleUnits = newPurchaseBundleCount * newPurchaseOrderQuantity;
    const expectedSellableUnits = Math.floor(expectedSingleUnits / newSellingBundleCount);

    updates.push(`expected_single_units = $${paramIndex}`);
    params.push(expectedSingleUnits);
    paramIndex++;

    updates.push(`expected_sellable_units = $${paramIndex}`);
    params.push(expectedSellableUnits);
    paramIndex++;

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(id, clientId);

    const result = await db.query(
      `UPDATE warehouse_orders SET ${updates.join(', ')} WHERE id = $${paramIndex} AND client_id = $${paramIndex + 1} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id - Cancel warehouse order (set status to cancelled)
 */
clientRoutes.delete('/:id', async (req, res, next) => {
  try {
    const clientId = req.client.id;
    const { id } = req.params;

    const result = await db.query(`
      UPDATE warehouse_orders
      SET receiving_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND client_id = $2
      RETURNING *
    `, [id, clientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse order not found' });
    }

    res.json({
      message: 'Order cancelled',
      order: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});


// ============================================================================
// EMPLOYEE ROUTES - /api/warehouse-orders
// ============================================================================

// Apply authentication and authorization to all employee routes
employeeRoutes.use(authenticate, authorize('employee', 'manager', 'admin'));

/**
 * GET /todays-receiving - Today's receiving entries
 * Query params: client_id (optional filter)
 * NOTE: This route must be defined before /:id to avoid being caught by the param route
 */
employeeRoutes.get('/todays-receiving', async (req, res, next) => {
  try {
    const { client_id } = req.query;
    let sql = `
      SELECT rl.id, rl.receiving_id, rl.receiving_date, rl.product_title,
             rl.sku, rl.received_good_units, rl.received_damaged_units,
             rl.sellable_units, c.client_code, wo.warehouse_order_line_id
      FROM receiving_log rl
      JOIN clients c ON rl.client_id = c.id
      LEFT JOIN warehouse_orders wo ON rl.warehouse_order_id = wo.id
      WHERE rl.receiving_date::date = CURRENT_DATE
    `;
    const params = [];
    if (client_id) {
      sql += ` AND rl.client_id = $1`;
      params.push(client_id);
    }
    sql += ` ORDER BY rl.receiving_date DESC LIMIT 20`;

    const result = await db.query(sql, params);
    res.json({ entries: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /receiving-history - Get paginated receiving history
 * Query params: page, limit, client_id (optional), start_date, end_date
 */
employeeRoutes.get('/receiving-history', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, client_id, start_date, end_date } = req.query;

    let sql = `
      SELECT
        rl.id,
        rl.receiving_id,
        rl.receiving_date,
        rl.product_title,
        rl.sku,
        rl.asin,
        rl.received_good_units,
        rl.received_damaged_units,
        rl.sellable_units,
        rl.tracking_number,
        rl.notes,
        rl.receiver_name,
        c.client_code,
        c.name as client_name,
        wo.warehouse_order_line_id
      FROM receiving_log rl
      JOIN clients c ON rl.client_id = c.id
      LEFT JOIN warehouse_orders wo ON rl.warehouse_order_id = wo.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (client_id) {
      sql += ` AND rl.client_id = $${paramIndex}`;
      params.push(client_id);
      paramIndex++;
    }

    if (start_date) {
      sql += ` AND rl.receiving_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      sql += ` AND rl.receiving_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Get total count
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` ORDER BY rl.receiving_date DESC, rl.id DESC`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(sql, params);

    res.json({
      entries: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /employee/dashboard - Employee dashboard stats
 * NOTE: This route must be defined before /:id to avoid being caught by the param route
 */
employeeRoutes.get('/employee/dashboard', async (req, res, next) => {
  try {
    // Pending orders count (awaiting + partial)
    const pendingOrdersResult = await db.query(`
      SELECT COUNT(*) as count
      FROM warehouse_orders
      WHERE receiving_status IN ('awaiting', 'partial')
    `);

    // Today's receiving stats
    const todaysReceivingResult = await db.query(`
      SELECT
        COUNT(*) as entries_count,
        COALESCE(SUM(received_good_units), 0) as good_units,
        COALESCE(SUM(received_damaged_units), 0) as damaged_units
      FROM receiving_log
      WHERE receiving_date::date = CURRENT_DATE
    `);

    // Pending returns count
    const pendingReturnsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM returns
      WHERE status IN ('pending', 'matched')
    `);

    // Recent receiving entries (last 10)
    const recentReceivingResult = await db.query(`
      SELECT rl.id, rl.receiving_id, rl.receiving_date, rl.product_title,
             rl.sku, rl.received_good_units, rl.received_damaged_units,
             rl.sellable_units, c.client_code
      FROM receiving_log rl
      JOIN clients c ON rl.client_id = c.id
      ORDER BY rl.receiving_date DESC
      LIMIT 10
    `);

    // Orders by client breakdown (awaiting/partial/complete counts)
    const ordersByClientResult = await db.query(`
      SELECT
        c.client_code,
        c.name as client_name,
        COUNT(*) FILTER (WHERE wo.receiving_status = 'awaiting') as awaiting_count,
        COUNT(*) FILTER (WHERE wo.receiving_status = 'partial') as partial_count,
        COUNT(*) FILTER (WHERE wo.receiving_status = 'complete') as complete_count
      FROM clients c
      LEFT JOIN warehouse_orders wo ON c.id = wo.client_id
      GROUP BY c.id, c.client_code, c.name
      HAVING COUNT(wo.id) > 0
      ORDER BY c.client_code
    `);

    res.json({
      pendingOrders: parseInt(pendingOrdersResult.rows[0].count),
      todaysReceiving: {
        entriesCount: parseInt(todaysReceivingResult.rows[0].entries_count),
        goodUnits: parseInt(todaysReceivingResult.rows[0].good_units),
        damagedUnits: parseInt(todaysReceivingResult.rows[0].damaged_units)
      },
      pendingReturns: parseInt(pendingReturnsResult.rows[0].count),
      recentReceiving: recentReceivingResult.rows,
      ordersByClient: ordersByClientResult.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /search - Search orders for receiving
 * Query params: client_id (required), q (search term)
 * Filters: exclude complete/cancelled, last 45 days only
 */
employeeRoutes.get('/search', async (req, res, next) => {
  try {
    const { client_id, q } = req.query;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    let sql = `
      SELECT
        wo.id,
        wo.warehouse_order_line_id,
        wo.warehouse_order_date,
        wo.purchase_order_date,
        wo.purchase_order_no,
        wo.vendor,
        wo.sku,
        wo.asin,
        wo.fnsku,
        wo.product_title,
        wo.product_id,
        wo.listing_id,
        wo.is_hazmat,
        wo.photo_link,
        wo.purchase_bundle_count,
        wo.purchase_order_quantity,
        wo.selling_bundle_count,
        wo.expected_single_units,
        wo.expected_sellable_units,
        wo.receiving_status,
        wo.received_good_units,
        wo.received_damaged_units,
        wo.received_sellable_units,
        wo.notes_to_warehouse,
        wo.warehouse_notes,
        c.client_code,
        c.name as client_name,
        m.id as marketplace_id,
        m.code as marketplace_code,
        m.name as marketplace_name
      FROM warehouse_orders wo
      JOIN clients c ON wo.client_id = c.id
      LEFT JOIN marketplaces m ON wo.marketplace_id = m.id
      WHERE wo.client_id = $1
        AND wo.receiving_status NOT IN ('complete', 'cancelled')
        AND wo.warehouse_order_date >= NOW() - INTERVAL '45 days'
    `;

    const params = [client_id];
    let paramIndex = 2;

    if (q) {
      sql += ` AND (
        wo.product_title ILIKE $${paramIndex} OR
        wo.sku ILIKE $${paramIndex} OR
        wo.asin ILIKE $${paramIndex} OR
        wo.fnsku ILIKE $${paramIndex} OR
        wo.purchase_order_no ILIKE $${paramIndex} OR
        wo.warehouse_order_line_id ILIKE $${paramIndex} OR
        wo.vendor ILIKE $${paramIndex}
      )`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    sql += ` ORDER BY wo.warehouse_order_date DESC, wo.id DESC LIMIT 100`;

    const result = await db.query(sql, params);

    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id - Get order details for receiving
 */
employeeRoutes.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        wo.id,
        wo.warehouse_order_line_id,
        wo.client_id,
        wo.warehouse_order_date,
        wo.purchase_order_date,
        wo.purchase_order_no,
        wo.vendor,
        wo.sku,
        wo.asin,
        wo.fnsku,
        wo.product_title,
        wo.product_id,
        wo.listing_id,
        wo.is_hazmat,
        wo.photo_link,
        wo.purchase_bundle_count,
        wo.purchase_order_quantity,
        wo.selling_bundle_count,
        wo.expected_single_units,
        wo.expected_sellable_units,
        wo.total_cost,
        wo.unit_cost,
        wo.receiving_status,
        wo.received_good_units,
        wo.received_damaged_units,
        wo.received_sellable_units,
        wo.first_received_date,
        wo.last_received_date,
        wo.notes_to_warehouse,
        wo.warehouse_notes,
        wo.created_at,
        wo.updated_at,
        c.client_code,
        c.name as client_name,
        m.id as marketplace_id,
        m.code as marketplace_code,
        m.name as marketplace_name,
        (SELECT json_agg(jsonb_build_object(
          'id', rl.id,
          'receiving_id', rl.receiving_id,
          'receiving_date', rl.receiving_date,
          'received_good_units', rl.received_good_units,
          'received_damaged_units', rl.received_damaged_units,
          'sellable_units', rl.sellable_units,
          'tracking_number', rl.tracking_number,
          'notes', rl.notes,
          'receiver_name', rl.receiver_name,
          'created_at', rl.created_at
        ) ORDER BY rl.receiving_date DESC)
         FROM receiving_log rl WHERE rl.warehouse_order_id = wo.id) as receiving_history
      FROM warehouse_orders wo
      JOIN clients c ON wo.client_id = c.id
      LEFT JOIN marketplaces m ON wo.marketplace_id = m.id
      WHERE wo.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /receiving-photos - Add a photo to a receiving entry
 * Body: receiving_id, receiving_log_id (optional), photo_url, photo_type, notes
 */
employeeRoutes.post('/receiving-photos', async (req, res, next) => {
  try {
    const { receiving_id, receiving_log_id, photo_url, photo_type = 'receiving', notes } = req.body;

    if (!receiving_id || !photo_url) {
      return res.status(400).json({ error: 'receiving_id and photo_url are required' });
    }

    const result = await db.query(`
      INSERT INTO receiving_photos (
        receiving_log_id,
        receiving_id,
        photo_url,
        photo_type,
        notes,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      receiving_log_id || null,
      receiving_id,
      photo_url,
      photo_type,
      notes || null,
      req.user?.id || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /receiving-photos/:receivingId - Get photos for a receiving entry
 */
employeeRoutes.get('/receiving-photos/:receivingId', async (req, res, next) => {
  try {
    const { receivingId } = req.params;

    const result = await db.query(`
      SELECT rp.*, u.name as uploaded_by_name
      FROM receiving_photos rp
      LEFT JOIN users u ON rp.uploaded_by = u.id
      WHERE rp.receiving_id = $1
      ORDER BY rp.uploaded_at DESC
    `, [receivingId]);

    res.json({ photos: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/receive - Submit receiving entry
 * Body: received_good_units, received_damaged_units, tracking_number, notes
 */
employeeRoutes.post('/:id/receive', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      received_good_units = 0,
      received_damaged_units = 0,
      tracking_number,
      notes
    } = req.body;

    // Validate at least some units are being received
    if (received_good_units < 0 || received_damaged_units < 0) {
      return res.status(400).json({ error: 'Received units cannot be negative' });
    }

    if (received_good_units === 0 && received_damaged_units === 0) {
      return res.status(400).json({ error: 'Must receive at least one unit (good or damaged)' });
    }

    // Get the order
    const orderResult = await db.query(`
      SELECT wo.*, c.client_code
      FROM warehouse_orders wo
      JOIN clients c ON wo.client_id = c.id
      WHERE wo.id = $1
    `, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse order not found' });
    }

    const order = orderResult.rows[0];

    // Check if order is cancelled
    if (order.receiving_status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot receive against a cancelled order' });
    }

    // Generate receiving ID
    const receivingId = generateReceivingId();

    // Calculate sellable units from good units
    const sellableUnits = Math.floor(received_good_units / order.selling_bundle_count);

    // Create receiving log entry
    const receivingLogResult = await db.query(`
      INSERT INTO receiving_log (
        receiving_id,
        warehouse_order_id,
        warehouse_order_line_id,
        client_id,
        purchase_order_no,
        vendor,
        sku,
        asin,
        product_title,
        received_good_units,
        received_damaged_units,
        selling_bundle_count,
        sellable_units,
        tracking_number,
        notes,
        receiver_id,
        receiver_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      receivingId,
      order.id,
      order.warehouse_order_line_id,
      order.client_id,
      order.purchase_order_no,
      order.vendor,
      order.sku,
      order.asin,
      order.product_title,
      received_good_units,
      received_damaged_units,
      order.selling_bundle_count,
      sellableUnits,
      tracking_number || null,
      notes || null,
      req.user?.id || null,
      req.user?.name || null
    ]);

    // Update warehouse order totals
    const newGoodUnits = order.received_good_units + received_good_units;
    const newDamagedUnits = order.received_damaged_units + received_damaged_units;
    const newSellableUnits = order.received_sellable_units + sellableUnits;
    const isFirstReceiving = order.first_received_date === null;

    // Calculate new status
    const updatedOrder = {
      ...order,
      received_good_units: newGoodUnits,
      received_damaged_units: newDamagedUnits
    };
    const newStatus = calculateStatus(updatedOrder);

    const updateResult = await db.query(`
      UPDATE warehouse_orders
      SET
        received_good_units = $1,
        received_damaged_units = $2,
        received_sellable_units = $3,
        receiving_status = $4,
        first_received_date = COALESCE(first_received_date, CURRENT_TIMESTAMP),
        last_received_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [newGoodUnits, newDamagedUnits, newSellableUnits, newStatus, id]);

    res.status(201).json({
      message: 'Receiving entry recorded',
      receiving_entry: receivingLogResult.rows[0],
      order: updateResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// ADMIN IMPORT ROUTES - /api/warehouse-orders/import
// ============================================================================

const importRoutes = express.Router();

// Admin-only import endpoints (or use a secret key for automation)
importRoutes.use((req, res, next) => {
  const importSecret = req.headers['x-import-secret'];
  const validSecret = process.env.IMPORT_SECRET || 'warehouse-import-2025';

  if (importSecret !== validSecret) {
    return res.status(401).json({ error: 'Invalid import secret' });
  }
  next();
});

/**
 * POST /cleanup - Clean up test data before import
 */
importRoutes.post('/cleanup', async (req, res, next) => {
  try {
    const results = {};

    // Delete receiving log entries for test orders
    const receivingResult = await db.query(`
      DELETE FROM receiving_log
      WHERE warehouse_order_id IN (
        SELECT id FROM warehouse_orders
        WHERE warehouse_order_line_id IN ('561_0000001', '561_0000002')
      )
      RETURNING id
    `);
    results.receivingDeleted = receivingResult.rowCount;

    // Delete test warehouse orders
    const ordersResult = await db.query(`
      DELETE FROM warehouse_orders
      WHERE warehouse_order_line_id IN ('561_0000001', '561_0000002')
      RETURNING id
    `);
    results.ordersDeleted = ordersResult.rowCount;

    // Delete client order sequences
    const sequencesResult = await db.query(`
      DELETE FROM client_order_sequences
      RETURNING client_id
    `);
    results.sequencesDeleted = sequencesResult.rowCount;

    res.json({
      message: 'Cleanup complete',
      results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /warehouse-orders - Import warehouse orders from JSON payload
 * Body: { orders: [...], clientCode: "561" }
 */
importRoutes.post('/warehouse-orders', async (req, res, next) => {
  try {
    const { orders, clientCode } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders array is required' });
    }

    if (!clientCode) {
      return res.status(400).json({ error: 'clientCode is required' });
    }

    // Get client ID
    const clientResult = await db.query(
      'SELECT id, client_code FROM clients WHERE client_code = $1',
      [clientCode]
    );
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: `Client ${clientCode} not found` });
    }
    const clientId = clientResult.rows[0].id;

    // Get marketplace IDs
    const marketplaceResult = await db.query('SELECT id, code FROM marketplaces');
    const marketplaceMap = {};
    for (const row of marketplaceResult.rows) {
      marketplaceMap[row.code.toLowerCase()] = row.id;
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let maxSequence = 0;
    const errorMessages = [];

    for (const order of orders) {
      try {
        const warehouseOrderLineId = order.warehouse_order_line_id;
        if (!warehouseOrderLineId) {
          skipped++;
          continue;
        }

        // Track max sequence
        const parts = warehouseOrderLineId.split('_');
        if (parts.length === 2) {
          const seq = parseInt(parts[1], 10) || 0;
          if (seq > maxSequence) maxSequence = seq;
        }

        // Check if already exists
        const existing = await db.query(
          'SELECT id FROM warehouse_orders WHERE warehouse_order_line_id = $1',
          [warehouseOrderLineId]
        );
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        // Get marketplace ID
        const marketplaceCode = order.marketplace_code?.toLowerCase();
        const marketplaceId = marketplaceCode ? marketplaceMap[marketplaceCode] : null;

        await db.query(`
          INSERT INTO warehouse_orders (
            warehouse_order_line_id,
            client_id,
            warehouse_order_date,
            purchase_order_date,
            purchase_order_no,
            vendor,
            marketplace_id,
            sku,
            asin,
            product_title,
            is_hazmat,
            photo_link,
            selling_bundle_count,
            purchase_bundle_count,
            purchase_order_quantity,
            expected_single_units,
            expected_sellable_units,
            total_cost,
            unit_cost,
            notes_to_warehouse,
            receiving_status,
            received_good_units,
            received_damaged_units,
            received_sellable_units,
            first_received_date,
            last_received_date,
            warehouse_notes
          ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        `, [
          warehouseOrderLineId,
          clientId,
          order.purchase_order_date || null,
          order.purchase_order_no || null,
          order.vendor || null,
          marketplaceId,
          order.sku || null,
          order.asin || null,
          order.product_title,
          order.is_hazmat || false,
          order.photo_link || null,
          order.selling_bundle_count || 1,
          order.purchase_bundle_count || 1,
          order.purchase_order_quantity || 0,
          order.expected_single_units || 0,
          order.expected_sellable_units || 0,
          order.total_cost || null,
          order.unit_cost || null,
          order.notes_to_warehouse || null,
          order.receiving_status || 'awaiting',
          order.received_good_units || 0,
          order.received_damaged_units || 0,
          order.received_sellable_units || 0,
          order.first_received_date || null,
          order.last_received_date || null,
          order.warehouse_notes || null
        ]);

        imported++;
      } catch (err) {
        errors++;
        if (errorMessages.length < 5) {
          errorMessages.push(err.message);
        }
      }
    }

    // Update sequence
    if (maxSequence > 0) {
      const nextSequence = maxSequence + 1;
      await db.query(`
        INSERT INTO client_order_sequences (client_id, next_sequence)
        VALUES ($1, $2)
        ON CONFLICT (client_id)
        DO UPDATE SET next_sequence = GREATEST(client_order_sequences.next_sequence, $2)
      `, [clientId, nextSequence]);
    }

    res.json({
      message: 'Import complete',
      results: { imported, skipped, errors, maxSequence },
      errorSamples: errorMessages
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /receiving-log - Import receiving log from JSON payload
 * Body: { entries: [...] }
 */
importRoutes.post('/receiving-log', async (req, res, next) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries array is required' });
    }

    // Get all clients for lookup
    const clientResult = await db.query('SELECT id, client_code FROM clients');
    const clientMap = {};
    for (const row of clientResult.rows) {
      clientMap[row.client_code] = row.id;
    }

    // Get all users for receiver lookup
    const userResult = await db.query('SELECT id, email, name FROM users');
    const userMapByEmail = {};
    for (const row of userResult.rows) {
      userMapByEmail[row.email.toLowerCase()] = { id: row.id, name: row.name };
    }

    // Get all warehouse orders for linking
    const ordersResult = await db.query('SELECT id, warehouse_order_line_id FROM warehouse_orders');
    const orderMap = {};
    for (const row of ordersResult.rows) {
      orderMap[row.warehouse_order_line_id] = row.id;
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let linkedToOrders = 0;
    const errorMessages = [];

    for (const entry of entries) {
      try {
        const receivingId = entry.receiving_id;
        if (!receivingId || !receivingId.startsWith('RCV')) {
          skipped++;
          continue;
        }

        // Check if already exists
        const existing = await db.query(
          'SELECT id FROM receiving_log WHERE receiving_id = $1',
          [receivingId]
        );
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        // Look up client_id
        const clientId = clientMap[entry.client_code];
        if (!clientId) {
          errors++;
          if (errorMessages.length < 5) {
            errorMessages.push(`Unknown client_code: ${entry.client_code}`);
          }
          continue;
        }

        // Look up warehouse_order_id
        const warehouseOrderId = entry.warehouse_order_line_id ? orderMap[entry.warehouse_order_line_id] : null;
        if (warehouseOrderId) linkedToOrders++;

        // Look up receiver
        let receiverId = null;
        let receiverName = entry.receiver || null;
        if (entry.receiver) {
          const receiver = userMapByEmail[entry.receiver.toLowerCase()];
          if (receiver) {
            receiverId = receiver.id;
            receiverName = receiver.name || entry.receiver;
          }
        }

        // Calculate sellable_units if not provided
        const receivedGoodUnits = entry.received_good_units || 0;
        const sellingBundleCount = entry.selling_bundle_count || 1;
        let sellableUnits = entry.sellable_units;
        if (!sellableUnits && receivedGoodUnits > 0 && sellingBundleCount > 0) {
          sellableUnits = Math.floor(receivedGoodUnits / sellingBundleCount);
        }

        await db.query(`
          INSERT INTO receiving_log (
            receiving_id,
            receiving_date,
            warehouse_order_id,
            warehouse_order_line_id,
            client_id,
            purchase_order_no,
            vendor,
            sku,
            asin,
            product_title,
            received_good_units,
            received_damaged_units,
            selling_bundle_count,
            sellable_units,
            tracking_number,
            notes,
            receiver_id,
            receiver_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          receivingId,
          entry.receiving_date || null,
          warehouseOrderId,
          entry.warehouse_order_line_id || null,
          clientId,
          entry.purchase_order_no || null,
          entry.vendor || null,
          entry.sku || null,
          entry.asin || null,
          entry.product_title || null,
          receivedGoodUnits,
          entry.received_damaged_units || 0,
          sellingBundleCount,
          sellableUnits || 0,
          entry.tracking_number || null,
          entry.notes || null,
          receiverId,
          receiverName
        ]);

        imported++;
      } catch (err) {
        errors++;
        if (errorMessages.length < 5) {
          errorMessages.push(err.message);
        }
      }
    }

    res.json({
      message: 'Import complete',
      results: { imported, skipped, errors, linkedToOrders },
      errorSamples: errorMessages
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats - Get import verification stats
 */
importRoutes.get('/stats', async (req, res, next) => {
  try {
    // Warehouse orders by client
    const ordersResult = await db.query(`
      SELECT c.client_code, c.name, COUNT(wo.id) as order_count
      FROM clients c
      LEFT JOIN warehouse_orders wo ON c.id = wo.client_id
      GROUP BY c.id ORDER BY c.client_code
    `);

    // Receiving log by client
    const receivingResult = await db.query(`
      SELECT c.client_code, COUNT(rl.id) as receiving_count
      FROM clients c
      LEFT JOIN receiving_log rl ON c.id = rl.client_id
      GROUP BY c.id ORDER BY c.client_code
    `);

    // Linked vs orphan receiving entries
    const linkedResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE warehouse_order_id IS NOT NULL) as linked,
        COUNT(*) FILTER (WHERE warehouse_order_id IS NULL) as orphans
      FROM receiving_log
    `);

    // Status distribution
    const statusResult = await db.query(`
      SELECT receiving_status, COUNT(*) as count
      FROM warehouse_orders
      GROUP BY receiving_status
    `);

    // Client order sequences
    const sequenceResult = await db.query(`
      SELECT c.client_code, cos.next_sequence
      FROM client_order_sequences cos
      JOIN clients c ON cos.client_id = c.id
      ORDER BY c.client_code
    `);

    res.json({
      warehouseOrdersByClient: ordersResult.rows,
      receivingLogByClient: receivingResult.rows,
      receivingLinks: linkedResult.rows[0],
      statusDistribution: statusResult.rows,
      clientSequences: sequenceResult.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { clientRoutes, employeeRoutes, importRoutes };
