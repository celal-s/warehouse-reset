const express = require('express');
const router = express.Router();
const db = require('../db');
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

// POST /login - User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email, join with clients to get client_code if applicable
    const userResult = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.client_id, u.is_active, c.client_code
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isValidPassword = await authService.comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = authService.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      client_id: user.client_id
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        client_id: user.client_id,
        client_code: user.client_code
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /signup - Disabled (use admin user management instead)
router.post('/signup', (req, res) => {
  res.status(403).json({
    error: 'Public signup is disabled. Please contact an administrator to create an account.'
  });
});

// GET /me - Get current authenticated user
router.get('/me', authenticate, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.client_id, u.is_active, u.created_at, c.client_code
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      client_id: user.client_id,
      client_code: user.client_code,
      is_active: user.is_active,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
