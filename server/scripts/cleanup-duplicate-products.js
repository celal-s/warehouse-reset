require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/db');

async function runDiagnostics() {
  console.log('\n=== DIAGNOSTIC QUERIES ===\n');

  // 1. Find duplicate UPCs
  console.log('1. Duplicate UPCs:');
  const dupUpc = await pool.query(`
    SELECT upc, COUNT(*) as count, array_agg(id) as product_ids
    FROM products
    WHERE upc IS NOT NULL AND upc != ''
    GROUP BY upc
    HAVING COUNT(*) > 1
  `);
  console.log(`   Found ${dupUpc.rows.length} duplicate UPC groups`);
  dupUpc.rows.forEach(r => console.log(`   - UPC ${r.upc}: ${r.count} products (IDs: ${r.product_ids.join(', ')})`));

  // 2. Find products sharing same ASIN+client+marketplace
  console.log('\n2. Duplicate ASIN+client+marketplace:');
  const dupAsin = await pool.query(`
    SELECT cpl.asin, cpl.client_id, cpl.marketplace_id,
           COUNT(DISTINCT cpl.product_id) as product_count,
           array_agg(DISTINCT cpl.product_id) as product_ids
    FROM client_product_listings cpl
    WHERE cpl.asin IS NOT NULL
    GROUP BY cpl.asin, cpl.client_id, cpl.marketplace_id
    HAVING COUNT(DISTINCT cpl.product_id) > 1
  `);
  console.log(`   Found ${dupAsin.rows.length} duplicate ASIN groups`);
  dupAsin.rows.forEach(r => console.log(`   - ASIN ${r.asin} (client ${r.client_id}, marketplace ${r.marketplace_id}): ${r.product_count} products (IDs: ${r.product_ids.join(', ')})`));

  // 3. Find orphan products
  console.log('\n3. Orphan products (no listings, no inventory):');
  const orphans = await pool.query(`
    SELECT p.id, p.upc, p.title
    FROM products p
    LEFT JOIN client_product_listings cpl ON p.id = cpl.product_id
    LEFT JOIN inventory_items i ON p.id = i.product_id
    WHERE cpl.id IS NULL AND i.id IS NULL
  `);
  console.log(`   Found ${orphans.rows.length} orphan products`);
  orphans.rows.slice(0, 10).forEach(r => console.log(`   - ID ${r.id}: ${r.title?.substring(0, 50)}...`));
  if (orphans.rows.length > 10) console.log(`   ... and ${orphans.rows.length - 10} more`);

  return {
    duplicateUpcCount: dupUpc.rows.length,
    duplicateAsinCount: dupAsin.rows.length,
    orphanCount: orphans.rows.length
  };
}

async function cleanupDuplicates() {
  console.log('\n=== CLEANUP DUPLICATES ===\n');

  // 2.1 Merge UPC duplicates (keep lowest ID)
  console.log('Merging UPC duplicates...');

  // Create merge mapping
  await pool.query(`
    CREATE TEMP TABLE product_merge_map AS
    WITH ranked AS (
        SELECT id, upc, ROW_NUMBER() OVER (PARTITION BY upc ORDER BY id) as rn
        FROM products
        WHERE upc IS NOT NULL AND upc != ''
          AND upc IN (SELECT upc FROM products WHERE upc IS NOT NULL AND upc != '' GROUP BY upc HAVING COUNT(*) > 1)
    )
    SELECT d.id as duplicate_id, c.id as canonical_id
    FROM ranked d
    JOIN ranked c ON d.upc = c.upc AND c.rn = 1
    WHERE d.rn > 1
  `);

  const mergeCount = await pool.query('SELECT COUNT(*) FROM product_merge_map');
  console.log(`   Found ${mergeCount.rows[0].count} products to merge`);

  if (parseInt(mergeCount.rows[0].count) > 0) {
    // Update inventory_items references
    const invResult = await pool.query(`
      UPDATE inventory_items SET product_id = m.canonical_id
      FROM product_merge_map m WHERE product_id = m.duplicate_id
    `);
    console.log(`   Updated ${invResult.rowCount} inventory items`);

    // Update product_photos references
    const photoResult = await pool.query(`
      UPDATE product_photos SET product_id = m.canonical_id
      FROM product_merge_map m WHERE product_id = m.duplicate_id
    `);
    console.log(`   Updated ${photoResult.rowCount} product photos`);

    // Delete conflicting listings, then update remaining
    const deleteListings = await pool.query(`
      DELETE FROM client_product_listings cpl
      USING product_merge_map m
      WHERE cpl.product_id = m.duplicate_id
        AND EXISTS (SELECT 1 FROM client_product_listings e
                    WHERE e.product_id = m.canonical_id
                      AND e.client_id = cpl.client_id
                      AND e.marketplace_id = cpl.marketplace_id)
    `);
    console.log(`   Deleted ${deleteListings.rowCount} conflicting listings`);

    const updateListings = await pool.query(`
      UPDATE client_product_listings SET product_id = m.canonical_id
      FROM product_merge_map m WHERE product_id = m.duplicate_id
    `);
    console.log(`   Updated ${updateListings.rowCount} listings`);

    // Delete duplicate products
    const deleteProducts = await pool.query(`
      DELETE FROM products WHERE id IN (SELECT duplicate_id FROM product_merge_map)
    `);
    console.log(`   Deleted ${deleteProducts.rowCount} duplicate products`);
  }

  await pool.query('DROP TABLE IF EXISTS product_merge_map');

  // 2.2 Delete orphan products
  console.log('\nDeleting orphan products...');
  const orphanResult = await pool.query(`
    DELETE FROM products p
    WHERE NOT EXISTS (SELECT 1 FROM client_product_listings WHERE product_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM inventory_items WHERE product_id = p.id)
  `);
  console.log(`   Deleted ${orphanResult.rowCount} orphan products`);
}

async function main() {
  const args = process.argv.slice(2);
  const runCleanup = args.includes('--cleanup');

  try {
    const diagnostics = await runDiagnostics();

    const totalIssues = diagnostics.duplicateUpcCount + diagnostics.duplicateAsinCount + diagnostics.orphanCount;

    if (totalIssues === 0) {
      console.log('\n No duplicates or orphans found. Database is clean.');
    } else if (runCleanup) {
      await cleanupDuplicates();
      console.log('\n Cleanup complete. Running diagnostics again...');
      await runDiagnostics();
    } else {
      console.log('\n Issues found. Run with --cleanup flag to fix them:');
      console.log('   node scripts/cleanup-duplicate-products.js --cleanup');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
