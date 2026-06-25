const SupportRequest = require('../models/SupportRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendGenericNotification } = require('../services/emailService');
const { emitToStaff, emitToUser } = require('../socket');
const meetingService = require('../services/meetingService');

// Trim a message down for use in a notification body.
const preview = (text, max = 120) => {
  const t = String(text || '').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Base support paths per role; notifications deep-link to the specific ticket
// via `?ticket=<supportId>` (see supportLink()).
const ROLE_SUPPORT_LINK = {
  admin: '/admin/support',
  employee: '/employee/support',
  client: '/help',
};
const supportLink = (role, supportId) =>
  `${ROLE_SUPPORT_LINK[role] || '/help'}?ticket=${supportId}`;

/**
 * Notify a user about a support event, honouring their per-channel preferences.
 * Sends an in-app notification (unless opted out) and, when email is requested
 * and they opted in, a generic notification email. Fire-and-forget, never throws.
 *
 * @param {string} key - notification key ('supportUpdate' | 'newSupportTicket')
 */
const notifySupport = (userId, supportId, { typeLabel, title, body, key, email = true }) => {
  User.findById(userId)
    .select('name email role notificationPrefs')
    .then((u) => {
      if (!u) return;
      const prefs = u.notificationPrefs || {};
      const link = supportLink(u.role, supportId);

      // In-app (default on unless explicitly disabled)
      if (prefs.inApp?.[key] !== false) {
        Notification.create({ userId, supportId, type: 'support', typeLabel, title, body, link })
          .then((notif) => emitToUser(userId, 'notification:new', notif.toObject()))
          .catch(() => {});
      }

      // Email (opt-in: only when explicitly enabled)
      if (email && prefs.email?.[key] === true) {
        sendGenericNotification({
          to: u.email,
          recipientName: u.name,
          subject: title,
          heading: typeLabel,
          message: body,
          ctaLabel: 'Open Support',
          ctaUrl: `${FRONTEND_URL}${link}`,
        });
      }
    })
    .catch(() => {});
};

/**
 * POST /api/support/contact
 * Client only — open a support ticket. Staff can later schedule a meeting on it.
 */
const createRequest = async (req, res, next) => {
  try {
    const { subject, message } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const clientName = req.user.name || 'A client';
    const clientEmail = req.user.email;

    const request = await SupportRequest.create({
      client: req.user.id,
      clientName,
      clientEmail,
      subject: subject.trim(),
      message: message.trim(),
    });

    // Notify all staff (admins + employees) about the new ticket. Each staffer's
    // in-app + email delivery is gated by their own notification preferences
    // (`newSupportTicket`) inside notifySupport — no separate unconditional blast.
    User.find({ role: { $in: ['admin', 'employee'] } }).select('_id').then((staff) => {
      staff.forEach((s) =>
        notifySupport(s._id, request._id, {
          typeLabel: 'New Support Ticket',
          title: `New Support Ticket · ${request.ticketId}`,
          body: `${clientName}: "${request.subject}"`,
          key: 'newSupportTicket',
        }),
      );
    }).catch(() => {});

    // Live-update the support center for all staff
    emitToStaff('support:new', { request });

    res.status(201).json({ success: true, message: 'Your request has been submitted.', request });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/support/my
 * Client only — list the caller's own tickets (track by id / status).
 */
const listMyRequests = async (req, res, next) => {
  try {
    const requests = await SupportRequest.find({ client: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/support
 * Admin & employee — list support requests with optional filters + search.
 * query: status=open|accepted|resolved, q=<search>
 */
const listRequests = async (req, res, next) => {
  try {
    const filter = {};
    if (['open', 'accepted', 'resolved'].includes(req.query.status)) filter.status = req.query.status;

    const q = (req.query.q || '').trim();
    if (q) {
      // Escape regex metacharacters so user input is matched literally.
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [
        { ticketId: rx },
        { subject: rx },
        { clientName: rx },
        { clientEmail: rx },
      ];
    }

    const requests = await SupportRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const openCount = await SupportRequest.countDocuments({ status: 'open' });

    res.status(200).json({ success: true, requests, openCount });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/support/:id/accept
 * Admin & employee — claim an open ticket (open → accepted).
 */
const acceptRequest = async (req, res, next) => {
  try {
    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.status !== 'open') {
      return res.status(400).json({ success: false, message: 'Only open tickets can be accepted' });
    }

    request.status = 'accepted';
    request.assignedTo = req.user.id;
    request.acceptedAt = new Date();
    await request.save();
    await request.populate('assignedTo', 'name email');

    notifySupport(request.client, request._id, {
      typeLabel: 'Ticket Accepted',
      title: `Ticket ${request.ticketId} accepted`,
      body: `Your ticket "${request.subject}" is being handled by ${req.user.name || 'our team'}. You can now reply directly here.`,
      key: 'supportUpdate',
    });

    emitToStaff('support:updated', { request });
    emitToUser(request.client, 'support:updated', { request });
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/support/:id/status
 * Admin & employee — set status to open, accepted, or resolved.
 */
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['open', 'accepted', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    request.status = status;
    request.resolvedAt = status === 'resolved' ? new Date() : null;
    // Reopening keeps the ticket with whoever was handling it. If that link was
    // somehow lost, the staffer reopening it takes ownership so it stays claimed.
    if (status === 'accepted' && !request.assignedTo) {
      request.assignedTo = req.user.id;
      request.acceptedAt = new Date();
    }
    await request.save();
    await request.populate('assignedTo', 'name email');

    notifySupport(request.client, request._id, {
      typeLabel: 'Ticket Updated',
      title: `Ticket ${request.ticketId} updated`,
      body: status === 'resolved'
        ? `Your ticket "${request.subject}" has been marked resolved.`
        : `Your ticket "${request.subject}" was reopened.`,
      key: 'supportUpdate',
    });

    emitToStaff('support:updated', { request });
    emitToUser(request.client, 'support:updated', { request });
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/support/:id/messages
 * Conversation — the ticket owner (client) and the staff member who accepted
 * the ticket can post messages back and forth. Resolved tickets are closed to
 * new messages until staff reopens them.
 */
const postMessage = async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    if (body.length > 4000) return res.status(400).json({ success: false, message: 'Message is too long (max 4000 characters)' });

    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // A resolved ticket is closed to new messages until staff reopens it.
    if (request.status === 'resolved') {
      return res.status(409).json({ success: false, message: 'This ticket is resolved. It must be reopened before new messages can be sent.' });
    }

    const isClientOwner = req.user.role === 'client' && String(request.client) === String(req.user.id);
    const isAssignedStaff =
      (req.user.role === 'admin' || req.user.role === 'employee') &&
      request.assignedTo && String(request.assignedTo) === String(req.user.id);

    if (!isClientOwner && !isAssignedStaff) {
      // Staff who haven't accepted the ticket can't converse — that's reserved
      // for whoever claimed it.
      const message = req.user.role === 'client'
        ? 'You can only reply to your own tickets.'
        : 'Accept this ticket before replying to the client.';
      return res.status(403).json({ success: false, message });
    }

    const senderRole = isClientOwner ? 'client' : 'staff';
    request.messages.push({
      sender: req.user.id,
      senderName: req.user.name || '',
      senderRole,
      body,
    });
    await request.save();
    await request.populate('assignedTo', 'name email');

    // Notify the other party (in-app, plus email if they opted in).
    if (senderRole === 'staff') {
      notifySupport(request.client, request._id, {
        typeLabel: 'Support Reply',
        title: `Reply to ticket ${request.ticketId}`,
        body: `${req.user.name || 'Our team'}: "${preview(body)}"`,
        key: 'supportUpdate',
      });
    } else if (request.assignedTo) {
      const staffId = request.assignedTo._id || request.assignedTo;
      notifySupport(staffId, request._id, {
        typeLabel: 'New Client Message',
        title: `New message · ${request.ticketId}`,
        body: `${request.clientName || 'The client'}: "${preview(body)}"`,
        key: 'supportUpdate',
      });
    }

    // Live-sync both sides of the conversation.
    emitToStaff('support:updated', { request });
    emitToUser(request.client, 'support:updated', { request });
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// The ticket stores a snapshot of the client's email taken at submission. If
// the client later changes their email, that snapshot goes stale — so before
// sending a meeting invite we refresh it from the live User record (mutating
// the request, which is then saved) and return the current identity.
const refreshClientIdentity = async (request) => {
  const user = await User.findById(request.client).select('name email');
  if (user?.email) {
    request.clientEmail = user.email;
    request.clientName = user.name || request.clientName;
  }
  return { name: request.clientName, email: request.clientEmail };
};

// Build the Google Calendar event metadata for a ticket's meeting.
const eventArgsFor = (request, note) => ({
  summary: `merQetia · ${request.subject}`,
  description: [
    `Support ticket: ${request.ticketId}`,
    `Client: ${request.clientName} (${request.clientEmail})`,
    note ? `\nNotes: ${note}` : '',
    request.message ? `\nOriginal request: ${request.message}` : '',
  ].join('\n'),
});

/**
 * POST /api/support/:id/meetings
 * Admin & employee — schedule a NEW Google Calendar meeting (with a Meet link)
 * on a ticket and invite the client. Only allowed when no meeting is currently
 * active (a ticket can hold several over time; past/cancelled ones stay).
 * body: { scheduledAt (ISO), durationMins, note }
 */
const scheduleMeeting = async (req, res, next) => {
  try {
    const { scheduledAt, durationMins, note } = req.body;

    const when = new Date(scheduledAt);
    if (!scheduledAt || isNaN(when.getTime())) {
      return res.status(400).json({ success: false, message: 'A valid meeting date/time is required' });
    }
    if (when.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'The meeting time must be in the future' });
    }
    const duration = Number(durationMins) > 0 ? Math.min(Number(durationMins), 480) : 30;

    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (meetingService.hasActiveMeeting(request.meetings)) {
      return res.status(409).json({ success: false, message: 'A meeting is already scheduled. Reschedule or cancel it before booking another.' });
    }

    const organizer = await User.findById(req.user.id).select('name email');
    const client = await refreshClientIdentity(request);

    let meeting;
    try {
      meeting = await meetingService.createMeeting({
        ...eventArgsFor(request, note),
        when,
        durationMins: duration,
        note,
        scheduledByName: organizer?.name || req.user.name || '',
        attendees: [client.email, organizer?.email],
      });
    } catch (err) {
      return res.status(err.statusCode || 502).json({
        success: false,
        message: err.message || 'Failed to schedule the meeting. Please try again.',
      });
    }

    request.meetings.push(meeting);
    if (request.status === 'open') {
      request.status = 'accepted';
      request.assignedTo = req.user.id;
      request.acceptedAt = new Date();
    }
    await request.save();
    await request.populate('assignedTo', 'name email');

    const saved = request.meetings[request.meetings.length - 1];
    const whenStr = meetingService.fmtWhen(when);

    meetingService.sendMeetingEmail({
      to: client.email,
      kind: 'scheduled',
      clientName: client.name,
      ticketId: request.ticketId,
      subject: request.subject,
      whenStr,
      durationMins: duration,
      meetingLink: saved.meetingLink,
      htmlLink: saved.htmlLink,
      note,
    });

    notifySupport(request.client, request._id, {
      typeLabel: 'Meeting Scheduled',
      title: `Meeting scheduled · ${request.ticketId}`,
      body: `Your meeting "${request.subject}" is set for ${whenStr}. A calendar invite with the video link has been sent to your email.`,
      key: 'supportUpdate',
      email: false,
    });

    emitToStaff('support:updated', { request });
    emitToUser(request.client, 'support:updated', { request });
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/support/:id/meetings/:meetingId
 * Admin & employee — reschedule an existing meeting in place (updates the
 * calendar event and re-notifies the client).
 * body: { scheduledAt (ISO), durationMins, note }
 */
const rescheduleMeeting = async (req, res, next) => {
  try {
    const { scheduledAt, durationMins, note } = req.body;
    const when = new Date(scheduledAt);
    if (!scheduledAt || isNaN(when.getTime())) {
      return res.status(400).json({ success: false, message: 'A valid meeting date/time is required' });
    }
    if (when.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'The meeting time must be in the future' });
    }
    const duration = Number(durationMins) > 0 ? Math.min(Number(durationMins), 480) : 30;

    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const meeting = request.meetings.id(req.params.meetingId);
    if (!meeting || meeting.status === 'cancelled') {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const organizer = await User.findById(req.user.id).select('email');
    const client = await refreshClientIdentity(request);

    try {
      await meetingService.rescheduleMeeting(meeting, {
        ...eventArgsFor(request, note),
        when,
        durationMins: duration,
        note,
        attendees: [client.email, organizer?.email],
      });
    } catch (err) {
      return res.status(err.statusCode || 502).json({
        success: false,
        message: err.message || 'Failed to reschedule the meeting. Please try again.',
      });
    }

    await request.save();
    await request.populate('assignedTo', 'name email');

    const whenStr = meetingService.fmtWhen(when);
    meetingService.sendMeetingEmail({
      to: client.email,
      kind: 'updated',
      clientName: client.name,
      ticketId: request.ticketId,
      subject: request.subject,
      whenStr,
      durationMins: duration,
      meetingLink: meeting.meetingLink,
      htmlLink: meeting.htmlLink,
      note,
    });

    notifySupport(request.client, request._id, {
      typeLabel: 'Meeting Rescheduled',
      title: `Meeting rescheduled · ${request.ticketId}`,
      body: `Your meeting "${request.subject}" has been moved to ${whenStr}. An updated calendar invite has been sent to your email.`,
      key: 'supportUpdate',
      email: false,
    });

    emitToStaff('support:updated', { request });
    emitToUser(request.client, 'support:updated', { request });
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/support/:id/meetings/:meetingId
 * Admin & employee — cancel a scheduled meeting: delete the Google Calendar
 * event (notifying attendees) and mark it cancelled (kept for history).
 */
const cancelMeeting = async (req, res, next) => {
  try {
    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const meeting = request.meetings.id(req.params.meetingId);
    if (!meeting || meeting.status === 'cancelled') {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    try {
      await meetingService.cancelMeeting(meeting);
    } catch (err) {
      return res.status(err.statusCode || 502).json({
        success: false,
        message: err.message || 'Failed to cancel the meeting. Please try again.',
      });
    }

    const client = await refreshClientIdentity(request);
    await request.save();
    await request.populate('assignedTo', 'name email');

    meetingService.sendMeetingEmail({
      to: client.email,
      kind: 'cancelled',
      clientName: client.name,
      ticketId: request.ticketId,
      subject: request.subject,
    });

    notifySupport(request.client, request._id, {
      typeLabel: 'Meeting Cancelled',
      title: `Meeting cancelled · ${request.ticketId}`,
      body: `Your meeting "${request.subject}" has been cancelled.`,
      key: 'supportUpdate',
      email: false,
    });

    emitToStaff('support:updated', { request });
    emitToUser(request.client, 'support:updated', { request });
    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRequest,
  listMyRequests,
  listRequests,
  acceptRequest,
  updateStatus,
  postMessage,
  scheduleMeeting,
  rescheduleMeeting,
  cancelMeeting,
};
