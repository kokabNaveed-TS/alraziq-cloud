import { verifyToken } from '../utils/jwt.js';

export function authenticate(req, res, next) {
  // Accept token from Authorization header OR ?token= query param (needed for SSE / EventSource)
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.query.token || null);

  if (!token) {
    return res.status(401).json({ message: 'Authentication token missing.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}
