const db = require('../db');
const returnsService = require('./returnsService');

const inventoryService = {
  // Receive inventory - creates inventory item and logs history
  async receiveInventory({ productId, clientId, quantity, condition, storageLocationId, notes, lotNumber, userId }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Create inventory item
      const inventoryResult = await client.query(`
        INSERT INTO inventory_items (
          product_id, client_id, quantity, condition, status,
          storage_location_id, condition_notes, lot_number,
          received_at, received_by
        )
        VALUES ($1, $2, $3, $4, 'awaiting_decision', $5, $6, $7, CURRENT_TIMESTAMP, $8)
        RETURNING *
      `, [productId, clientId, quantity || 1, condition || 'sellable', storageLocationId, notes, lotNumber, userId]);

      const inventoryItem = inventoryResult.rows[0];

      // Log history
      await client.query(`
        INSERT INTO inventory_history (
          inventory_item_id, action, quantity_change, changed_by, reason
        )
        VALUES ($1, 'received', $2, $3, $4)
      `, [inventoryItem.id, quantity || 1, userId, notes || 'Initial receipt']);

      // Check for matching pre-receipt returns
      const matchingReturns = await returnsService.findMatchingReturns(productId);
      if (matchingReturns && matchingReturns.length > 0) {
        // Match the first pending return to this inventory item
        const returnToMatch = matchingReturns[0];
        await client.query(`
          UPDATE returns
          SET inventory_item_id = $1, client_id = $2, status = 'matched'
          WHERE id = $3
        `, [inventoryItem.id, clientId, returnToMatch.id]);

        // Add to the returned inventory item so caller knows a return was matched
        inventoryItem.matched_return_id = returnToMatch.id;
      }

      await client.query('COMMIT');
      return inventoryItem;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Adjust inventory quantity (cycle count, damage, etc.)
  async adjustInventory({ inventoryItemId, quantityChange, reason, userId }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current quantity
      const currentResult = await client.query(
        'SELECT quantity FROM inventory_items WHERE id = $1',
        [inventoryItemId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Inventory item not found');
      }

      const oldQuantity = currentResult.rows[0].quantity;
      const newQuantity = oldQuantity + quantityChange;

      if (newQuantity < 0) {
        throw new Error('Quantity cannot be negative');
      }

      // Update quantity
      const updateResult = await client.query(`
        UPDATE inventory_items
        SET quantity = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [newQuantity, inventoryItemId]);

      // Log history
      await client.query(`
        INSERT INTO inventory_history (
          inventory_item_id, action, field_changed, old_value, new_value,
          quantity_change, changed_by, reason
        )
        VALUES ($1, 'adjusted', 'quantity', $2, $3, $4, $5, $6)
      `, [inventoryItemId, oldQuantity.toString(), newQuantity.toString(), quantityChange, userId, reason]);

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Move inventory to different location
  async moveInventory({ inventoryItemId, newLocationId, reason, userId }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current location
      const currentResult = await client.query(`
        SELECT i.storage_location_id, sl.label as current_location_label
        FROM inventory_items i
        LEFT JOIN storage_locations sl ON i.storage_location_id = sl.id
        WHERE i.id = $1
      `, [inventoryItemId]);

      if (currentResult.rows.length === 0) {
        throw new Error('Inventory item not found');
      }

      const oldLocationId = currentResult.rows[0].storage_location_id;
      const oldLocationLabel = currentResult.rows[0].current_location_label || 'None';

      // Get new location label
      let newLocationLabel = 'None';
      if (newLocationId) {
        const newLocResult = await client.query(
          'SELECT label FROM storage_locations WHERE id = $1',
          [newLocationId]
        );
        if (newLocResult.rows.length > 0) {
          newLocationLabel = newLocResult.rows[0].label;
        }
      }

      // Update location
      const updateResult = await client.query(`
        UPDATE inventory_items
        SET storage_location_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [newLocationId, inventoryItemId]);

      // Log history
      await client.query(`
        INSERT INTO inventory_history (
          inventory_item_id, action, field_changed, old_value, new_value,
          changed_by, reason
        )
        VALUES ($1, 'moved', 'storage_location', $2, $3, $4, $5)
      `, [inventoryItemId, oldLocationLabel, newLocationLabel, userId, reason]);

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Update condition
  async updateCondition({ inventoryItemId, condition, notes, userId }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current condition
      const currentResult = await client.query(
        'SELECT condition, condition_notes FROM inventory_items WHERE id = $1',
        [inventoryItemId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Inventory item not found');
      }

      const oldCondition = currentResult.rows[0].condition;

      // Update condition
      const updateResult = await client.query(`
        UPDATE inventory_items
        SET condition = $1, condition_notes = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [condition, notes, inventoryItemId]);

      // Log history
      await client.query(`
        INSERT INTO inventory_history (
          inventory_item_id, action, field_changed, old_value, new_value,
          changed_by, reason
        )
        VALUES ($1, 'condition_updated', 'condition', $2, $3, $4, $5)
      `, [inventoryItemId, oldCondition, condition, userId, notes]);

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get inventory history
  async getHistory(inventoryItemId) {
    const result = await db.query(`
      SELECT
        ih.*,
        u.name as changed_by_name
      FROM inventory_history ih
      LEFT JOIN users u ON ih.changed_by = u.id
      WHERE ih.inventory_item_id = $1
      ORDER BY ih.changed_at DESC
    `, [inventoryItemId]);

    return result.rows;
  },

  // Add photo to inventory item
  async addPhoto({ inventoryItemId, photoUrl, photoType, notes, userId }) {
    const result = await db.query(`
      INSERT INTO inventory_photos (inventory_item_id, photo_url, photo_type, notes, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [inventoryItemId, photoUrl, photoType || 'condition', notes, userId]);

    // Log history
    await db.query(`
      INSERT INTO inventory_history (
        inventory_item_id, action, changed_by, reason
      )
      VALUES ($1, 'photo_added', $2, $3)
    `, [inventoryItemId, userId, notes || 'Photo added']);

    return result.rows[0];
  },

  // Get photos for inventory item
  async getPhotos(inventoryItemId) {
    const result = await db.query(`
      SELECT
        ip.*,
        u.name as uploaded_by_name
      FROM inventory_photos ip
      LEFT JOIN users u ON ip.uploaded_by = u.id
      WHERE ip.inventory_item_id = $1
      ORDER BY ip.uploaded_at DESC
    `, [inventoryItemId]);

    return result.rows;
  },

  // Log custom history entry
  async logHistory({ inventoryItemId, action, fieldChanged, oldValue, newValue, quantityChange, userId, reason }) {
    const result = await db.query(`
      INSERT INTO inventory_history (
        inventory_item_id, action, field_changed, old_value, new_value,
        quantity_change, changed_by, reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [inventoryItemId, action, fieldChanged, oldValue, newValue, quantityChange, userId, reason]);

    return result.rows[0];
  }
};

module.exports = inventoryService;
