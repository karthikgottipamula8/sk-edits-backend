import { supabase } from './services/supabase.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Starting SK Edits Supabase database seeding...');

  // 1. Seed Admin Account (Requested Admin Credentials)
  const adminEmail = 'skedits1438@gmail.com';
  const adminPasswordHash = await bcrypt.hash('Sak@77805', 10);
  const clientPasswordHash = await bcrypt.hash('Client@123', 10);
  const editorPasswordHash = await bcrypt.hash('Editor@123', 10);

  const users = [
    {
      id: 'usr-admin-1438',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      fullName: 'SK Edits Admin',
      phone: '+918074015211',
      status: 'ACTIVE'
    },
    {
      id: 'usr-client-1',
      email: 'dr.priya@executivecoaching.in',
      passwordHash: clientPasswordHash,
      role: 'CLIENT',
      fullName: 'Dr. Priya Sharma',
      companyName: 'Priya Executive Leadership',
      phone: '+919876543210',
      altPhone: '+919876543211',
      status: 'ACTIVE'
    },
    {
      id: 'usr-client-2',
      email: 'sameer@fitnessmentor.com',
      passwordHash: clientPasswordHash,
      role: 'CLIENT',
      fullName: 'Sameer Verma',
      companyName: 'FitPro Coaching',
      phone: '+919812345678',
      status: 'ACTIVE'
    },
    {
      id: 'usr-editor-1',
      email: 'david.editor@skedits.agency',
      passwordHash: editorPasswordHash,
      role: 'EDITOR',
      fullName: 'David R.',
      skills: 'Dynamic Speed Ramps, Visual Overlays, SFX Layering',
      specialization: 'Coaching & Authority Reels',
      phone: '+919988776655',
      status: 'ACTIVE'
    },
    {
      id: 'usr-editor-2',
      email: 'james.editor@skedits.agency',
      passwordHash: editorPasswordHash,
      role: 'EDITOR',
      fullName: 'James M.',
      skills: 'High-Retention Captions, Motion Graphics, Sound Design',
      specialization: 'Lead Gen & Case Study Shorts',
      phone: '+919988776644',
      status: 'ACTIVE'
    }
  ];

  const { error: userErr } = await supabase.from('users').upsert(users);
  if (userErr) {
    console.warn('Supabase User Upsert Notice (tables may need creation first):', userErr.message);
  } else {
    console.log('✅ Users Seeded Successfully in Supabase!');
  }

  // 2. Seed Payment Gateway Settings
  const paymentSettings = {
    id: 'default',
    activeGateway: 'Razorpay',
    razorpayKeyId: 'rzp_test_SKEdits2026',
    razorpayKeySecret: 'secret_demo',
    phonepeMerchantId: '',
    cashfreeAppId: '',
    upiId: 'skedits@upi',
    instructions: 'Complete your payment via active gateway or scan UPI QR Code.'
  };

  const { error: paySetErr } = await supabase.from('payment_settings').upsert([paymentSettings]);
  if (paySetErr) {
    console.warn('Payment Settings Notice:', paySetErr.message);
  } else {
    console.log('✅ Payment Settings Seeded.');
  }

  // 3. Seed Sample Project
  const project1 = {
    id: 'proj-1',
    name: 'Dr. Priya — 15 High-Retention Reels',
    type: 'Starter Pack (₹499*)',
    description: 'Executive authority talking head reels with bold captions, sound design, and speed ramps.',
    reelCount: 15,
    deadline: '2026-09-25',
    status: 'Editing',
    priority: 'High',
    footageUrl: 'https://drive.google.com/drive/folders/1vKLI9xTAwPH0ZKB0NdaCm5a_SagfwZ-l',
    clientId: 'usr-client-1'
  };

  await supabase.from('projects').upsert([project1]);

  // Project Member
  await supabase.from('project_members').upsert([{
    id: 'pm-1',
    projectId: 'proj-1',
    userId: 'usr-editor-1',
    role: 'EDITOR'
  }]);

  // Project Conversation
  await supabase.from('conversations').upsert([{
    id: 'conv-1',
    type: 'PROJECT',
    projectId: 'proj-1',
    title: 'Dr. Priya — 15 High-Retention Reels Chat'
  }]);

  // Conversation Members
  await supabase.from('conversation_members').upsert([
    { id: 'cm-1', conversationId: 'conv-1', userId: 'usr-client-1' },
    { id: 'cm-2', conversationId: 'conv-1', userId: 'usr-editor-1' },
    { id: 'cm-3', conversationId: 'conv-1', userId: 'usr-admin-1438' }
  ]);

  // Initial Message
  await supabase.from('messages').upsert([{
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'usr-admin-1438',
    content: 'Welcome to SK Edits Portal! Editor David R. has been assigned to your project. Raw footage Google Drive link received.',
    isSystem: true
  }]);

  // Initial Payment
  await supabase.from('payments').upsert([{
    id: 'pay-1',
    projectId: 'proj-1',
    clientId: 'usr-client-1',
    amount: 7485,
    currency: 'INR',
    status: 'Paid',
    gateway: 'Razorpay',
    transactionId: 'TXN-SKEDITS-882190',
    invoiceNumber: 'INV-SK-10042'
  }]);

  console.log('✨ SK Edits Supabase Seeding Sequence Executed!');
}

seed().catch(e => {
  console.error('Seeding process notice:', e);
});
