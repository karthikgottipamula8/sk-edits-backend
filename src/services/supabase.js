import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Warning: SUPABASE_URL or SUPABASE_ANON_KEY environment variables are missing.');
}

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// In-Memory Fallback & Hybrid Synchronization Store for Supabase
class SupabaseStore {
  constructor() {
    this.users = [];
    this.projects = [];
    this.projectMembers = [];
    this.conversations = [];
    this.conversationMembers = [];
    this.messages = [];
    this.revisionRequests = [];
    this.payments = [];
    this.paymentSettings = {
      id: 'default',
      activeGateway: 'Razorpay',
      razorpayKeyId: 'rzp_test_SKEdits2026',
      razorpayKeySecret: 'secret_demo',
      upiId: 'skedits@upi',
      instructions: 'Complete your payment via active gateway or scan UPI QR Code.'
    };
    this.activityLogs = [];
    this.internalNotes = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    if (!supabase) {
      console.warn('⚠️ Supabase client not initialized (missing environment variables). Using in-memory fallback store.');
      await this.seedDefaults();
      this.initialized = true;
      return;
    }

    try {
      console.log('⚡ Initializing Supabase Data Layer...');
      
      // Attempt fetching users from Supabase REST table 'users'
      const { data: supaUsers, error } = await supabase.from('users').select('*');
      if (!error && supaUsers && supaUsers.length > 0) {
        this.users = supaUsers;
        console.log('✅ Connected to Supabase Project! Fetched users:', supaUsers.length);
      } else {
        // Seed initial default Admin & Demo data
        await this.seedDefaults();
      }
    } catch (e) {
      console.log('Supabase sync note:', e.message);
      await this.seedDefaults();
    }

    this.initialized = true;
  }

  async seedDefaults() {
    const adminEmail = 'skedits1438@gmail.com';
    const adminPasswordHash = await bcrypt.hash('Sak@77805', 10);
    const clientPasswordHash = await bcrypt.hash('Client@123', 10);
    const editorPasswordHash = await bcrypt.hash('Editor@123', 10);

    const admin = {
      id: 'usr-admin-1438',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      fullName: 'SK Edits Admin',
      phone: '+918074015211',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const client1 = {
      id: 'usr-client-1',
      email: 'dr.priya@executivecoaching.in',
      passwordHash: clientPasswordHash,
      role: 'CLIENT',
      fullName: 'Dr. Priya Sharma',
      companyName: 'Priya Executive Leadership',
      phone: '+919876543210',
      altPhone: '+919876543211',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const client2 = {
      id: 'usr-client-2',
      email: 'sameer@fitnessmentor.com',
      passwordHash: clientPasswordHash,
      role: 'CLIENT',
      fullName: 'Sameer Verma',
      companyName: 'FitPro Coaching',
      phone: '+919812345678',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const editor1 = {
      id: 'usr-editor-1',
      email: 'david.editor@skedits.agency',
      passwordHash: editorPasswordHash,
      role: 'EDITOR',
      fullName: 'David R.',
      skills: 'Dynamic Speed Ramps, Visual Overlays, SFX Layering',
      specialization: 'Coaching & Authority Reels',
      phone: '+919988776655',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const editor2 = {
      id: 'usr-editor-2',
      email: 'james.editor@skedits.agency',
      passwordHash: editorPasswordHash,
      role: 'EDITOR',
      fullName: 'James M.',
      skills: 'High-Retention Captions, Motion Graphics, Sound Design',
      specialization: 'Lead Gen & Case Study Shorts',
      phone: '+919988776644',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    this.users = [admin, client1, client2, editor1, editor2];

    const proj1 = {
      id: 'proj-1',
      name: 'Dr. Priya — 15 High-Retention Reels',
      type: 'Starter Pack (₹499*)',
      description: 'Executive authority talking head reels with bold captions, sound design, and speed ramps.',
      reelCount: 15,
      deadline: '2026-09-25',
      status: 'Editing',
      priority: 'High',
      footageUrl: 'https://drive.google.com/drive/folders/1vKLI9xTAwPH0ZKB0NdaCm5a_SagfwZ-l',
      clientId: client1.id,
      createdAt: new Date().toISOString()
    };

    this.projects = [proj1];
    this.projectMembers = [{ id: 'pm-1', projectId: proj1.id, userId: editor1.id, role: 'EDITOR' }];

    const conv1 = {
      id: 'conv-1',
      type: 'PROJECT',
      projectId: proj1.id,
      title: `${proj1.name} Chat`,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    this.conversations = [conv1];
    this.conversationMembers = [
      { id: 'cm-1', conversationId: conv1.id, userId: client1.id },
      { id: 'cm-2', conversationId: conv1.id, userId: editor1.id },
      { id: 'cm-3', conversationId: conv1.id, userId: admin.id }
    ];

    this.messages = [
      {
        id: 'msg-1',
        conversationId: conv1.id,
        senderId: admin.id,
        content: 'Welcome to SK Edits Portal! Editor David R. has been assigned to your project. Raw footage Google Drive link received.',
        isSystem: true,
        createdAt: new Date().toISOString()
      }
    ];

    this.payments = [
      {
        id: 'pay-1',
        projectId: proj1.id,
        clientId: client1.id,
        amount: 7485,
        currency: 'INR',
        status: 'Paid',
        gateway: 'Razorpay',
        transactionId: 'TXN-SKEDITS-882190',
        invoiceNumber: 'INV-SK-10042',
        createdAt: new Date().toISOString()
      }
    ];

    // Attempt pushing initial data to Supabase remote REST tables if available
    try {
      if (supabase) {
        await supabase.from('users').upsert([admin, client1, client2, editor1, editor2]);
      }
    } catch (_) {}

    console.log('✅ Supabase Defaults Seeded Successfully!');
  }
}

export const dbStore = new SupabaseStore();
