const googleCalendar = require('../services/googleCalendarService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Short-lived store of pending OAuth `state` → { userId, expires }. Guards the
// callback against CSRF and lets us attribute the connection to the admin who
// started it (the Google redirect carries no JWT). In-memory is sufficient for
// a single-instance deployment; states expire after 10 minutes.
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

const sweepStates = () => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expires < now) pendingStates.delete(key);
  }
};

/** GET /api/integrations/google/status (admin) */
const googleStatus = async (req, res, next) => {
  try {
    res.json({ success: true, ...(await googleCalendar.getStatus()) });
  } catch (err) {
    next(err);
  }
};

/** GET /api/integrations/google/auth-url (admin) — returns the consent URL. */
const googleAuthUrl = async (req, res, next) => {
  try {
    if (!googleCalendar.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Google integration is not configured on the server.',
      });
    }
    sweepStates();
    const { url, state } = googleCalendar.getAuthUrl();
    pendingStates.set(state, { userId: req.user.id, expires: Date.now() + STATE_TTL_MS });
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/integrations/google/callback — OAuth redirect target.
 * Public route (Google redirects the browser, no JWT); authenticity is enforced
 * via the one-time `state` we issued. Redirects back to the admin settings page.
 */
const googleCallback = async (req, res) => {
  const { code, state, error } = req.query;
  const settingsUrl = `${FRONTEND_URL}/admin/settings`;

  if (error) return res.redirect(`${settingsUrl}?google=denied`);

  const pending = state && pendingStates.get(state);
  if (!code || !pending || pending.expires < Date.now()) {
    if (state) pendingStates.delete(state);
    return res.redirect(`${settingsUrl}?google=error`);
  }
  pendingStates.delete(state);

  try {
    await googleCalendar.handleCallback(code, pending.userId);
    res.redirect(`${settingsUrl}?google=connected`);
  } catch (err) {
    console.error('[Google OAuth] callback failed:', err.message);
    res.redirect(`${settingsUrl}?google=error`);
  }
};

/** POST /api/integrations/google/disconnect (admin) */
const googleDisconnect = async (req, res, next) => {
  try {
    await googleCalendar.disconnect();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { googleStatus, googleAuthUrl, googleCallback, googleDisconnect };
