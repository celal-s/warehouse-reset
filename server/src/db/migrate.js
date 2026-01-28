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
  upc VARCHAR(50),
  title VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product photos (at product level, first SKU instance only)
CREATE TABLE IF NOT EXISTS product_photos (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  photo_url VARCHAR(500) NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'main',
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

-- Inventory items
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_client ON client_product_listings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_sku ON client_product_listings(sku);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_asin ON client_product_listings(asin);
CREATE INDEX IF NOT EXISTS idx_client_product_listings_fnsku ON client_product_listings(fnsku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_client ON inventory_items(client_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
`;

async function runMigrations() {
  try {
    console.log('Running migrations...');
    await pool.query(migrations);
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigrations();
