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

        // Handle multi-value UPCs - take first one
        const upcRaw = normalizedRow.upc || normalizedRow.barcode || '';
        const upc = upcRaw.toString().split(/[;\n\r]/)[0].trim() || null;
        const title = normalizedRow.title || normalizedRow.name || normalizedRow['product name'] || 'Unknown Product';
        const sku = normalizedRow.sku || normalizedRow['seller sku'] || null;
        const asin = normalizedRow.asin || null;
        const fnsku = normalizedRow.fnsku || null;
        // Note: We don't import image_url from client files anymore
        // Images are generated from ASIN via Amazon URL pattern

        // Check if product exists by UPC
        let productId;
        if (upc) {
          const existingProduct = await db.query(
            'SELECT id FROM products WHERE upc = $1',
            [upc]
          );

          if (existingProduct.rows.length > 0) {
            productId = existingProduct.rows[0].id;
            await db.query(
              'UPDATE products SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [title, productId]
            );
          }
        }

        // FALLBACK: Check by ASIN+client+marketplace when UPC not found
        if (!productId && asin) {
          const existingListing = await db.query(`
            SELECT p.id FROM products p
            JOIN client_product_listings cpl ON p.id = cpl.product_id
            WHERE cpl.asin = $1 AND cpl.client_id = $2 AND cpl.marketplace_id = $3
          `, [asin, clientId, marketplaceId]);

          if (existingListing.rows.length > 0) {
            productId = existingListing.rows[0].id;
            // Update UPC if we now have it
            await db.query(
              'UPDATE products SET upc = COALESCE(upc, $1), title = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
              [upc, title, productId]
            );
          }
        }

        // Create product only if truly doesn't exist
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

        // Create or update client product listing (no image_url - use Amazon ASIN pattern)
        await db.query(`
          INSERT INTO client_product_listings (product_id, client_id, marketplace_id, sku, asin, fnsku)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (product_id, client_id, marketplace_id)
          DO UPDATE SET sku = $4, asin = $5, fnsku = $6
        `, [productId, clientId, marketplaceId, sku, asin, fnsku]);

        // NOTE: Import creates catalog only - inventory is NOT created here
        // Inventory is created when items are physically received at the warehouse
        // via the /inventory/receive endpoint

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
