const SupportRequest = require('../models/SupportRequest');
const { sendEmail } = require('../utils/mailer');
const { emitToStaff } = require('../socket');

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.MAIL_USER || 'support@merqetia.com';

/**
 * POST /api/support/contact
 * Client only — submit a support message or meeting request.
 * Persists the request AND notifies the support inbox by email.
 */
const createRequest = async (req, res, next) => {
  try {
    const { type = 'message', subject, message, preferredDate, preferredTime } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const clientName = req.user.name || 'A client';
    const clientEmail = req.user.email;

    const request = await SupportRequest.create({
      client: req.user.id,
      clientName,
      clientEmail,
      type: type === 'meeting' ? 'meeting' : 'message',
      subject: subject.trim(),
      message: message.trim(),
      preferredDate: preferredDate || '',
      preferredTime: preferredTime || '',
    });

    // Notify the support inbox — best effort, never blocks the response
    const isMeeting = request.type === 'meeting';
    const emailSubject = isMeeting
      ? `[Meeting Request] ${request.subject}`
      : `[Support] ${request.subject}`;
    const html = `
      <h2 style="color:#4f46e5;">${isMeeting ? 'Meeting Request' : 'Support Message'} from ${clientName}</h2>
      <p><strong>Client:</strong> ${clientName} (${clientEmail})</p>
      <p><strong>Subject:</strong> ${request.subject}</p>
      ${isMeeting ? `<p><strong>Preferred Date:</strong> ${request.preferredDate || 'Not specified'}</p>
      <p><strong>Preferred Time:</strong> ${request.preferredTime || 'Not specified'}</p>` : ''}
      <hr/>
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-wrap;">${request.message}</p>
      <hr/>
      <p style="color:#6b7280;font-size:.875rem;">Manage this request in the merQetia admin Support Center.</p>
    `;
    sendEmail({ to: SUPPORT_EMAIL, subject: emailSubject, html }).catch((err) =>
      console.error('[Support] inbox notify failed:', err.message),
    );

    // Live-update the support center for all staff
    emitToStaff('support:new', { request });

    res.status(201).json({ success: true, message: 'Your message has been sent.', request });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/support
 * Admin only — list support requests with optional filters.
 * query: status=open|resolved, type=message|meeting
 */
const listRequests = async (req, res, next) => {
  try {
    const filter = {};
    if (['open', 'resolved'].includes(req.query.status)) filter.status = req.query.status;
    if (['message', 'meeting'].includes(req.query.type)) filter.type = req.query.type;

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
 * PATCH /api/support/:id/status
 * Admin only — set status to open or resolved.
 */
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const request = await SupportRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    emitToStaff('support:updated', { request });

    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/support/:id/reply
 * Admin only — email the client a reply, store it, and mark resolved.
 */
const replyToRequest = async (req, res, next) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Reply message is required' });

    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.clientEmail) {
      const html = `
        <h2 style="color:#4f46e5;">Re: ${request.subject}</h2>
        <p>Hi ${request.clientName || 'there'},</p>
        <p style="white-space:pre-wrap;">${message}</p>
        <hr/>
        <p style="color:#6b7280;font-size:.8rem;">In reply to your ${request.type === 'meeting' ? 'meeting request' : 'message'}: "${request.subject}".</p>
        <p style="color:#6b7280;font-size:.8rem;">— The merQetia Team</p>
      `;
      try {
        await sendEmail({ to: request.clientEmail, subject: `Re: ${request.subject}`, html });
      } catch (err) {
        return res.status(502).json({ success: false, message: 'Could not send the reply email. Please try again.' });
      }
    }

    request.reply = { message, repliedAt: new Date(), repliedBy: req.user.id };
    request.status = 'resolved';
    await request.save();

    emitToStaff('support:updated', { request });

    res.status(200).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

module.exports = { createRequest, listRequests, updateStatus, replyToRequest };
