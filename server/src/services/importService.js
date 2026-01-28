const XLSX = require('xlsx');
const db = require('../db');

const importService = {
  // Parse Excel file and return rows as objects
  parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet);
  },

  // Import products from parsed Excel data
  async importProducts(rows, clientCode, marketplaceCode = 'us') {
    const results = {
      imported: 0,
      updated: 0,
      errors: []
    };

    // Get client and marketplace IDs
    const clientResult = await db.query(
      'SELECT id FROM clients WHERE client_code = $1',
      [clientCode]
    );
    if (clientResult.rows.length === 0) {
      throw new Error(`Client ${clientCode} not found`);
    }
    const clientId = clientResult.rows[0].id;

    const marketplaceResult = await db.query(
      'SELECT id FROM marketplaces WHERE code = $1',
      [marketplaceCode]
    );
    if (marketplaceResult.rows.length === 0) {
      throw new Error(`Marketplace ${marketplaceCode} not found`);
    }
    const marketplaceId = marketplaceResult.rows[0].id;

    for (const row of rows) {
      try {
        // Normalize column names (Excel files may have different casing)
        const normalizedRow = {};
        for (const key of Object.keys(row)) {
          normalizedRow[key.toLowerCase().trim()] = row[key];
        }

        const upc = normalizedRow.upc || normalizedRow.barcode || null;
        const title = normalizedRow.title || normalizedRow.name || normalizedRow['product name'] || 'Unknown Product';
        const sku = normalizedRow.sku || normalizedRow['seller sku'] || null;
        const asin = normalizedRow.asin || null;
        const fnsku = normalizedRow.fnsku || null;

        // Check if product exists by UPC
        let productId;
        if (upc) {
          const existingProduct = await db.query(
            'SELECT id FROM products WHERE upc = $1',
            [upc]
          );

          if (existingProduct.rows.length > 0) {
            productId = existingProduct.rows[0].id;
            // Update title if needed
            await db.query(
              'UPDATE products SET title = $1 WHERE id = $2',
              [title, productId]
            );
          }
        }

        // Create product if doesn't exist
        if (!productId) {
          const newProduct = await db.query(
            'INSERT INTO products (upc, title) VALUES ($1, $2) RETURNING id',
            [upc, title]
          );
          productId = newProduct.rows[0].id;
          results.imported++;
        } else {
          results.updated++;
        }

        // Create or update client product listing
        await db.query(`
          INSERT INTO client_product_listings (product_id, client_id, marketplace_id, sku, asin, fnsku)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (product_id, client_id, marketplace_id)
          DO UPDATE SET sku = $4, asin = $5, fnsku = $6
        `, [productId, clientId, marketplaceId, sku, asin, fnsku]);

        // Create inventory item for client
        await db.query(`
          INSERT INTO inventory_items (product_id, client_id, quantity, condition, status)
          VALUES ($1, $2, 1, 'sellable', 'awaiting_decision')
          ON CONFLICT DO NOTHING
        `, [productId, clientId]);

      } catch (error) {
        results.errors.push({
          row: row,
          error: error.message
        });
      }
    }

    return results;
  }
};

module.exports = importService;
