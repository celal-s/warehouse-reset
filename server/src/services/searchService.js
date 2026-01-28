const db = require('../db');

const searchService = {
  // Search products by UPC, SKU, ASIN, FNSKU, or title
  async searchProducts(query, clientId = null) {
    const searchTerm = `%${query}%`;

    let sql = `
      SELECT DISTINCT
        p.id,
        p.upc,
        p.title,
        json_agg(DISTINCT jsonb_build_object(
          'client_id', c.id,
          'client_code', c.client_code,
          'client_name', c.name,
          'sku', cpl.sku,
          'asin', cpl.asin,
          'fnsku', cpl.fnsku,
          'marketplace', m.code
        )) FILTER (WHERE c.id IS NOT NULL) as client_listings
      FROM products p
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id
      LEFT JOIN clients c ON cpl.client_id = c.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE (
        p.upc ILIKE $1 OR
        p.title ILIKE $1 OR
        cpl.sku ILIKE $1 OR
        cpl.asin ILIKE $1 OR
        cpl.fnsku ILIKE $1
      )
    `;

    const params = [searchTerm];

    if (clientId) {
      sql += ` AND cpl.client_id = $2`;
      params.push(clientId);
    }

    sql += `
      GROUP BY p.id, p.upc, p.title
      ORDER BY p.title
      LIMIT 50
    `;

    const result = await db.query(sql, params);
    return result.rows;
  },

  // Search by exact UPC (for barcode scanning)
  async searchByUPC(upc) {
    const result = await db.query(`
      SELECT
        p.id,
        p.upc,
        p.title,
        json_agg(DISTINCT jsonb_build_object(
          'client_id', c.id,
          'client_code', c.client_code,
          'client_name', c.name,
          'sku', cpl.sku,
          'asin', cpl.asin,
          'fnsku', cpl.fnsku,
          'marketplace', m.code
        )) FILTER (WHERE c.id IS NOT NULL) as client_listings,
        (SELECT json_agg(jsonb_build_object('id', pp.id, 'url', pp.photo_url, 'type', pp.photo_type))
         FROM product_photos pp WHERE pp.product_id = p.id) as photos,
        (SELECT COUNT(*) FROM product_photos pp WHERE pp.product_id = p.id) > 0 as has_photos
      FROM products p
      LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id
      LEFT JOIN clients c ON cpl.client_id = c.id
      LEFT JOIN marketplaces m ON cpl.marketplace_id = m.id
      WHERE p.upc = $1
      GROUP BY p.id, p.upc, p.title
    `, [upc]);

    return result.rows[0] || null;
  }
};

module.exports = searchService;
