import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { dbStore, supabase } from '../services/supabase.js';
import { requireAuth, sanitizeUserForPrivacy } from '../middleware/auth.js';
import { validateChatMessage } from '../services/chatGuard.js';

const router = express.Router();

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(process.cwd(), 'public', 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Notice: Chat uploads directory initialization:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'chat-img-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('VIDEO_BLOCKED: Video uploads are not allowed in chat. Please share the Google Drive link instead.'));
    }
  }
});

/**
 * GET /api/chat/conversations
 */
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { role, id: userId } = req.user;

    let convs = dbStore.conversations;
    if (role !== 'ADMIN') {
      const myConvIds = new Set(
        dbStore.conversationMembers.filter(cm => cm.userId === userId).map(cm => cm.conversationId)
      );
      convs = convs.filter(c => myConvIds.has(c.id));
    }

    const sanitized = convs.map(c => {
      const proj = dbStore.projects.find(p => p.id === c.projectId);
      const memberIds = dbStore.conversationMembers.filter(cm => cm.conversationId === c.id).map(cm => cm.userId);
      const members = memberIds.map(uId => dbStore.users.find(u => u.id === uId)).filter(Boolean).map(u => sanitizeUserForPrivacy(u, role));
      const convMsgs = dbStore.messages.filter(m => m.conversationId === c.id);
      const lastMsg = convMsgs.length ? convMsgs[convMsgs.length - 1] : null;

      return {
        id: c.id,
        type: c.type,
        projectId: c.projectId,
        projectName: proj ? proj.name : 'General Support',
        title: c.type === 'PROJECT' ? `${proj?.name || 'Project'} Chat` : 'SK Edits General Support',
        updatedAt: c.updatedAt,
        members,
        lastMessage: lastMsg
      };
    });

    res.json({ conversations: sanitized });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error retrieving conversations.' });
  }
});

/**
 * GET /api/chat/conversations/:id/messages
 */
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const conv = dbStore.conversations.find(c => c.id === id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

    if (role !== 'ADMIN') {
      const isMember = dbStore.conversationMembers.some(cm => cm.conversationId === id && cm.userId === userId);
      if (!isMember) return res.status(403).json({ error: 'Access denied.' });
    }

    const msgs = dbStore.messages.filter(m => m.conversationId === id);
    const sanitizedMsgs = msgs.map(m => {
      const senderObj = dbStore.users.find(u => u.id === m.senderId);
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: sanitizeUserForPrivacy(senderObj, role),
        content: m.content,
        isSystem: m.isSystem,
        createdAt: m.createdAt,
        attachments: m.attachments || []
      };
    });

    res.json({ messages: sanitizedMsgs });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error retrieving messages.' });
  }
});

/**
 * POST /api/chat/conversations/:id/messages
 */
router.post('/conversations/:id/messages', requireAuth, (req, res) => {
  upload.array('attachments', 3)(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.message && uploadErr.message.includes('VIDEO_BLOCKED')) {
        return res.status(400).json({ error: 'Video uploads are not allowed in chat. Please share the Google Drive link instead.' });
      }
      return res.status(400).json({ error: uploadErr.message || 'File upload error.' });
    }

    try {
      await dbStore.init();
      const { id } = req.params;
      const { content } = req.body;
      const { role, id: userId } = req.user;

      const conv = dbStore.conversations.find(c => c.id === id);
      if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

      if (role !== 'ADMIN') {
        const isMember = dbStore.conversationMembers.some(cm => cm.conversationId === id && cm.userId === userId);
        if (!isMember) return res.status(403).json({ error: 'Access denied.' });
      }

      // --- SERVER SIDE PRIVACY CHAT GUARD ---
      const guardResult = validateChatMessage(content, role);
      if (!guardResult.isValid) {
        dbStore.activityLogs.push({
          id: 'log-' + Date.now(),
          userId,
          action: 'CHAT_CONTACT_INFO_BLOCKED',
          entityType: 'Conversation',
          entityId: id,
          metadata: JSON.stringify({ attemptedContent: content, reason: guardResult.reason }),
          createdAt: new Date().toISOString()
        });
        return res.status(400).json({ error: guardResult.reason });
      }

      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          attachments.push({
            id: 'att-' + Date.now(),
            fileUrl: `/uploads/${file.filename}`,
            fileType: file.mimetype,
            fileSize: file.size
          });
        }
      }

      const senderObj = dbStore.users.find(u => u.id === userId);
      const message = {
        id: 'msg-' + Date.now(),
        conversationId: id,
        senderId: userId,
        content: content || '',
        isSystem: false,
        createdAt: new Date().toISOString(),
        attachments
      };

      dbStore.messages.push(message);
      conv.updatedAt = new Date().toISOString();

      try {
        await supabase.from('messages').insert([message]);
      } catch (_) {}

      res.status(201).json({
        message: {
          ...message,
          sender: sanitizeUserForPrivacy(senderObj, role)
        }
      });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Server error sending message.' });
    }
  });
});

export default router;
