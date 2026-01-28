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

// POST /signup - User registration
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role, client_code } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }

    // Validate role
    const validRoles = ['admin', 'employee', 'client'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    let clientId = null;

    // For client role, validate client_code
    if (role === 'client') {
      if (!client_code) {
        return res.status(400).json({ error: 'Client code is required for client role' });
      }

      const clientResult = await db.query(
        'SELECT id FROM clients WHERE client_code = $1',
        [client_code]
      );

      if (clientResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid client code' });
      }

      clientId = clientResult.rows[0].id;
    }

    // Hash password
    const hashedPassword = await authService.hashPassword(password);

    // Create user
    const newUserResult = await db.query(
      `INSERT INTO users (email, password_hash, name, role, client_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id, email, name, role, client_id`,
      [email, hashedPassword, name, role, clientId]
    );

    const newUser = newUserResult.rows[0];

    // Generate JWT token
    const token = authService.generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      client_id: newUser.client_id
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        client_id: newUser.client_id,
        client_code: role === 'client' ? client_code : null
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
