import express from 'express';
import { dbStore } from '../services/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/analytics/dashboard (ADMIN ONLY)
 */
router.get('/dashboard', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    await dbStore.init();

    const totalProjects = dbStore.projects.length;
    const activeProjects = dbStore.projects.filter(p => p.status !== 'Completed').length;
    const completedProjects = dbStore.projects.filter(p => p.status === 'Completed').length;

    const totalClients = dbStore.users.filter(u => u.role === 'CLIENT').length;
    const totalEditors = dbStore.users.filter(u => u.role === 'EDITOR').length;

    const paidPayments = dbStore.payments.filter(p => p.status === 'Paid');
    const pendingPayments = dbStore.payments.filter(p => p.status === 'Pending');

    const totalRevenue = paidPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const pendingRevenue = pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

    const recentActivity = dbStore.activityLogs.slice(-10).reverse();

    res.json({
      analytics: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalClients,
        totalEditors,
        totalRevenue,
        pendingRevenue,
        recentActivity
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Server error generating analytics.' });
  }
});

export default router;
