-- =============================================================================
-- SK EDITS — COMPLETE SUPABASE POSTGRESQL SCHEMA (DDL + SEED DATA)
-- Project ID: cshiopegnhdldaupxjje
-- Dashboard URL: https://supabase.com/dashboard/project/cshiopegnhdldaupxjje/sql/new
--
-- Instructions:
-- 1. Open Supabase Dashboard -> SQL Editor (or click the URL above).
-- 2. Paste this entire script into a New Query and click 'Run'.
-- 3. All 13 tables, performance indexes, RLS policies, and Admin credentials
--    will be created and ready to use!
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores Admin, Clients, and Editors
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CLIENT', 'EDITOR')),
    "fullName" TEXT NOT NULL,
    phone TEXT,
    "altPhone" TEXT,
    avatar TEXT,
    "companyName" TEXT,
    skills TEXT,
    specialization TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. PROJECTS TABLE
-- Tracks video editing projects, reels, deadlines, and workflow status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    "reelCount" INTEGER NOT NULL DEFAULT 13,
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    priority TEXT NOT NULL DEFAULT 'Normal',
    "footageUrl" TEXT,
    "deliverableUrl" TEXT,
    "referenceUrls" TEXT,
    notes TEXT,
    "clientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. PROJECT MEMBERS TABLE
-- Assigns Editors or Admins to Projects
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "projectId" TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_project_user UNIQUE ("projectId", "userId")
);

-- -----------------------------------------------------------------------------
-- 4. CONVERSATIONS TABLE
-- Chat channels for Projects or Direct/General communication
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL DEFAULT 'PROJECT',
    "projectId" TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. CONVERSATION MEMBERS TABLE
-- Links Users to Conversations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_conv_user UNIQUE ("conversationId", "userId")
);

-- -----------------------------------------------------------------------------
-- 6. MESSAGES TABLE
-- Realtime chat messages with contact privacy guard protection
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    "senderId" TEXT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. MESSAGE ATTACHMENTS TABLE
-- Images and reference attachments uploaded in chat
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_attachments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "messageId" TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. REVISION REQUESTS TABLE
-- Client revision requests with timestamp references and annotations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revision_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "projectId" TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "clientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    "timestampRef" TEXT,
    "imageUrl" TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "resolvedAt" TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 9. PAYMENTS TABLE
-- Transactions, invoices, and dynamic gateway records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "projectId" TEXT REFERENCES projects(id) ON DELETE SET NULL,
    "clientId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'Pending',
    gateway TEXT NOT NULL DEFAULT 'Razorpay',
    "transactionId" TEXT,
    "invoiceNumber" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 10. PAYMENT SETTINGS TABLE
-- Admin Gateway Switcher (Razorpay, PhonePe, Cashfree, UPI QR)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    "activeGateway" TEXT NOT NULL DEFAULT 'Razorpay',
    "razorpayKeyId" TEXT DEFAULT '',
    "razorpayKeySecret" TEXT DEFAULT '',
    "phonepeMerchantId" TEXT DEFAULT '',
    "cashfreeAppId" TEXT DEFAULT '',
    "upiId" TEXT DEFAULT 'skedits@upi',
    "upiQrUrl" TEXT DEFAULT '',
    instructions TEXT DEFAULT 'Complete your payment via active gateway or scan UPI QR Code.',
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 11. INTERNAL NOTES TABLE
-- Private Admin & Editor internal collaboration notes (hidden from clients)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_notes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "projectId" TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "authorId" TEXT REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 12. NOTIFICATIONS TABLE
-- Realtime alerts for assignments, payments, chat messages, revisions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO',
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 13. ACTIVITY LOGS TABLE
-- Audit log of logins, status changes, and project updates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    metadata TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects("clientId");
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members("projectId");
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members("userId");
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations("projectId");
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON conversation_members("conversationId");
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members("userId");
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages("conversationId");
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages("createdAt");
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments("clientId");
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments("projectId");
CREATE INDEX IF NOT EXISTS idx_revision_requests_project ON revision_requests("projectId");
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs("userId");

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Configures open access for Anon & Authenticated roles (API Gateway Mode)
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Public full access users" ON users;
    CREATE POLICY "Public full access users" ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access projects" ON projects;
    CREATE POLICY "Public full access projects" ON projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access project_members" ON project_members;
    CREATE POLICY "Public full access project_members" ON project_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access conversations" ON conversations;
    CREATE POLICY "Public full access conversations" ON conversations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access conversation_members" ON conversation_members;
    CREATE POLICY "Public full access conversation_members" ON conversation_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access messages" ON messages;
    CREATE POLICY "Public full access messages" ON messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access message_attachments" ON message_attachments;
    CREATE POLICY "Public full access message_attachments" ON message_attachments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access revision_requests" ON revision_requests;
    CREATE POLICY "Public full access revision_requests" ON revision_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access payments" ON payments;
    CREATE POLICY "Public full access payments" ON payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access payment_settings" ON payment_settings;
    CREATE POLICY "Public full access payment_settings" ON payment_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access internal_notes" ON internal_notes;
    CREATE POLICY "Public full access internal_notes" ON internal_notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access notifications" ON notifications;
    CREATE POLICY "Public full access notifications" ON notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public full access activity_logs" ON activity_logs;
    CREATE POLICY "Public full access activity_logs" ON activity_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
END
$$;

-- =============================================================================
-- SEED DATA
-- Inserts requested Admin Credentials, Sample Clients, Editors & Project Data
-- =============================================================================

-- 1. Admin Account (Email: skedits1438@gmail.com | Password: Sak@77805)
INSERT INTO users (id, email, "passwordHash", role, "fullName", phone, status)
VALUES (
    'usr-admin-1438',
    'skedits1438@gmail.com',
    '$2a$10$Z1A5wCFZc7.4vq.xdcdse.Fx.ghV/m5hUtUYuQqloA4tIdldvOSoe',
    'ADMIN',
    'SK Edits Admin',
    '+918074015211',
    'ACTIVE'
)
ON CONFLICT (email) DO UPDATE 
SET "passwordHash" = EXCLUDED."passwordHash",
    role = EXCLUDED.role,
    "fullName" = EXCLUDED."fullName",
    status = EXCLUDED.status;

-- 2. Sample Clients (Password: Client@123)
INSERT INTO users (id, email, "passwordHash", role, "fullName", "companyName", phone, "altPhone", status)
VALUES 
(
    'usr-client-1',
    'dr.priya@executivecoaching.in',
    '$2a$10$hGmZAy7rnf/iTovd/W6m4eh9E.H9CgO6gknNmasCdBpYs7JAKcyCO',
    'CLIENT',
    'Dr. Priya Sharma',
    'Priya Executive Leadership',
    '+919876543210',
    '+919876543211',
    'ACTIVE'
),
(
    'usr-client-2',
    'sameer@fitnessmentor.com',
    '$2a$10$hGmZAy7rnf/iTovd/W6m4eh9E.H9CgO6gknNmasCdBpYs7JAKcyCO',
    'CLIENT',
    'Sameer Verma',
    'FitPro Coaching',
    '+919812345678',
    NULL,
    'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;

-- 3. Sample Editors (Password: Editor@123)
INSERT INTO users (id, email, "passwordHash", role, "fullName", skills, specialization, phone, status)
VALUES 
(
    'usr-editor-1',
    'david.editor@skedits.agency',
    '$2a$10$vXRDrBYYXEfWm0mps9Rt8OH7zQndbdCVB9dMGw7kt97nE44.O8cJC',
    'EDITOR',
    'David R.',
    'Dynamic Speed Ramps, Visual Overlays, SFX Layering',
    'Coaching & Authority Reels',
    '+919988776655',
    'ACTIVE'
),
(
    'usr-editor-2',
    'james.editor@skedits.agency',
    '$2a$10$vXRDrBYYXEfWm0mps9Rt8OH7zQndbdCVB9dMGw7kt97nE44.O8cJC',
    'EDITOR',
    'James M.',
    'High-Retention Captions, Motion Graphics, Sound Design',
    'Lead Gen & Case Study Shorts',
    '+919988776644',
    'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;

-- 4. Payment Settings
INSERT INTO payment_settings (id, "activeGateway", "razorpayKeyId", "razorpayKeySecret", "phonepeMerchantId", "cashfreeAppId", "upiId", instructions)
VALUES (
    'default',
    'Razorpay',
    'rzp_test_SKEdits2026',
    'secret_demo',
    '',
    '',
    'skedits@upi',
    'Complete your payment via active gateway or scan UPI QR Code.'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Sample Project
INSERT INTO projects (id, name, type, description, "reelCount", deadline, status, priority, "footageUrl", "clientId")
VALUES (
    'proj-1',
    'Dr. Priya — 15 High-Retention Reels',
    'Starter Pack (₹499*)',
    'Executive authority talking head reels with bold captions, sound design, and speed ramps.',
    15,
    '2026-09-25',
    'Editing',
    'High',
    'https://drive.google.com/drive/folders/1vKLI9xTAwPH0ZKB0NdaCm5a_SagfwZ-l',
    'usr-client-1'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Project Assignment
INSERT INTO project_members (id, "projectId", "userId", role)
VALUES ('pm-1', 'proj-1', 'usr-editor-1', 'EDITOR')
ON CONFLICT ("projectId", "userId") DO NOTHING;

-- 7. Project Conversation
INSERT INTO conversations (id, type, "projectId", title)
VALUES ('conv-1', 'PROJECT', 'proj-1', 'Dr. Priya — 15 High-Retention Reels Chat')
ON CONFLICT (id) DO NOTHING;

-- 8. Conversation Members
INSERT INTO conversation_members (id, "conversationId", "userId")
VALUES 
('cm-1', 'conv-1', 'usr-client-1'),
('cm-2', 'conv-1', 'usr-editor-1'),
('cm-3', 'conv-1', 'usr-admin-1438')
ON CONFLICT ("conversationId", "userId") DO NOTHING;

-- 9. Initial Chat Message
INSERT INTO messages (id, "conversationId", "senderId", content, "isSystem")
VALUES (
    'msg-1',
    'conv-1',
    'usr-admin-1438',
    'Welcome to SK Edits Portal! Editor David R. has been assigned to your project. Raw footage Google Drive link received.',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 10. Sample Payment Record
INSERT INTO payments (id, "projectId", "clientId", amount, currency, status, gateway, "transactionId", "invoiceNumber")
VALUES (
    'pay-1',
    'proj-1',
    'usr-client-1',
    7485.00,
    'INR',
    'Paid',
    'Razorpay',
    'TXN-SKEDITS-882190',
    'INV-SK-10042'
)
ON CONFLICT (id) DO NOTHING;
