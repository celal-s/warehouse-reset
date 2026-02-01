/**
 * Import Warehouse Orders & Receiving Log via API
 *
 * This script reads CSV files and imports them via the production API endpoints.
 * No direct database connection needed - works through HTTP.
 *
 * Usage:
 *   # Clean up test data
 *   node src/scripts/importViaAPI.js cleanup
 *
 *   # Import warehouse orders for a client
 *   node src/scripts/importViaAPI.js orders 561
 *   node src/scripts/importViaAPI.js orders 258
 *   node src/scripts/importViaAPI.js orders 412
 *
 *   # Import receiving log
 *   node src/scripts/importViaAPI.js receiving
 *
 *   # Check stats
 *   node src/scripts/importViaAPI.js stats
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const API_URL = process.env.API_URL || 'https://warehouse-api-7w73.onrender.com';
const IMPORT_SECRET = process.env.IMPORT_SECRET || 'warehouse-import-2025';
const CSV_DIR = path.join(__dirname, '../../../../full-receiving-implementation');

// Marketplace code mapping
const MARKETPLACE_MAP = {
  'CA': 'ca', 'US': 'us', 'UK': 'uk', 'UK FBA': 'uk', 'AU': 'au',
  'ca': 'ca', 'us': 'us', 'uk': 'uk', 'au': 'au'
};

/**
 * Parse a CSV line, handling quoted fields
 */
function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr === '12/30/1899') return null;

  // MM/DD/YYYY format
  const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // MM/DD/YYYY HH:MM:SS format
  const mmddyyyyTime = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (mmddyyyyTime) {
    const [, month, day, year, hour, minute, second] = mmddyyyyTime;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
  }

  return dateStr.match(/^\d{4}-\d{2}-\d{2}/) ? dateStr : null;
}

function parseBoolean(value) {
  if (!value) return false;
  const lower = value.toString().toLowerCase().trim();
  return lower === 'yes' || lower === 'true' || lower === '1' || lower === 'y';
}

function parseDecimal(value) {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value.toString().replace(/[$,]/g, '').trim());
  return isNaN(num) ? null : num;
}

function parseInt_(value) {
  if (!value || value.trim() === '') return 0;
  const num = parseInt(value.toString().trim(), 10);
  return isNaN(num) ? 0 : num;
}

function mapReceivingStatus(status) {
  if (!status) return 'awaiting';
  const lower = status.toString().toLowerCase().trim();
  switch (lower) {
    case 'awaiting': return 'awaiting';
    case 'partial': return 'partial';
    case 'complete': return 'complete';
    case 'extra units':
    case 'extra_units': return 'extra_units';
    case 'cancelled': return 'cancelled';
    default: return 'awaiting';
  }
}

/**
 * Make HTTP request to API
 */
function apiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Import-Secret': IMPORT_SECRET
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(300000); // 5 minute timeout

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Parse warehouse orders CSV
 */
function parseWarehouseOrdersCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const headerMap = {};
  headers.forEach((h, i) => headerMap[h.trim()] = i);

  const orders = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const getValue = (name) => {
      const idx = headerMap[name];
      return idx !== undefined ? (fields[idx] || '').trim() : '';
    };

    const lineId = getValue('warehouse_order_line_ID');
    const productTitle = getValue('selling_marketplace_product_title');
    if (!lineId || !productTitle) continue;

    orders.push({
      warehouse_order_line_id: lineId,
      purchase_order_date: parseDate(getValue('purchase_order_date')),
      purchase_order_no: getValue('purchase_order_no'),
      vendor: getValue('vendor'),
      marketplace_code: MARKETPLACE_MAP[getValue('selling_marketplace')],
      sku: getValue('selling_marketplace_client_SKU'),
      asin: getValue('selling_marketplace_ASIN'),
      product_title: productTitle,
      is_hazmat: parseBoolean(getValue('is_hazmat')),
      photo_link: getValue('selling_marketplace_photo_link'),
      selling_bundle_count: parseInt_(getValue('selling_marketplace_bundle_count')) || 1,
      purchase_bundle_count: parseInt_(getValue('purchase_bundle_count')) || 1,
      purchase_order_quantity: parseInt_(getValue('purchase_order_quantity')) || 0,
      expected_single_units: parseInt_(getValue('purchase_order_quantity_single_units')) || 0,
      expected_sellable_units: parseInt_(getValue('total_sellable_units')) || 0,
      total_cost: parseDecimal(getValue('total_warehouse_order_cost')),
      unit_cost: parseDecimal(getValue('sellable_unit_cost')),
      notes_to_warehouse: getValue('notes_to_warehouse'),
      receiving_status: mapReceivingStatus(getValue('warehouse_order_receiving_status')),
      received_good_units: parseInt_(getValue('received_single_units_quantity')) || 0,
      received_damaged_units: parseInt_(getValue('received_single_units_damaged_quantity')) || 0,
      received_sellable_units: parseInt_(getValue('received_sellable_units_quantity')) || 0,
      first_received_date: parseDate(getValue('first_received_date')),
      last_received_date: parseDate(getValue('last_received_date')),
      warehouse_notes: getValue('warehouse_notes')
    });
  }

  return orders;
}

/**
 * Parse receiving log CSV
 */
function parseReceivingLogCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const headerMap = {};
  headers.forEach((h, i) => {
    const trimmed = h.trim();
    if (i === 0) headerMap['receiving_id'] = i;
    else if (trimmed) headerMap[trimmed] = i;
  });

  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const getValue = (name) => {
      const idx = headerMap[name];
      return idx !== undefined ? (fields[idx] || '').trim() : '';
    };

    const receivingId = fields[0]?.trim();
    if (!receivingId || !receivingId.startsWith('RCV')) continue;

    const receivedGoodUnits = parseInt_(getValue('received_single_units_quantity')) || 0;
    const sellingBundleCount = parseInt_(getValue('selling_marketplace_bundle_count')) || 1;
    let sellableUnits = parseInt_(getValue('total_sellable_units'));
    if (!sellableUnits && receivedGoodUnits > 0) {
      sellableUnits = Math.floor(receivedGoodUnits / sellingBundleCount);
    }

    entries.push({
      receiving_id: receivingId,
      receiving_date: parseDate(getValue('receiving_date')),
      warehouse_order_line_id: getValue('warehouse_order_line_ID'),
      client_code: getValue('client_code'),
      purchase_order_no: getValue('purchase_order_no'),
      vendor: getValue('vendor'),
      sku: getValue('sku'),
      asin: getValue('asin'),
      product_title: getValue('selling_marketplace_product_title'),
      received_good_units: receivedGoodUnits,
      received_damaged_units: parseInt_(getValue('received_single_units_damaged_quantity')) || 0,
      selling_bundle_count: sellingBundleCount,
      sellable_units: sellableUnits,
      tracking_number: getValue('tracking_number'),
      notes: getValue('notes'),
      receiver: getValue('receiver')
    });
  }

  return entries;
}

// ============================================================================
// COMMANDS
// ============================================================================

async function cleanup() {
  console.log('Running cleanup...');
  const result = await apiRequest('POST', '/api/import/cleanup');
  console.log('Result:', JSON.stringify(result.data, null, 2));
}

async function importOrders(clientCode) {
  const filePath = path.join(CSV_DIR, `${clientCode} - Warehouse Orders.csv`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Parsing ${path.basename(filePath)}...`);
  const orders = parseWarehouseOrdersCSV(filePath);
  console.log(`Found ${orders.length} orders`);

  if (orders.length === 0) {
    console.log('No orders to import');
    return;
  }

  // Send in batches of 100
  const batchSize = 100;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    console.log(`Importing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(orders.length/batchSize)}...`);

    const result = await apiRequest('POST', '/api/import/warehouse-orders', {
      orders: batch,
      clientCode
    });

    if (result.status === 200 && result.data.results) {
      totalImported += result.data.results.imported || 0;
      totalSkipped += result.data.results.skipped || 0;
      totalErrors += result.data.results.errors || 0;
    } else {
      console.error('Batch failed:', result);
    }
  }

  console.log('\n========================================');
  console.log(`Client ${clientCode} Import Complete!`);
  console.log(`Total imported: ${totalImported}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('========================================');
}

async function importReceiving() {
  const filePath = path.join(CSV_DIR, '00-receiving - Receiving Log.csv');
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log('Parsing receiving log...');
  const entries = parseReceivingLogCSV(filePath);
  console.log(`Found ${entries.length} entries`);

  if (entries.length === 0) {
    console.log('No entries to import');
    return;
  }

  // Send in batches of 500
  const batchSize = 500;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalLinked = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    console.log(`Importing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(entries.length/batchSize)}...`);

    const result = await apiRequest('POST', '/api/import/receiving-log', { entries: batch });

    if (result.status === 200 && result.data.results) {
      totalImported += result.data.results.imported || 0;
      totalSkipped += result.data.results.skipped || 0;
      totalErrors += result.data.results.errors || 0;
      totalLinked += result.data.results.linkedToOrders || 0;
    } else {
      console.error('Batch failed:', result);
    }
  }

  console.log('\n========================================');
  console.log('Receiving Log Import Complete!');
  console.log(`Total imported: ${totalImported}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Linked to orders: ${totalLinked}`);
  console.log('========================================');
}

async function showStats() {
  console.log('Fetching stats...');
  const result = await apiRequest('GET', '/api/import/stats');
  console.log('\n========================================');
  console.log('Import Statistics');
  console.log('========================================\n');
  console.log('Warehouse Orders by Client:');
  console.table(result.data.warehouseOrdersByClient);
  console.log('\nReceiving Log by Client:');
  console.table(result.data.receivingLogByClient);
  console.log('\nReceiving Links:');
  console.log(result.data.receivingLinks);
  console.log('\nStatus Distribution:');
  console.table(result.data.statusDistribution);
  console.log('\nClient Sequences:');
  console.table(result.data.clientSequences);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log(`API URL: ${API_URL}`);
  console.log(`CSV Directory: ${CSV_DIR}\n`);

  switch (command) {
    case 'cleanup':
      await cleanup();
      break;
    case 'orders':
      if (!arg) {
        console.error('Usage: node importViaAPI.js orders <clientCode>');
        process.exit(1);
      }
      await importOrders(arg);
      break;
    case 'receiving':
      await importReceiving();
      break;
    case 'stats':
      await showStats();
      break;
    default:
      console.log('Usage:');
      console.log('  node importViaAPI.js cleanup              - Clean up test data');
      console.log('  node importViaAPI.js orders <clientCode>  - Import orders for a client');
      console.log('  node importViaAPI.js receiving            - Import receiving log');
      console.log('  node importViaAPI.js stats                - Show import statistics');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
