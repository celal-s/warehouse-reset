require('dotenv').config();
const { pool } = require('./index');
const bcrypt = require('bcrypt');

const seedData = async () => {
  try {
    console.log('Seeding database...');

    // Insert marketplaces
    await pool.query(`
      INSERT INTO marketplaces (code, name) VALUES
        ('us', 'United States'),
        ('ca', 'Canada'),
        ('uk', 'United Kingdom'),
        ('au', 'Australia')
      ON CONFLICT (code) DO NOTHING
    `);

    // Insert clients
    await pool.query(`
      INSERT INTO clients (client_code, name, email) VALUES
        ('258', 'Client 258', 'client258@example.com'),
        ('412', 'Client 412', 'client412@example.com'),
        ('561', 'Client 561', 'client561@example.com')
      ON CONFLICT (client_code) DO NOTHING
    `);

    // Insert some default storage locations
    await pool.query(`
      INSERT INTO storage_locations (type, label) VALUES
        ('pallet', 'P-001'),
        ('pallet', 'P-002'),
        ('pallet', 'P-003'),
        ('box', 'B-001'),
        ('box', 'B-002'),
        ('box', 'B-003')
      ON CONFLICT (label) DO NOTHING
    `);

    // Insert default admin user
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await pool.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
        ($1, $2, 'Admin', 'admin')
      ON CONFLICT (email) DO NOTHING
    `, ['admin@shipfifty.com', hashedPassword]);

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await pool.end();
  }
};

seedData();
