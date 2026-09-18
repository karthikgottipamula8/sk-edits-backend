import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbStore, supabase } from '../services/supabase.js';
import { requireAuth, sanitizeUserForPrivacy } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ Warning: JWT_SECRET environment variable is missing.');
}

/**
 * POST /api/auth/login
 * Handles login for ADMIN, CLIENT, and EDITOR roles.
 */
router.post('/login', async (req, res) => {
  try {
    await dbStore.init();
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = dbStore.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'DISABLED') {
      return res.status(403).json({ error: 'Account is disabled. Please contact SK Edits support.' });
    }

    if (role && role.toUpperCase() !== user.role) {
      return res.status(401).json({ error: `No ${role.toUpperCase()} account found with this email.` });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create activity log
    dbStore.activityLogs.push({
      id: 'log-' + Date.now(),
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: JSON.stringify({ role: user.role, timestamp: new Date() }),
      createdAt: new Date().toISOString()
    });

    res.json({
      message: 'Login successful.',
      token,
      user: sanitizeUserForPrivacy(user, user.role, true)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
});

/**
 * POST /api/auth/register
 * Allows new Client or Editor registration
 */
router.post('/register', async (req, res) => {
  try {
    await dbStore.init();
    const { fullName, email, password, role, phone, altPhone, companyName, skills, specialization } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }

    const requestedRole = (role || 'CLIENT').toUpperCase();
    if (!['CLIENT', 'EDITOR'].includes(requestedRole)) {
      return res.status(400).json({ error: 'Invalid registration role.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = dbStore.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: 'usr-' + Date.now(),
      fullName: fullName.trim(),
      email: cleanEmail,
      passwordHash,
      role: requestedRole,
      phone: phone || null,
      altPhone: altPhone || null,
      companyName: companyName || null,
      skills: skills || null,
      specialization: specialization || null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    dbStore.users.push(newUser);

    // Sync to Supabase
    try {
      await supabase.from('users').insert([newUser]);
    } catch (_) {}

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: sanitizeUserForPrivacy(newUser, newUser.role, true)
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: sanitizeUserForPrivacy(req.user, req.user.role, true)
  });
});

export default router;
