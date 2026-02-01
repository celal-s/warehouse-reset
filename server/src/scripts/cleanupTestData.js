/**
 * Cleanup Test Data Script
 *
 * Removes test data created during endpoint testing before running imports.
 *
 * Usage: node src/scripts/cleanupTestData.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../db');

async function main() {
  console.log('Cleaning up test data...\n');

  try {
    // Delete receiving log entries for test orders
    const receivingResult = await db.query(`
      DELETE FROM receiving_log
      WHERE warehouse_order_id IN (
        SELECT id FROM warehouse_orders
        WHERE warehouse_order_line_id IN ('561_0000001', '561_0000002')
      )
      RETURNING id
    `);
    console.log(`Deleted ${receivingResult.rowCount} receiving log entries for test orders`);

    // Delete test warehouse orders
    const ordersResult = await db.query(`
      DELETE FROM warehouse_orders
      WHERE warehouse_order_line_id IN ('561_0000001', '561_0000002')
      RETURNING id
    `);
    console.log(`Deleted ${ordersResult.rowCount} test warehouse orders`);

    // Delete client order sequences
    const sequencesResult = await db.query(`
      DELETE FROM client_order_sequences
      RETURNING client_id
    `);
    console.log(`Deleted ${sequencesResult.rowCount} client order sequences`);

    console.log('\nCleanup complete!');
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
