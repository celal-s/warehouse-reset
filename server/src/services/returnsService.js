const db = require('../db');

const returnsService = {
  // Create a new return record
  async createReturn({
    productId,
    inventoryItemId,
    clientId,
    quantity,
    returnType,
    labelUrl,
    carrier,
    trackingNumber,
    returnByDate,
    sourceIdentifier,
    parsedProductName,
    matchConfidence,
    clientNotes,
    warehouseNotes,
    userId,
    importBatchId,
    originalFilename,
    status = 'pending' // Default to 'pending', can be overridden (e.g., 'unmatched' for backlog imports)
  }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO returns (
          product_id, inventory_item_id, client_id, quantity,
          return_type, status, label_url, label_uploaded_at,
          carrier, tracking_number, return_by_date,
          source_identifier, parsed_product_name, match_confidence,
          client_notes, warehouse_notes, created_by,
          import_batch_id, original_filename
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        productId,
        inventoryItemId,
        clientId,
        quantity || 1,
        returnType,
        status,
        labelUrl,
        labelUrl ? new Date() : null,
        carrier,
        trackingNumber,
        returnByDate,
        sourceIdentifier,
        parsedProductName,
        matchConfidence,
        clientNotes,
        warehouseNotes,
        userId,
        importBatchId,
        originalFilename
      ]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // List returns with filtering
  async getReturns({ status, clientId, urgent, productId, limit = 50, offset = 0 }) {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`r.status = $${paramIndex++}`);
      params.push(status);
    }

    if (clientId) {
      whereConditions.push(`r.client_id = $${paramIndex++}`);
      params.push(clientId);
    }

    if (productId) {
      whereConditions.push(`r.product_id = $${paramIndex++}`);
      params.push(productId);
    }

    if (urgent === true) {
      whereConditions.push(`r.return_by_date <= CURRENT_DATE + INTERVAL '7 days'`);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const result = await db.query(`
      SELECT
        r.*,
        p.title as product_name,
        p.upc as product_upc,
        cpl.sku as product_sku,
        cpl.asin as product_asin,
        COALESCE(cpl.image_url, (SELECT photo_url FROM product_photos WHERE product_id = p.id LIMIT 1)) as product_image_url,
        c.name as client_name,
        c.client_code,
        i.condition as inventory_condition,
        i.status as inventory_status,
        sl.label as storage_location,
        created_user.name as created_by_name,
        shipped_user.name as shipped_by_name
      FROM returns r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id AND (r.client_id IS NULL OR cpl.client_id = r.client_id)
      LEFT JOIN inventory_items i ON r.inventory_item_id = i.id
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      LEFT JOIN users created_user ON r.created_by = created_user.id
      LEFT JOIN users shipped_user ON r.shipped_by = shipped_user.id
      ${whereClause}
      ORDER BY r.return_by_date ASC NULLS LAST, r.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);

    return result.rows;
  },

  // Get single return with all related data
  async getReturn(id) {
    const result = await db.query(`
      SELECT
        r.*,
        p.title as product_name,
        p.upc as product_upc,
        cpl.sku as product_sku,
        cpl.asin as product_asin,
        cpl.fnsku as product_fnsku,
        COALESCE(cpl.image_url, (SELECT photo_url FROM product_photos WHERE product_id = p.id LIMIT 1)) as product_image_url,
        c.name as client_name,
        c.client_code,
        i.condition as inventory_condition,
        i.status as inventory_status,
        i.quantity as inventory_quantity,
        i.condition_notes as inventory_notes,
        sl.label as storage_location,
        created_user.name as created_by_name,
        shipped_user.name as shipped_by_name
      FROM returns r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id AND (r.client_id IS NULL OR cpl.client_id = r.client_id)
      LEFT JOIN inventory_items i ON r.inventory_item_id = i.id
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      LEFT JOIN users created_user ON r.created_by = created_user.id
      LEFT JOIN users shipped_user ON r.shipped_by = shipped_user.id
      WHERE r.id = $1
    `, [id]);

    return result.rows[0] || null;
  },

  // Get pending returns for warehouse dashboard
  async getPendingReturns() {
    const result = await db.query(`
      SELECT
        r.*,
        p.title as product_name,
        p.upc as product_upc,
        cpl.sku as product_sku,
        cpl.asin as product_asin,
        cpl.fnsku as product_fnsku,
        COALESCE(cpl.image_url, (SELECT photo_url FROM product_photos WHERE product_id = p.id LIMIT 1)) as product_image_url,
        c.name as client_name,
        c.client_code,
        i.condition as inventory_condition,
        i.status as inventory_status,
        sl.label as storage_location
      FROM returns r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id AND (r.client_id IS NULL OR cpl.client_id = r.client_id)
      LEFT JOIN inventory_items i ON r.inventory_item_id = i.id
      LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
      WHERE r.status IN ('pending', 'matched')
      ORDER BY r.return_by_date ASC NULLS LAST, r.created_at DESC
    `);

    return result.rows;
  },

  // Get unmatched returns for admin review
  async getUnmatchedReturns() {
    const result = await db.query(`
      SELECT
        r.*,
        p.title as product_name,
        p.upc as product_upc,
        c.name as client_name,
        c.client_code,
        created_user.name as created_by_name
      FROM returns r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN users created_user ON r.created_by = created_user.id
      WHERE r.status = 'unmatched'
      ORDER BY r.return_by_date ASC NULLS LAST, r.created_at DESC
    `);

    return result.rows;
  },

  // Update return fields
  async updateReturn(id, updates, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current values for logging
      const currentResult = await client.query(
        'SELECT * FROM returns WHERE id = $1',
        [id]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Return not found');
      }

      const currentReturn = currentResult.rows[0];
      const allowedFields = [
        'client_notes', 'warehouse_notes', 'tracking_number', 'carrier',
        'label_url', 'return_by_date', 'quantity', 'status'
      ];

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (allowedFields.includes(snakeKey)) {
          updateFields.push(`${snakeKey} = $${paramIndex++}`);
          updateValues.push(value);
        }
      }

      if (updateFields.length === 0) {
        await client.query('ROLLBACK');
        return currentReturn;
      }

      // Handle label_uploaded_at if label_url is being updated
      if (updates.labelUrl || updates.label_url) {
        updateFields.push(`label_uploaded_at = $${paramIndex++}`);
        updateValues.push(new Date());
      }

      updateValues.push(id);
      const updateQuery = `
        UPDATE returns
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Mark return as shipped
  async markShipped(id, { trackingNumber, carrier, warehouseNotes }, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT * FROM returns WHERE id = $1',
        [id]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Return not found');
      }

      const result = await client.query(`
        UPDATE returns
        SET status = 'shipped',
            shipped_at = CURRENT_TIMESTAMP,
            shipped_by = $2,
            tracking_number = COALESCE($3, tracking_number),
            carrier = COALESCE($4, carrier),
            warehouse_notes = COALESCE($5, warehouse_notes)
        WHERE id = $1
        RETURNING *
      `, [id, userId, trackingNumber, carrier, warehouseNotes]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Mark return as completed
  async markCompleted(id, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT * FROM returns WHERE id = $1',
        [id]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Return not found');
      }

      const result = await client.query(`
        UPDATE returns
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Manually assign a product to an unmatched return
  async assignProduct(returnId, productId, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT * FROM returns WHERE id = $1',
        [returnId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Return not found');
      }

      const currentReturn = currentResult.rows[0];

      if (currentReturn.status !== 'unmatched') {
        throw new Error('Can only assign products to unmatched returns');
      }

      // Verify product exists
      const productResult = await client.query(
        'SELECT id FROM products WHERE id = $1',
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const result = await client.query(`
        UPDATE returns
        SET product_id = $2,
            status = 'pending',
            match_confidence = 1.0
        WHERE id = $1
        RETURNING *
      `, [returnId, productId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Link a pre-receipt return to received inventory
  async matchReturnToInventory(returnId, inventoryItemId, clientId, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT * FROM returns WHERE id = $1',
        [returnId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Return not found');
      }

      // Verify inventory item exists
      const inventoryResult = await client.query(
        'SELECT id, product_id FROM inventory_items WHERE id = $1',
        [inventoryItemId]
      );

      if (inventoryResult.rows.length === 0) {
        throw new Error('Inventory item not found');
      }

      const inventoryItem = inventoryResult.rows[0];

      const result = await client.query(`
        UPDATE returns
        SET inventory_item_id = $2,
            client_id = COALESCE($3, client_id),
            product_id = COALESCE(product_id, $4),
            status = 'matched'
        WHERE id = $1
        RETURNING *
      `, [returnId, inventoryItemId, clientId, inventoryItem.product_id]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Find pending pre-receipt returns that match a product_id
  async findMatchingReturns(productId) {
    const result = await db.query(`
      SELECT
        r.*,
        p.title as product_name,
        p.upc as product_upc,
        c.name as client_name,
        c.client_code
      FROM returns r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN clients c ON r.client_id = c.id
      WHERE r.product_id = $1
        AND r.return_type = 'pre_receipt'
        AND r.status IN ('pending', 'unmatched')
        AND r.inventory_item_id IS NULL
      ORDER BY r.return_by_date ASC NULLS LAST, r.created_at ASC
    `, [productId]);

    return result.rows;
  }
};

module.exports = returnsService;
