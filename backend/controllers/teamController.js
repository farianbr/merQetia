const teamService = require('../services/teamService');
const { getObject } = require('../utils/storage');

/** Parse a mentions field that may arrive as an array or a JSON string (multipart). */
const parseMentions = (raw) => {
  let mentions = raw;
  if (typeof mentions === 'string') {
    try { mentions = JSON.parse(mentions); } catch { mentions = []; }
  }
  return Array.isArray(mentions) ? mentions : [];
};

const parseList = (raw) => {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  return Array.isArray(list) ? list : [];
};

/** GET /api/team/channels */
const getChannels = async (req, res, next) => {
  try {
    const channels = await teamService.visibleChannelsFor(req.user);
    res.json({ success: true, channels });
  } catch (err) {
    next(err);
  }
};

/** GET /api/team/channels/:id/messages */
const getMessages = async (req, res, next) => {
  try {
    const { before, limit } = req.query;
    const result = await teamService.getMessages(req.params.id, req.user, {
      before,
      limit: Math.min(parseInt(limit) || 30, 100),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/** GET /api/team/channels/:id/mentionables */
const getMentionables = async (req, res, next) => {
  try {
    const participants = await teamService.getMentionables(req.params.id, req.user);
    res.json({ success: true, participants });
  } catch (err) {
    next(err);
  }
};

/** POST /api/team/channels/:id/messages */
const postMessage = async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    const files = req.files || [];
    const attachments = files.map((f) => ({
      originalName: f.originalname,
      filename: f.filename,
      // Authorized proxy path (no /api prefix; the SPA's axios base adds it).
      url: `/team/channels/${req.params.id}/files/${f.filename}`,
      mimetype: f.mimetype,
      size: f.size,
    }));

    const message = await teamService.postMessage(req.params.id, req.user, {
      text,
      attachments,
      mentions: parseMentions(req.body.mentions),
    });
    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

/** GET /api/team/channels/:id/files/:filename — stream a private channel attachment */
const streamChannelFile = async (req, res, next) => {
  try {
    const { id, filename } = req.params;
    await teamService.assertChannelFileAccess(id, req.user, filename);

    const { stream, contentType, contentLength } = await getObject(`team/${id}/${filename}`);
    res.setHeader('Content-Type', contentType);
    if (contentLength != null) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'private, max-age=300');
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

/** POST /api/team/channels/:id/meetings */
const scheduleMeeting = async (req, res, next) => {
  try {
    const message = await teamService.scheduleMeeting(req.params.id, req.user, {
      scheduledAt: req.body.scheduledAt,
      durationMins: req.body.durationMins,
      note: req.body.note,
      departments: parseList(req.body.departments),
      individuals: parseList(req.body.individuals),
    });
    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/team/channels/:id/meetings/:messageId */
const rescheduleMeeting = async (req, res, next) => {
  try {
    const message = await teamService.rescheduleMeeting(req.params.id, req.user, req.params.messageId, req.body);
    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/team/channels/:id/meetings/:messageId */
const cancelMeeting = async (req, res, next) => {
  try {
    const message = await teamService.cancelMeeting(req.params.id, req.user, req.params.messageId);
    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getChannels,
  getMessages,
  getMentionables,
  postMessage,
  streamChannelFile,
  scheduleMeeting,
  rescheduleMeeting,
  cancelMeeting,
};
