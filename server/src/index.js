require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const clientRoutes = require('./routes/clients');
const managerRoutes = require('./routes/manager');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const returnsRoutes = require('./routes/returns');
const warehouseOrderRoutes = require('./routes/warehouseOrders');
const errorHandler = require('./middleware/errorHandler');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/clients/:clientCode/warehouse-orders', warehouseOrderRoutes.clientRoutes);
app.use('/api/warehouse-orders', warehouseOrderRoutes.employeeRoutes);
app.use('/api/import', warehouseOrderRoutes.importRoutes);

// Error handler
app.use(errorHandler);

// Auto-migration: ensures schema is up-to-date on server start
const runMigrations = async () => {
  console.log('Running auto-migrations...');

  try {
    // Add missing columns to products table
    await db.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_notes TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_condition VARCHAR(50);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('  - products table: columns verified');

    // Add domain column to marketplaces for marketplace-aware Amazon URLs
    await db.query(`
      ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS domain VARCHAR(50);
      UPDATE marketplaces SET domain = 'amazon.com' WHERE code = 'us' AND domain IS NULL;
      UPDATE marketplaces SET domain = 'amazon.ca' WHERE code = 'ca' AND domain IS NULL;
      UPDATE marketplaces SET domain = 'amazon.co.uk' WHERE code = 'uk' AND domain IS NULL;
      UPDATE marketplaces SET domain = 'amazon.com.au' WHERE code = 'au' AND domain IS NULL;
    `);
    console.log('  - marketplaces table: domain column verified');

    // Cleanup auto-created inventory items from old import script
    // These are items with quantity=1, no location, awaiting_decision, sellable, no decisions
    const cleanupResult = await db.query(`
      DELETE FROM inventory_items
      WHERE quantity = 1
        AND storage_location_id IS NULL
        AND status = 'awaiting_decision'
        AND condition = 'sellable'
        AND client_decision IS NULL
        AND id NOT IN (SELECT DISTINCT inventory_item_id FROM client_decisions WHERE inventory_item_id IS NOT NULL)
        AND id NOT IN (SELECT DISTINCT inventory_item_id FROM inventory_history WHERE inventory_item_id IS NOT NULL)
    `);
    if (cleanupResult.rowCount > 0) {
      console.log(`  - inventory_items: cleaned up ${cleanupResult.rowCount} auto-created items`);
    }

    // Add missing columns to client_product_listings table
    await db.query(`
      ALTER TABLE client_product_listings ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
    `);
    console.log('  - client_product_listings table: columns verified');

    // Add missing columns to product_photos table
    await db.query(`
      ALTER TABLE product_photos ADD COLUMN IF NOT EXISTS photo_source VARCHAR(50) DEFAULT 'warehouse';
    `);
    console.log('  - product_photos table: columns verified');

    // Add missing columns to inventory_items table
    await db.query(`
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS received_by INTEGER REFERENCES users(id);
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS condition_notes TEXT;
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lot_number VARCHAR(100);
    `);
    console.log('  - inventory_items table: columns verified');

    // Create inventory_photos table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory_photos (
        id SERIAL PRIMARY KEY,
        inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        photo_url VARCHAR(500) NOT NULL,
        photo_type VARCHAR(50) DEFAULT 'condition',
        notes TEXT,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  - inventory_photos table: verified');

    // Create inventory_history table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory_history (
        id SERIAL PRIMARY KEY,
        inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        field_changed VARCHAR(50),
        old_value TEXT,
        new_value TEXT,
        quantity_change INTEGER,
        changed_by INTEGER REFERENCES users(id),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT
      );
    `);
    console.log('  - inventory_history table: verified');

    // Create returns table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS returns (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        return_type VARCHAR(20) NOT NULL CHECK (return_type IN ('post_receipt', 'pre_receipt')),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'shipped', 'completed', 'cancelled', 'unmatched')),
        label_url VARCHAR(500),
        label_uploaded_at TIMESTAMP,
        carrier VARCHAR(50),
        tracking_number VARCHAR(100),
        return_by_date DATE,
        source_identifier VARCHAR(255),
        parsed_product_name TEXT,
        match_confidence DECIMAL(3,2),
        client_notes TEXT,
        warehouse_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        shipped_at TIMESTAMP,
        shipped_by INTEGER REFERENCES users(id),
        completed_at TIMESTAMP,
        import_batch_id VARCHAR(50),
        original_filename VARCHAR(500)
      );
    `);
    console.log('  - returns table: verified');

    // Create indexes for returns table
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
      CREATE INDEX IF NOT EXISTS idx_returns_product_id ON returns(product_id);
      CREATE INDEX IF NOT EXISTS idx_returns_client_id ON returns(client_id);
      CREATE INDEX IF NOT EXISTS idx_returns_return_by_date ON returns(return_by_date);
      CREATE INDEX IF NOT EXISTS idx_returns_inventory_item_id ON returns(inventory_item_id);
    `);
    console.log('  - returns table: indexes verified');

    // Create warehouse_orders table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS warehouse_orders (
        id SERIAL PRIMARY KEY,
        warehouse_order_line_id VARCHAR(50) UNIQUE NOT NULL,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        warehouse_order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        purchase_order_date DATE,
        purchase_order_no VARCHAR(100),
        vendor VARCHAR(255),
        marketplace_id INTEGER REFERENCES marketplaces(id),
        sku VARCHAR(100),
        asin VARCHAR(20),
        fnsku VARCHAR(20),
        product_title VARCHAR(500) NOT NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        listing_id INTEGER REFERENCES client_product_listings(id) ON DELETE SET NULL,
        is_hazmat BOOLEAN DEFAULT FALSE,
        photo_link VARCHAR(500),
        purchase_bundle_count INTEGER DEFAULT 1,
        purchase_order_quantity INTEGER NOT NULL DEFAULT 0,
        selling_bundle_count INTEGER DEFAULT 1,
        expected_single_units INTEGER DEFAULT 0,
        expected_sellable_units INTEGER DEFAULT 0,
        total_cost DECIMAL(12,2),
        unit_cost DECIMAL(10,2),
        receiving_status VARCHAR(20) DEFAULT 'awaiting'
          CHECK (receiving_status IN ('awaiting', 'partial', 'complete', 'extra_units', 'cancelled')),
        received_good_units INTEGER DEFAULT 0,
        received_damaged_units INTEGER DEFAULT 0,
        received_sellable_units INTEGER DEFAULT 0,
        first_received_date TIMESTAMP,
        last_received_date TIMESTAMP,
        notes_to_warehouse TEXT,
        warehouse_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  - warehouse_orders table: verified');

    // Create receiving_log table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS receiving_log (
        id SERIAL PRIMARY KEY,
        receiving_id VARCHAR(20) UNIQUE NOT NULL,
        receiving_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        warehouse_order_id INTEGER REFERENCES warehouse_orders(id) ON DELETE SET NULL,
        warehouse_order_line_id VARCHAR(50),
        client_id INTEGER NOT NULL REFERENCES clients(id),
        purchase_order_no VARCHAR(100),
        vendor VARCHAR(255),
        sku VARCHAR(100),
        asin VARCHAR(20),
        product_title VARCHAR(500),
        received_good_units INTEGER NOT NULL DEFAULT 0,
        received_damaged_units INTEGER DEFAULT 0,
        selling_bundle_count INTEGER DEFAULT 1,
        sellable_units INTEGER DEFAULT 0,
        tracking_number VARCHAR(100),
        notes TEXT,
        receiver_id INTEGER REFERENCES users(id),
        receiver_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  - receiving_log table: verified');

    // Create client_order_sequences table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS client_order_sequences (
        client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
        next_sequence INTEGER DEFAULT 1
      );
    `);
    console.log('  - client_order_sequences table: verified');

    // Create indexes for warehouse_orders table
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_client_id ON warehouse_orders(client_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_receiving_status ON warehouse_orders(receiving_status);
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_sku ON warehouse_orders(sku);
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_asin ON warehouse_orders(asin);
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_product_id ON warehouse_orders(product_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_listing_id ON warehouse_orders(listing_id);
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_purchase_order_no ON warehouse_orders(purchase_order_no);
      CREATE INDEX IF NOT EXISTS idx_warehouse_orders_warehouse_order_date ON warehouse_orders(warehouse_order_date);
    `);
    console.log('  - warehouse_orders table: indexes verified');

    // Create indexes for receiving_log table
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_receiving_log_client_id ON receiving_log(client_id);
      CREATE INDEX IF NOT EXISTS idx_receiving_log_warehouse_order_id ON receiving_log(warehouse_order_id);
      CREATE INDEX IF NOT EXISTS idx_receiving_log_receiving_date ON receiving_log(receiving_date);
      CREATE INDEX IF NOT EXISTS idx_receiving_log_sku ON receiving_log(sku);
      CREATE INDEX IF NOT EXISTS idx_receiving_log_receiver_id ON receiving_log(receiver_id);
    `);
    console.log('  - receiving_log table: indexes verified');

    // Create receiving_photos table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS receiving_photos (
        id SERIAL PRIMARY KEY,
        receiving_log_id INTEGER REFERENCES receiving_log(id) ON DELETE CASCADE,
        receiving_id VARCHAR(20) NOT NULL,
        photo_url VARCHAR(500) NOT NULL,
        photo_type VARCHAR(50) DEFAULT 'receiving',
        notes TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by INTEGER REFERENCES users(id)
      );
    `);
    console.log('  - receiving_photos table: verified');

    // Create indexes for receiving_photos table
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_receiving_photos_receiving_log_id ON receiving_photos(receiving_log_id);
      CREATE INDEX IF NOT EXISTS idx_receiving_photos_receiving_id ON receiving_photos(receiving_id);
    `);
    console.log('  - receiving_photos table: indexes verified');

    console.log('Auto-migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error.message);
    // Don't exit - some migrations might fail if columns already exist differently
    // The important thing is that we tried
  }
};

// DB health check and migrations before starting server
const startServer = async () => {
  try {
    await db.query('SELECT 1');
    console.log('Database connection verified');

    // Run migrations
    await runMigrations();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to database:', error.message);
    process.exit(1);
  }
};

startServer();
