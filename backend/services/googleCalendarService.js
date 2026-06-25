const { google } = require('googleapis');
const crypto = require('crypto');
const Integration = require('../models/Integration');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

/** Whether Google OAuth env credentials are configured at all. */
const isConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);

const getOAuthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

/**
 * Build the Google consent URL. `state` lets us defend against CSRF on the
 * callback; callers should persist it and compare on return.
 */
const getAuthUrl = () => {
  const state = crypto.randomBytes(16).toString('hex');
  const url = getOAuthClient().generateAuthUrl({
    access_type: 'offline',     // request a refresh token
    prompt: 'consent',          // force refresh token issuance on re-consent
    scope: SCOPES,
    include_granted_scopes: true,
    state,
  });
  return { url, state };
};

/**
 * Exchange an authorization code for tokens and persist the connection.
 * Stores the connected account email for display.
 */
const handleCallback = async (code, userId) => {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Look up which account this is, for display in the admin UI.
  let connectedEmail = '';
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    connectedEmail = data.email || '';
  } catch {
    // Non-fatal — we can still operate without the display email.
  }

  await Integration.findOneAndUpdate(
    { name: 'google' },
    { tokens, connectedEmail, connectedBy: userId || null },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { connectedEmail };
};

const getIntegration = () => Integration.findOne({ name: 'google' });

const isConnected = async () => {
  if (!isConfigured()) return false;
  const integration = await getIntegration();
  return !!(integration && integration.tokens && integration.tokens.refresh_token);
};

const getStatus = async () => {
  const configured = isConfigured();
  const integration = configured ? await getIntegration() : null;
  const connected = !!(integration && integration.tokens && integration.tokens.refresh_token);
  return {
    configured,
    connected,
    connectedEmail: connected ? integration.connectedEmail : '',
  };
};

const disconnect = () => Integration.findOneAndDelete({ name: 'google' });

/**
 * Return an authenticated OAuth client backed by stored tokens. Persists any
 * refreshed tokens so the connection survives access-token expiry.
 */
const getAuthedClient = async () => {
  const integration = await getIntegration();
  if (!integration || !integration.tokens) {
    const err = new Error('Google Calendar is not connected. Connect it in Settings first.');
    err.statusCode = 400;
    throw err;
  }

  const client = getOAuthClient();
  client.setCredentials(integration.tokens);

  // Persist refreshed tokens (Google rotates access tokens, keeps refresh token).
  client.on('tokens', (newTokens) => {
    const merged = { ...integration.tokens, ...newTokens };
    Integration.findOneAndUpdate({ name: 'google' }, { tokens: merged }).catch(() => {});
  });

  return client;
};

/**
 * Create a Google Calendar event with a Meet link and invite the attendees.
 * Google emails the calendar invite (with the Meet link) directly to each
 * attendee's address via `sendUpdates: 'all'`.
 *
 * @returns {{ eventId: string, meetingLink: string, htmlLink: string }}
 */
const createMeetingEvent = async ({ summary, description, startISO, durationMins = 30, attendees = [] }) => {
  if (!(await isConnected())) {
    const err = new Error('Google Calendar is not connected. Connect it in Settings first.');
    err.statusCode = 400;
    throw err;
  }

  const auth = await getAuthedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMins * 60 * 1000);

  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: attendees.filter(Boolean).map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const meetingLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    '';

  return { eventId: data.id || '', meetingLink, htmlLink: data.htmlLink || '' };
};

/**
 * Reschedule an existing event (new start/duration, optionally new copy) and
 * re-notify attendees. Preserves the existing Meet link.
 * @returns {{ eventId, meetingLink, htmlLink }}
 */
const updateMeetingEvent = async ({ eventId, summary, description, startISO, durationMins = 30, attendees }) => {
  if (!eventId) {
    const err = new Error('No meeting to reschedule.');
    err.statusCode = 400;
    throw err;
  }
  const auth = await getAuthedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMins * 60 * 1000);

  const { data } = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
    requestBody: {
      ...(summary ? { summary } : {}),
      ...(description ? { description } : {}),
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      // Refresh the invite list when provided (e.g. the client changed email).
      ...(attendees && attendees.length
        ? { attendees: attendees.filter(Boolean).map((email) => ({ email })) }
        : {}),
    },
  });

  const meetingLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    '';

  return { eventId: data.id || eventId, meetingLink, htmlLink: data.htmlLink || '' };
};

/**
 * Cancel/delete an event and notify attendees. Idempotent — a missing event
 * (404/410) is treated as already gone.
 */
const deleteMeetingEvent = async (eventId) => {
  if (!eventId) return;
  const auth = await getAuthedClient();
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'all' });
  } catch (err) {
    const code = err.code || err.response?.status;
    if (code !== 404 && code !== 410) throw err;
  }
};

module.exports = {
  isConfigured,
  getAuthUrl,
  handleCallback,
  isConnected,
  getStatus,
  disconnect,
  createMeetingEvent,
  updateMeetingEvent,
  deleteMeetingEvent,
};
