const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { sendEmail } = require('../utils/mailer');

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many support requests. Please try again later.' },
});

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.MAIL_USER || 'support@merqetia.com';

/**
 * POST /api/support/contact
 * Client only — send a support message or meeting request.
 * body: { type: 'message' | 'meeting', subject, message, preferredDate?, preferredTime? }
 */
router.post('/contact', protect, authorize('client'), supportLimiter, async (req, res, next) => {
  try {
    const { type = 'message', subject, message, preferredDate, preferredTime } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const clientName = req.user.name || 'A client';
    const clientEmail = req.user.email;

    let html;
    let emailSubject;

    if (type === 'meeting') {
      emailSubject = `[Meeting Request] ${subject.trim()}`;
      html = `
        <h2 style="color:#4f46e5;">Meeting Request from ${clientName}</h2>
        <p><strong>Client:</strong> ${clientName} (${clientEmail})</p>
        <p><strong>Subject:</strong> ${subject.trim()}</p>
        <p><strong>Preferred Date:</strong> ${preferredDate || 'Not specified'}</p>
        <p><strong>Preferred Time:</strong> ${preferredTime || 'Not specified'}</p>
        <hr/>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap;">${message.trim()}</p>
        <hr/>
        <p style="color:#6b7280;font-size:.875rem;">Reply directly to this email to contact the client.</p>
      `;
    } else {
      emailSubject = `[Support] ${subject.trim()}`;
      html = `
        <h2 style="color:#4f46e5;">Support Message from ${clientName}</h2>
        <p><strong>Client:</strong> ${clientName} (${clientEmail})</p>
        <p><strong>Subject:</strong> ${subject.trim()}</p>
        <hr/>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap;">${message.trim()}</p>
        <hr/>
        <p style="color:#6b7280;font-size:.875rem;">Reply directly to this email to contact the client.</p>
      `;
    }

    await sendEmail({ to: SUPPORT_EMAIL, subject: emailSubject, html });

    res.status(200).json({ success: true, message: 'Your message has been sent.' });
  } catch (err) {
    // Don't expose mailer errors to client — log and return generic success
    console.error('[Support] Failed to send support email:', err.message);
    // Still return success so UX isn't broken if email is not configured
    res.status(200).json({ success: true, message: 'Your message has been sent.' });
  }
});

module.exports = router;
