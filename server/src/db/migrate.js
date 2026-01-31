require('dotenv').config();
const { pool } = require('./index');

const migrations = `
-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  client_code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketplaces table
CREATE TABLE IF NOT EXISTS marketplaces (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  upc TEXT,
  title VARCHAR(500) NOT NULL,
  warehouse_notes TEXT,
  warehouse_condition VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product photos (at product level, first SKU instance only)
CREATE TABLE IF NOT EXISTS product_photos (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  photo_url VARCHAR(500) NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'main',
  photo_source VARCHAR(50) DEFAULT 'warehouse',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client product listings (connects products to clients with marketplace-specific identifiers)
CREATE TABLE IF NOT EXISTS client_product_listings (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  marketplace_id INTEGER REFERENCES marketplaces(id),
  sku VARCHAR(100),
  asin VARCHAR(20),
  fnsku VARCHAR(20),
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, client_id, marketplace_id)
);

-- Storage locations (pallets, boxes)
CREATE TABLE IF NOT EXISTS storage_locations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  label VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory items (no UNIQUE constraint - allow multiple entries per product-client for different batches/lots)
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  storage_location_id INTEGER REFERENCES storage_locations(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  condition VARCHAR(50) DEFAULT 'sellable',
  status VARCHAR(50) DEFAULT 'awaiting_decision',
  client_decision VARCHAR(50),
  decision_notes TEXT,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  received_by INTEGER REFERENCES users(id),
  condition_notes TEXT,
  lot_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory photos (photos of actual physical items in warehouse)
CREATE TABLE IF NOT EXISTS inventory_photos (
  id SERIAL PRIMARY KEY,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
  photo_url VARCHAR(500) NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'condition',
  notes TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_by INTEGER REFERENCES users(id)
);

-- Inventory history (audit trail for all inventory changes)
CREATE TABLE IF NOT EXISTS inventory_history (
  id SERIAL PRIMARY KEY,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  quantity_change INTEGER,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER REFERENCES users(id),
  reason TEXT
);

-- Client decisions (separate table for return label uploads and decision tracking)
CREATE TABLE IF NOT EXISTS client_decisions (
  id SERIAL PRIMARY KEY,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
  decision VARCHAR(50) NOT NULL,
  shipping_label_url VARCHAR(500),
  notes TEXT,
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  action VARCHAR(100) NOT NULL,
  actor_type VARCHAR(50),
  actor_identifier VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'client')),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_client ON client_product_listings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_sku ON client_product_listings(sku);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_asin ON client_product_listings(asin);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_fnsku ON client_product_listings(fnsku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_client ON inventory_items(client_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_photos_item ON inventory_photos(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_item ON inventory_history(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

// Migration for existing databases - add new columns
const addColumns = `
-- Add warehouse observation fields to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_condition VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add image_url to client_product_listings
ALTER TABLE client_product_listings ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Add photo_source to product_photos
ALTER TABLE product_photos ADD COLUMN IF NOT EXISTS photo_source VARCHAR(50) DEFAULT 'warehouse';

-- Add receiving tracking to inventory_items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS received_by INTEGER REFERENCES users(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS condition_notes TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lot_number VARCHAR(100);

-- Add listing_id to connect inventory to specific marketplace listings
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS listing_id INTEGER REFERENCES client_product_listings(id) ON DELETE SET NULL;

-- Remove UNIQUE constraint from inventory_items if it exists (allow multiple entries)
-- Note: This needs manual handling as ALTER TABLE DROP CONSTRAINT is tricky
`;

async function runMigrations() {
  try {
    console.log('Running migrations...');
    await pool.query(migrations);
    console.log('Base migrations completed');

    // Run column additions for existing databases
    console.log('Running column additions...');
    const statements = addColumns.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        // Ignore errors for columns that already exist
        if (!err.message.includes('already exists')) {
          console.warn('Column addition warning:', err.message);
        }
      }
    }

    // Create new tables if they don't exist
    console.log('Ensuring new tables exist...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_photos (
        id SERIAL PRIMARY KEY,
        inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
        photo_url VARCHAR(500) NOT NULL,
        photo_type VARCHAR(50) DEFAULT 'condition',
        notes TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS inventory_history (
        id SERIAL PRIMARY KEY,
        inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        field_changed VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        quantity_change INTEGER,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by INTEGER REFERENCES users(id),
        reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_items_product ON inventory_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_photos_item ON inventory_photos(inventory_item_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_history_item ON inventory_history(inventory_item_id);
    `);

    // Prevent future UPC duplicates (partial index - only non-null/non-empty UPCs)
    console.log('Adding unique constraint on UPC...');
    try {
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_upc_unique
        ON products (upc)
        WHERE upc IS NOT NULL AND upc != ''
      `);
    } catch (err) {
      if (err.message.includes('duplicate key')) {
        console.warn('UPC constraint skipped - duplicates exist. Run cleanup first.');
      } else {
        console.warn('UPC constraint warning:', err.message);
      }
    }

    // Optimize ASIN+client+marketplace lookups for deduplication
    console.log('Adding composite index for ASIN+client+marketplace...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cpl_asin_client_marketplace
      ON client_product_listings (asin, client_id, marketplace_id)
      WHERE asin IS NOT NULL
    `);

    // Explicitly add listing_id column (critical for marketplace differentiation)
    console.log('Adding listing_id column to inventory_items...');
    try {
      await pool.query(`
        ALTER TABLE inventory_items
        ADD COLUMN IF NOT EXISTS listing_id INTEGER
        REFERENCES client_product_listings(id) ON DELETE SET NULL
      `);
      console.log('  - listing_id column added/verified');
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.error('  - listing_id column error:', err.message);
      }
    }

    // Add index for listing_id lookups
    console.log('Adding index for inventory_items.listing_id...');
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_inventory_items_listing
        ON inventory_items (listing_id)
        WHERE listing_id IS NOT NULL
      `);
    } catch (err) {
      console.warn('  - listing_id index warning:', err.message);
    }

    // Backfill listing_id for existing inventory where unambiguous (single listing per product+client)
    console.log('Backfilling listing_id for existing inventory...');
    try {
      const backfillResult = await pool.query(`
        UPDATE inventory_items i
        SET listing_id = subq.listing_id
        FROM (
          SELECT ii.id as inventory_id, cpl.id as listing_id
          FROM inventory_items ii
          JOIN (
            SELECT product_id, client_id, MIN(id) as id
            FROM client_product_listings
            GROUP BY product_id, client_id
            HAVING COUNT(*) = 1
          ) cpl ON ii.product_id = cpl.product_id AND ii.client_id = cpl.client_id
          WHERE ii.listing_id IS NULL
        ) subq
        WHERE i.id = subq.inventory_id
      `);
      console.log(`Backfilled listing_id for ${backfillResult.rowCount} inventory items`);
    } catch (err) {
      console.warn('Backfill warning:', err.message);
    }

    // Update role constraint to include 'manager' role
    console.log('Updating role constraint...');
    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('admin', 'manager', 'employee', 'client'));
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigrations();
