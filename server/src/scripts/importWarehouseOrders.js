/**
 * Warehouse Orders Import Script
 *
 * One-time script to import warehouse orders from CSV files.
 *
 * Usage: node server/src/scripts/importWarehouseOrders.js
 *
 * The script will:
 * 1. Read CSV files from the full-receiving-implementation folder
 * 2. Parse columns and map to database fields
 * 3. Look up client_id from client_code (258, 412, 561)
 * 4. Look up marketplace_id from marketplace code
 * 5. Insert into warehouse_orders table
 * 6. Update client_order_sequences to max sequence used
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../db');

// CSV files to import
const CSV_FILES = [
  {
    file: '258 - Warehouse Orders.csv',
    clientCode: '258'
  },
  {
    file: '412 - Warehouse Orders.csv',
    clientCode: '412'
  },
  {
    file: '561 - Warehouse Orders.csv',
    clientCode: '561'
  }
];

const CSV_DIR = path.join(__dirname, '../../../../full-receiving-implementation');

// Marketplace code mapping (CSV value -> database code)
const MARKETPLACE_MAP = {
  'CA': 'ca',
  'US': 'us',
  'UK': 'uk',
  'UK FBA': 'uk',
  'AU': 'au',
  'ca': 'ca',
  'us': 'us',
  'uk': 'uk',
  'au': 'au'
};

/**
 * Parse a CSV line, handling quoted fields with commas
 * @param {string} line - CSV line to parse
 * @returns {string[]} Array of field values
 */
function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        field += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }

  // Don't forget the last field
  fields.push(field);

  return fields;
}

/**
 * Parse a date string from various formats
 * @param {string} dateStr - Date string to parse
 * @returns {string|null} ISO date string or null
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr === '12/30/1899') {
    return null;
  }

  // Try MM/DD/YYYY format
  const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try YYYY-MM-DD format
  const isoDate = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return dateStr;
  }

  return null;
}

/**
 * Parse a boolean from various formats
 * @param {string} value - Value to parse
 * @returns {boolean}
 */
function parseBoolean(value) {
  if (!value || value.trim() === '') return false;
  const lower = value.toString().toLowerCase().trim();
  return lower === 'yes' || lower === 'true' || lower === '1' || lower === 'y';
}

/**
 * Parse a decimal/currency value
 * @param {string} value - Value to parse
 * @returns {number|null}
 */
function parseDecimal(value) {
  if (!value || value.trim() === '') return null;
  // Remove currency symbols and commas
  const cleaned = value.toString().replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse an integer value
 * @param {string} value - Value to parse
 * @returns {number}
 */
function parseInt_(value) {
  if (!value || value.trim() === '') return 0;
  const num = parseInt(value.toString().trim(), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract sequence number from warehouse_order_line_id
 * @param {string} lineId - e.g., "258_0000001"
 * @returns {number}
 */
function extractSequence(lineId) {
  if (!lineId) return 0;
  const parts = lineId.split('_');
  if (parts.length !== 2) return 0;
  return parseInt(parts[1], 10) || 0;
}

/**
 * Map receiving status from CSV to database enum
 * @param {string} status - CSV status value
 * @returns {string}
 */
function mapReceivingStatus(status) {
  if (!status || status.trim() === '') return 'awaiting';
  const lower = status.toString().toLowerCase().trim();

  switch (lower) {
    case 'awaiting':
      return 'awaiting';
    case 'partial':
      return 'partial';
    case 'complete':
      return 'complete';
    case 'extra units':
    case 'extra_units':
      return 'extra_units';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'awaiting';
  }
}

/**
 * Import a single CSV file
 * @param {string} filePath - Path to CSV file
 * @param {string} clientCode - Client code (258, 412, 561)
 * @returns {Promise<object>} Import results
 */
async function importCSVFile(filePath, clientCode) {
  console.log(`\nImporting ${path.basename(filePath)} for client ${clientCode}...`);

  // Get client ID
  const clientResult = await db.query(
    'SELECT id, client_code FROM clients WHERE client_code = $1',
    [clientCode]
  );
  if (clientResult.rows.length === 0) {
    throw new Error(`Client ${clientCode} not found`);
  }
  const clientId = clientResult.rows[0].id;

  // Get all marketplace IDs
  const marketplaceResult = await db.query('SELECT id, code FROM marketplaces');
  const marketplaceMap = {};
  for (const row of marketplaceResult.rows) {
    marketplaceMap[row.code.toLowerCase()] = row.id;
  }

  // Read and parse CSV
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    console.log('  No data rows found');
    return { imported: 0, skipped: 0, errors: 0, maxSequence: 0 };
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);
  console.log(`  Found ${lines.length - 1} data rows`);

  // Map header indices
  const headerMap = {};
  headers.forEach((header, index) => {
    headerMap[header.trim()] = index;
  });

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let maxSequence = 0;

  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    try {
      const fields = parseCSVLine(lines[i]);

      // Get values by header name
      const getValue = (headerName) => {
        const index = headerMap[headerName];
        return index !== undefined ? (fields[index] || '').trim() : '';
      };

      const warehouseOrderLineId = getValue('warehouse_order_line_ID');
      if (!warehouseOrderLineId) {
        skipped++;
        continue;
      }

      // Track max sequence
      const seq = extractSequence(warehouseOrderLineId);
      if (seq > maxSequence) {
        maxSequence = seq;
      }

      // Check if order already exists
      const existingOrder = await db.query(
        'SELECT id FROM warehouse_orders WHERE warehouse_order_line_id = $1',
        [warehouseOrderLineId]
      );

      if (existingOrder.rows.length > 0) {
        skipped++;
        continue;
      }

      // Parse marketplace
      const marketplaceRaw = getValue('selling_marketplace');
      const marketplaceCode = MARKETPLACE_MAP[marketplaceRaw];
      const marketplaceId = marketplaceCode ? marketplaceMap[marketplaceCode] : null;

      // Parse other fields
      const purchaseOrderDate = parseDate(getValue('purchase_order_date'));
      const purchaseOrderNo = getValue('purchase_order_no');
      const vendor = getValue('vendor');
      const isHazmat = parseBoolean(getValue('is_hazmat'));
      const sku = getValue('selling_marketplace_client_SKU');
      const productTitle = getValue('selling_marketplace_product_title');
      const asin = getValue('selling_marketplace_ASIN');
      const photoLink = getValue('selling_marketplace_photo_link');
      const sellingBundleCount = parseInt_(getValue('selling_marketplace_bundle_count')) || 1;
      const purchaseBundleCount = parseInt_(getValue('purchase_bundle_count')) || 1;
      const purchaseOrderQuantity = parseInt_(getValue('purchase_order_quantity')) || 0;
      const expectedSingleUnits = parseInt_(getValue('purchase_order_quantity_single_units')) || 0;
      const expectedSellableUnits = parseInt_(getValue('total_sellable_units')) || 0;
      const totalCost = parseDecimal(getValue('total_warehouse_order_cost'));
      const unitCost = parseDecimal(getValue('sellable_unit_cost'));
      const notesToWarehouse = getValue('notes_to_warehouse');
      const receivingStatus = mapReceivingStatus(getValue('warehouse_order_receiving_status'));
      const receivedGoodUnits = parseInt_(getValue('received_single_units_quantity')) || 0;
      const receivedDamagedUnits = parseInt_(getValue('received_single_units_damaged_quantity')) || 0;
      const receivedSellableUnits = parseInt_(getValue('received_sellable_units_quantity')) || 0;
      const firstReceivedDate = parseDate(getValue('first_received_date'));
      const lastReceivedDate = parseDate(getValue('last_received_date'));
      const warehouseNotes = getValue('warehouse_notes');

      // Skip rows with no product title
      if (!productTitle) {
        skipped++;
        continue;
      }

      // Insert warehouse order
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
        purchaseOrderDate,
        purchaseOrderNo,
        vendor,
        marketplaceId,
        sku,
        asin,
        productTitle,
        isHazmat,
        photoLink,
        sellingBundleCount,
        purchaseBundleCount,
        purchaseOrderQuantity,
        expectedSingleUnits,
        expectedSellableUnits,
        totalCost,
        unitCost,
        notesToWarehouse,
        receivingStatus,
        receivedGoodUnits,
        receivedDamagedUnits,
        receivedSellableUnits,
        firstReceivedDate,
        lastReceivedDate,
        warehouseNotes
      ]);

      imported++;

      // Progress indicator
      if (imported % 100 === 0) {
        console.log(`  Imported ${imported} orders...`);
      }
    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error on row ${i}: ${error.message}`);
      }
    }
  }

  console.log(`  Results: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  console.log(`  Max sequence: ${maxSequence}`);

  return { imported, skipped, errors, maxSequence };
}

/**
 * Update client_order_sequences table with max sequence used
 * @param {string} clientCode - Client code
 * @param {number} maxSequence - Maximum sequence number found
 */
async function updateClientSequence(clientCode, maxSequence) {
  const clientResult = await db.query(
    'SELECT id FROM clients WHERE client_code = $1',
    [clientCode]
  );

  if (clientResult.rows.length === 0) {
    console.log(`  Warning: Client ${clientCode} not found for sequence update`);
    return;
  }

  const clientId = clientResult.rows[0].id;
  const nextSequence = maxSequence + 1;

  await db.query(`
    INSERT INTO client_order_sequences (client_id, next_sequence)
    VALUES ($1, $2)
    ON CONFLICT (client_id)
    DO UPDATE SET next_sequence = GREATEST(client_order_sequences.next_sequence, $2)
  `, [clientId, nextSequence]);

  console.log(`  Updated sequence for client ${clientCode}: next_sequence = ${nextSequence}`);
}

/**
 * Main import function
 */
async function main() {
  console.log('Starting Warehouse Orders Import...');
  console.log(`Looking for files in: ${CSV_DIR}`);
  console.log('');

  // Check if directory exists
  if (!fs.existsSync(CSV_DIR)) {
    console.error(`Error: Directory not found: ${CSV_DIR}`);
    process.exit(1);
  }

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const mapping of CSV_FILES) {
    const filePath = path.join(CSV_DIR, mapping.file);

    if (!fs.existsSync(filePath)) {
      console.log(`\nSkipping ${mapping.file} - file not found`);
      continue;
    }

    try {
      const result = await importCSVFile(filePath, mapping.clientCode);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      totalErrors += result.errors;

      // Update sequence for this client
      if (result.maxSequence > 0) {
        await updateClientSequence(mapping.clientCode, result.maxSequence);
      }
    } catch (error) {
      console.error(`Error processing ${mapping.file}:`, error.message);
      totalErrors++;
    }
  }

  console.log('\n========================================');
  console.log('Import Complete!');
  console.log(`Total imported: ${totalImported}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('========================================');

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
}

module.exports = { importCSVFile, main };
