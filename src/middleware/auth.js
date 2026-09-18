import jwt from 'jsonwebtoken';
import { dbStore } from '../services/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ Warning: JWT_SECRET environment variable is missing.');
}

/**
 * Middleware: Verifies JWT token and attaches authenticated user object to req.user
 */
export async function requireAuth(req, res, next) {
  try {
    await dbStore.init();

    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = dbStore.users.find(u => u.id === decoded.userId);

    if (!user || user.status === 'DISABLED') {
      return res.status(403).json({ error: 'Account is inactive or disabled.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

/**
 * Middleware: Enforces Role-Based Access Control (RBAC)
 * @param {string[]} allowedRoles - Array of allowed roles (e.g. ['ADMIN'], ['CLIENT', 'ADMIN'])
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Unauthorized for this operation.' });
    }
    next();
  };
}

/**
 * Utility: Sanitizes user object based on viewer's role for privacy compliance.
 * Clients and Editors CANNOT see each other's phone numbers, emails, or personal details.
 */
export function sanitizeUserForPrivacy(targetUser, viewerRole, isSelf = false) {
  if (!targetUser) return null;

  const sanitized = {
    id: targetUser.id,
    fullName: targetUser.fullName,
    role: targetUser.role,
    avatar: targetUser.avatar,
    companyName: targetUser.companyName,
    skills: targetUser.skills,
    specialization: targetUser.specialization
  };

  // If viewer is ADMIN or user is viewing their OWN profile, expose full personal details
  if (viewerRole === 'ADMIN' || isSelf) {
    sanitized.email = targetUser.email;
    sanitized.phone = targetUser.phone;
    sanitized.altPhone = targetUser.altPhone;
    sanitized.status = targetUser.status;
    sanitized.createdAt = targetUser.createdAt;
  }

  // Display Admin identity as "SK Edits" to Clients and Editors
  if (targetUser.role === 'ADMIN' && viewerRole !== 'ADMIN') {
    sanitized.fullName = 'SK Edits';
  }

  return sanitized;
}
