const authService = require('../services/authService');

/**
 * Authentication middleware
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches the user to the request object
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);

    const user = await authService.verifyToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Authorization middleware factory
 * Returns middleware that checks if the authenticated user's role
 * is included in the allowed roles
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  const middleware = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
  // Expose roles for introspection
  middleware._roles = roles;
  return middleware;
};

module.exports = {
  authenticate,
  authorize
};
