require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { pool } = require('./index');

// Mapping of files to client/marketplace
const fileMapping = [
  { file: '2DWorkflow_258-ca-all-fba-inv_Picklist.xlsx', clientCode: '258', marketplace: 'ca' },
  { file: '2DWorkflow_412-uk-all-fba-inv_Picklist.xlsx', clientCode: '412', marketplace: 'uk' },
  { file: '2DWorkflow_561-ca-all-fba-inv_Picklist.xlsx', clientCode: '561', marketplace: 'ca' },
  { file: '2DWorkflow_561-uk-all-fba-inv_Picklist.xlsx', clientCode: '561', marketplace: 'uk' },
  { file: '2DWorkflow_561-au-all-fba-inv_Picklist.xlsx', clientCode: '561', marketplace: 'au' }
];

async function importFile(filePath, clientCode, marketplaceCode) {
  console.log(`\nImporting ${path.basename(filePath)} for client ${clientCode} (${marketplaceCode})...`);

  // Read Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`  Found ${rows.length} rows`);

  // Get client and marketplace IDs
  const clientResult = await pool.query(
    'SELECT id FROM clients WHERE client_code = $1',
    [clientCode]
  );
  if (clientResult.rows.length === 0) {
    throw new Error(`Client ${clientCode} not found`);
  }
  const clientId = clientResult.rows[0].id;

  const marketplaceResult = await pool.query(
    'SELECT id FROM marketplaces WHERE code = $1',
    [marketplaceCode]
  );
  if (marketplaceResult.rows.length === 0) {
    throw new Error(`Marketplace ${marketplaceCode} not found`);
  }
  const marketplaceId = marketplaceResult.rows[0].id;

  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      // Extract data - normalize column names
      const sku = row.SKU || row.sku || null;
      const asin = row.ASIN || row.asin || null;
      const fnsku = row.FNSKU || row.fnsku || null;
      const title = row.TITLE || row.title || row.Title || 'Unknown Product';

      // UPC may contain multiple values separated by semicolons/newlines
      let upcRaw = row.UPC || row.upc || '';
      // Take the first UPC if multiple exist
      let upc = upcRaw.toString().split(/[;\n]/)[0].trim() || null;

      // Check if product exists by UPC (if available) or by title+asin
      let productId;

      if (upc) {
        const existingProduct = await pool.query(
          'SELECT id FROM products WHERE upc = $1',
          [upc]
        );
        if (existingProduct.rows.length > 0) {
          productId = existingProduct.rows[0].id;
        }
      }

      // If not found by UPC, check by title (for products without UPC)
      if (!productId && asin) {
        // Check if this exact product listing already exists
        const existingListing = await pool.query(`
          SELECT p.id FROM products p
          JOIN client_product_listings cpl ON p.id = cpl.product_id
          WHERE cpl.asin = $1 AND cpl.client_id = $2 AND cpl.marketplace_id = $3
        `, [asin, clientId, marketplaceId]);

        if (existingListing.rows.length > 0) {
          productId = existingListing.rows[0].id;
        }
      }

      // Create product if doesn't exist
      if (!productId) {
        const newProduct = await pool.query(
          'INSERT INTO products (upc, title) VALUES ($1, $2) RETURNING id',
          [upc, title]
        );
        productId = newProduct.rows[0].id;
        imported++;
      } else {
        updated++;
      }

      // Create or update client product listing
      await pool.query(`
        INSERT INTO client_product_listings (product_id, client_id, marketplace_id, sku, asin, fnsku)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (product_id, client_id, marketplace_id)
        DO UPDATE SET sku = $4, asin = $5, fnsku = $6
      `, [productId, clientId, marketplaceId, sku, asin, fnsku]);

    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error importing row:`, error.message);
      }
    }
  }

  console.log(`  Results: ${imported} imported, ${updated} updated, ${errors} errors`);
  return { imported, updated, errors };
}

async function main() {
  const inventoryDir = path.join(__dirname, '..', '..', '..', 'inventory files');

  console.log('Starting inventory import...');
  console.log(`Looking for files in: ${inventoryDir}`);

  let totalImported = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const mapping of fileMapping) {
    const filePath = path.join(inventoryDir, mapping.file);

    if (!fs.existsSync(filePath)) {
      console.log(`\nSkipping ${mapping.file} - file not found`);
      continue;
    }

    try {
      const result = await importFile(filePath, mapping.clientCode, mapping.marketplace);
      totalImported += result.imported;
      totalUpdated += result.updated;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`Error processing ${mapping.file}:`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('Import Complete!');
  console.log(`Total imported: ${totalImported}`);
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('========================================');

  await pool.end();
}

main().catch(console.error);
