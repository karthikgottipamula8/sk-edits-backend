import express from 'express';
import { dbStore, supabase } from '../services/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/payments/settings
 */
router.get('/settings', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const settings = { ...dbStore.paymentSettings };

    if (req.user.role !== 'ADMIN') {
      delete settings.razorpayKeySecret;
    }

    res.json({ settings });
  } catch (err) {
    console.error('Get payment settings error:', err);
    res.status(500).json({ error: 'Server error retrieving payment settings.' });
  }
});

/**
 * PATCH /api/payments/settings (ADMIN ONLY)
 */
router.patch('/settings', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    await dbStore.init();
    const { activeGateway, razorpayKeyId, razorpayKeySecret, phonepeMerchantId, cashfreeAppId, upiId, upiQrUrl, instructions } = req.body;

    const set = dbStore.paymentSettings;
    if (activeGateway) set.activeGateway = activeGateway;
    if (razorpayKeyId !== undefined) set.razorpayKeyId = razorpayKeyId;
    if (razorpayKeySecret !== undefined) set.razorpayKeySecret = razorpayKeySecret;
    if (phonepeMerchantId !== undefined) set.phonepeMerchantId = phonepeMerchantId;
    if (cashfreeAppId !== undefined) set.cashfreeAppId = cashfreeAppId;
    if (upiId !== undefined) set.upiId = upiId;
    if (upiQrUrl !== undefined) set.upiQrUrl = upiQrUrl;
    if (instructions !== undefined) set.instructions = instructions;

    try {
      await supabase.from('payment_settings').upsert([set]);
    } catch (_) {}

    res.json({ message: `Payment Gateway switched to ${set.activeGateway} successfully.`, settings: set });
  } catch (err) {
    console.error('Update payment settings error:', err);
    res.status(500).json({ error: 'Server error updating payment gateway settings.' });
  }
});

/**
 * GET /api/payments
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { role, id: userId } = req.user;

    let payments = dbStore.payments;
    if (role === 'CLIENT') {
      payments = payments.filter(p => p.clientId === userId);
    }

    const formatted = payments.map(p => {
      const proj = dbStore.projects.find(pr => pr.id === p.projectId);
      const clientObj = dbStore.users.find(u => u.id === p.clientId);
      return {
        ...p,
        project: proj || null,
        client: clientObj ? { id: clientObj.id, fullName: clientObj.fullName, email: clientObj.email } : null
      };
    });

    res.json({ payments: formatted });
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Server error retrieving payments.' });
  }
});

/**
 * POST /api/payments
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { projectId, amount, gateway } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }

    const set = dbStore.paymentSettings;
    const selectedGateway = gateway || set.activeGateway || 'Razorpay';

    const newPayment = {
      id: 'pay-' + Date.now(),
      projectId: projectId || null,
      clientId: req.user.id,
      amount: parseFloat(amount),
      currency: 'INR',
      status: 'Pending',
      gateway: selectedGateway,
      transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNumber: `INV-SK-${Math.floor(10000 + Math.random() * 90000)}`,
      createdAt: new Date().toISOString()
    };

    dbStore.payments.push(newPayment);

    try {
      await supabase.from('payments').insert([newPayment]);
    } catch (_) {}

    res.status(201).json({
      message: 'Payment order initialized.',
      payment: newPayment,
      gatewayConfig: {
        activeGateway: selectedGateway,
        upiId: set.upiId || 'skedits@upi',
        upiQrUrl: set.upiQrUrl || ''
      }
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Server error creating payment order.' });
  }
});

/**
 * POST /api/payments/:id/verify
 */
router.post('/:id/verify', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { id } = req.params;
    const { transactionId, status } = req.body;

    const payment = dbStore.payments.find(p => p.id === id);
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    payment.status = status || 'Paid';
    if (transactionId) payment.transactionId = transactionId;

    res.json({ message: 'Payment status updated.', payment });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Server error verifying payment.' });
  }
});

export default router;
