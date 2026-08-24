/**
 * adminAuth.js — Admin JWT Authentication Middleware
 *
 * Validates the Authorization: Bearer <token> header on admin routes.
 * The token is a JWT issued by POST /admin/login (8-hour TTL).
 */
const { verifyAdminToken } = require('../utils/jwt');

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const decoded = verifyAdminToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  req.admin = decoded; // Attach admin info to request
  next();
}

module.exports = adminAuth;
