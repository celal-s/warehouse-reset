require('dotenv').config();
const { pool } = require('./index');
const bcrypt = require('bcrypt');

const seedData = async () => {
  try {
    console.log('Seeding database...');

    // Insert marketplaces with domain
    await pool.query(`
      INSERT INTO marketplaces (code, name, domain) VALUES
        ('us', 'United States', 'amazon.com'),
        ('ca', 'Canada', 'amazon.ca'),
        ('uk', 'United Kingdom', 'amazon.co.uk'),
        ('au', 'Australia', 'amazon.com.au')
      ON CONFLICT (code) DO UPDATE SET domain = EXCLUDED.domain
    `);

    // Insert clients
    await pool.query(`
      INSERT INTO clients (client_code, name, email) VALUES
        ('258', 'Client 258', 'client258@example.com'),
        ('412', 'Client 412', 'client412@example.com'),
        ('561', 'Client 561', 'client561@example.com')
      ON CONFLICT (client_code) DO NOTHING
    `);

    // Storage locations are now created on-the-fly by employees during scanning
    // No default locations are seeded

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
