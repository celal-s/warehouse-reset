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
