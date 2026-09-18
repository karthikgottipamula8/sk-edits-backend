import express from 'express';
import { dbStore, supabase } from '../services/supabase.js';
import { requireAuth, sanitizeUserForPrivacy } from '../middleware/auth.js';

const router = express.Router();

function sanitizeProject(project, viewerRole, viewerUserId) {
  if (!project) return null;

  const clientObj = dbStore.users.find(u => u.id === project.clientId);
  const clientInfo = sanitizeUserForPrivacy(clientObj, viewerRole);

  const memberRecords = dbStore.projectMembers.filter(pm => pm.projectId === project.id);
  const assignedEditors = memberRecords
    .map(pm => dbStore.users.find(u => u.id === pm.userId))
    .filter(Boolean)
    .map(u => sanitizeUserForPrivacy(u, viewerRole));

  const revisions = dbStore.revisionRequests.filter(rr => rr.projectId === project.id);
  const payments = dbStore.payments.filter(p => p.projectId === project.id);

  const formatted = {
    id: project.id,
    name: project.name,
    type: project.type,
    description: project.description,
    reelCount: project.reelCount,
    deadline: project.deadline,
    status: project.status,
    priority: project.priority,
    footageUrl: project.footageUrl,
    deliverableUrl: project.deliverableUrl,
    referenceUrls: project.referenceUrls,
    notes: project.notes,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    client: clientInfo,
    assignedEditors,
    revisions,
    payments
  };

  if (viewerRole === 'ADMIN') {
    formatted.internalNotes = dbStore.internalNotes.filter(n => n.projectId === project.id);
  }

  return formatted;
}

/**
 * GET /api/projects
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { role, id: userId } = req.user;

    let projectsList = dbStore.projects;

    if (role === 'CLIENT') {
      projectsList = projectsList.filter(p => p.clientId === userId);
    } else if (role === 'EDITOR') {
      const assignedProjIds = new Set(
        dbStore.projectMembers.filter(pm => pm.userId === userId).map(pm => pm.projectId)
      );
      projectsList = projectsList.filter(p => assignedProjIds.has(p.id));
    }

    const sanitized = projectsList.map(p => sanitizeProject(p, role, userId));
    res.json({ projects: sanitized });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Server error retrieving projects.' });
  }
});

/**
 * GET /api/projects/:id
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const project = dbStore.projects.find(p => p.id === id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (role === 'CLIENT' && project.clientId !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (role === 'EDITOR') {
      const isAssigned = dbStore.projectMembers.some(pm => pm.projectId === id && pm.userId === userId);
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    res.json({ project: sanitizeProject(project, role, userId) });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Server error retrieving project.' });
  }
});

/**
 * POST /api/projects
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { name, type, description, reelCount, deadline, priority, footageUrl, referenceUrls, notes, clientId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    let targetClientId = req.user.id;
    if (req.user.role === 'ADMIN' && clientId) {
      targetClientId = clientId;
    }

    const newProject = {
      id: 'proj-' + Date.now(),
      name,
      type: type || 'Starter Pack (₹499)',
      description: description || null,
      reelCount: parseInt(reelCount, 10) || 13,
      deadline: deadline || null,
      priority: priority || 'Normal',
      footageUrl: footageUrl || null,
      deliverableUrl: null,
      referenceUrls: referenceUrls || null,
      notes: notes || null,
      status: 'New',
      clientId: targetClientId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dbStore.projects.push(newProject);

    // Create Conversation
    const conversation = {
      id: 'conv-' + Date.now(),
      type: 'PROJECT',
      projectId: newProject.id,
      title: `${newProject.name} Chat`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    dbStore.conversations.push(conversation);

    dbStore.conversationMembers.push({
      id: 'cm-' + Date.now(),
      conversationId: conversation.id,
      userId: targetClientId
    });

    try {
      await supabase.from('projects').insert([newProject]);
    } catch (_) {}

    res.status(201).json({
      message: 'Project created successfully.',
      project: sanitizeProject(newProject, req.user.role, req.user.id)
    });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Server error creating project.' });
  }
});

/**
 * POST /api/projects/:id/assign (ADMIN ONLY)
 */
router.post('/:id/assign', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Admin can assign editors.' });
    }

    const { id } = req.params;
    const { editorIds } = req.body;

    if (!Array.isArray(editorIds)) {
      return res.status(400).json({ error: 'editorIds must be an array.' });
    }

    dbStore.projectMembers = dbStore.projectMembers.filter(pm => pm.projectId !== id);

    for (const editorId of editorIds) {
      dbStore.projectMembers.push({
        id: 'pm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        projectId: id,
        userId: editorId,
        role: 'EDITOR'
      });

      const projConv = dbStore.conversations.find(c => c.projectId === id && c.type === 'PROJECT');
      if (projConv) {
        const isMem = dbStore.conversationMembers.some(cm => cm.conversationId === projConv.id && cm.userId === editorId);
        if (!isMem) {
          dbStore.conversationMembers.push({
            id: 'cm-' + Date.now(),
            conversationId: projConv.id,
            userId: editorId
          });
        }
      }
    }

    const proj = dbStore.projects.find(p => p.id === id);
    if (proj) proj.status = 'Assigned';

    res.json({
      message: 'Editors assigned successfully.',
      project: sanitizeProject(proj, req.user.role, req.user.id)
    });
  } catch (err) {
    console.error('Assign editor error:', err);
    res.status(500).json({ error: 'Server error assigning editors.' });
  }
});

/**
 * PATCH /api/projects/:id/status
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { id } = req.params;
    const { status, deliverableUrl, footageUrl } = req.body;
    const { role, id: userId } = req.user;

    const project = dbStore.projects.find(p => p.id === id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (role === 'CLIENT' && project.clientId !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (status) project.status = status;
    if (deliverableUrl !== undefined) project.deliverableUrl = deliverableUrl;
    if (footageUrl !== undefined) project.footageUrl = footageUrl;
    project.updatedAt = new Date().toISOString();

    res.json({
      message: 'Project updated successfully.',
      project: sanitizeProject(project, role, userId)
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Server error updating project.' });
  }
});

/**
 * POST /api/projects/:id/revisions
 */
router.post('/:id/revisions', requireAuth, async (req, res) => {
  try {
    await dbStore.init();
    const { id } = req.params;
    const { description, timestampRef, imageUrl } = req.body;

    const project = dbStore.projects.find(p => p.id === id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const revision = {
      id: 'rev-' + Date.now(),
      projectId: id,
      clientId: project.clientId,
      description,
      timestampRef: timestampRef || null,
      imageUrl: imageUrl || null,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    dbStore.revisionRequests.push(revision);
    project.status = 'Revision Requested';

    res.status(201).json({ message: 'Revision submitted.', revision });
  } catch (err) {
    console.error('Revision error:', err);
    res.status(500).json({ error: 'Server error submitting revision.' });
  }
});

export default router;
