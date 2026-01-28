const db = require('../db');

// Middleware to validate client code and attach client info to request
const clientIsolation = async (req, res, next) => {
  const { clientCode } = req.params;

  if (!clientCode) {
    return res.status(400).json({ error: 'Client code is required' });
  }

  try {
    const result = await db.query(
      'SELECT id, client_code, name, email FROM clients WHERE client_code = $1',
      [clientCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Attach client info to request for use in route handlers
    req.client = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = clientIsolation;
