import express from 'express';
import bcrypt from 'bcryptjs';
import { dbStore, supabase } from '../services/supabase.js';
import { requireAuth, requireRole, sanitizeUserForPrivacy } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/users
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { role } = req.query;

    let users = dbStore.users;
    if (role) {
      users = users.filter(u => u.role === role.toUpperCase());
    }

    const sanitizedUsers = users.map(u => sanitizeUserForPrivacy(u, req.user.role));
    res.json({ users: sanitizedUsers });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Server error retrieving users.' });
  }
});

/**
 * POST /api/users (Admin Only: Create new Client or Editor)
 */
router.post('/', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    await dbStore.init();
    const { fullName, email, password, role, phone, altPhone, companyName, skills, specialization } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Full name, email, password, and role are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = dbStore.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
      id: 'usr-' + Date.now(),
      fullName: fullName.trim(),
      email: cleanEmail,
      passwordHash,
      role: role.toUpperCase(),
      phone: phone || null,
      altPhone: altPhone || null,
      companyName: companyName || null,
      skills: skills || null,
      specialization: specialization || null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    dbStore.users.push(user);

    try {
      await supabase.from('users').insert([user]);
    } catch (_) {}

    res.status(201).json({
      message: `${role} created successfully.`,
      user: sanitizeUserForPrivacy(user, 'ADMIN')
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error creating user.' });
  }
});

/**
 * PATCH /api/users/profile
 * Allows authenticated CLIENT, EDITOR, and ADMIN to update their:
 * - Email Address
 * - Mobile / Phone number
 * - Password (with optional current password verification)
 */
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const userId = req.user.id;
    const { email, phone, currentPassword, newPassword, fullName } = req.body;

    const idx = dbStore.users.findIndex(u => u.id === userId);
    if (idx === -1) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const user = dbStore.users[idx];

    // 1. If updating email, check for duplicates
    if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
      const cleanEmail = email.toLowerCase().trim();
      const exists = dbStore.users.find(u => u.id !== userId && u.email.toLowerCase() === cleanEmail);
      if (exists) {
        return res.status(400).json({ error: 'This email address is already in use by another account.' });
      }
      user.email = cleanEmail;
    }

    // 2. If updating phone / mobile number
    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    // 3. If updating full name
    if (fullName && fullName.trim()) {
      user.fullName = fullName.trim();
    }

    // 4. If updating password
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      if (currentPassword) {
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
          return res.status(400).json({ error: 'Current password does not match.' });
        }
      }

      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    user.updatedAt = new Date().toISOString();

    // Sync updated record to Supabase
    try {
      await supabase.from('users').upsert([user]);
    } catch (e) {
      console.warn('Supabase profile sync note:', e.message);
    }

    res.json({
      message: 'Profile updated successfully.',
      user: sanitizeUserForPrivacy(user, user.role, true)
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile.' });
  }
});

/**
 * PATCH /api/users/:id (Admin Only)
 */
router.patch('/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    await dbStore.init();
    const { id } = req.params;
    const { fullName, phone, altPhone, status, companyName, skills, specialization } = req.body;

    const idx = dbStore.users.findIndex(u => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const target = dbStore.users[idx];
    if (fullName) target.fullName = fullName;
    if (phone !== undefined) target.phone = phone;
    if (altPhone !== undefined) target.altPhone = altPhone;
    if (status) target.status = status;
    if (companyName !== undefined) target.companyName = companyName;
    if (skills !== undefined) target.skills = skills;
    if (specialization !== undefined) target.specialization = specialization;

    res.json({
      message: 'User updated successfully.',
      user: sanitizeUserForPrivacy(target, 'ADMIN')
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error updating user.' });
  }
});

export default router;
