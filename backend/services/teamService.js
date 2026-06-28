const Channel = require('../models/Channel');
const TeamMessage = require('../models/TeamMessage');
const Department = require('../models/Department');
const User = require('../models/User');
const Notification = require('../models/Notification');
const meetingService = require('./meetingService');
const { sendGenericNotification } = require('./emailService');
const { emitToUser, emitToStaff, emitToUsers } = require('../socket');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/* ── Channels ──────────────────────────────────────────────────────────────
   Membership is derived, never stored:
     org channel  → all admins + all employees
     dept channel → employees whose `departments` includes the dept name
                    (admins are deliberately excluded) */

const ORG_CHANNEL_NAME = 'merQetia';

/** Display name for a channel (org → 'merQetia', else the department's name). */
const channelName = (channel) =>
  channel.kind === 'org' ? ORG_CHANNEL_NAME : (channel.department?.name || 'Department');

/**
 * Ensure the org channel exists and every department has a matching channel.
 * Idempotent — safe to call on every request (mirrors departmentController's
 * seedDefaults pattern). Removes orphaned dept channels too.
 */
const ensureChannels = async () => {
  await Channel.updateOne({ kind: 'org' }, { $setOnInsert: { kind: 'org' } }, { upsert: true });

  const departments = await Department.find().select('_id').lean();
  const deptIds = departments.map((d) => d._id.toString());

  for (const id of deptIds) {
    await Channel.updateOne(
      { department: id },
      { $setOnInsert: { kind: 'department', department: id } },
      { upsert: true },
    );
  }

  // Prune channels whose department was deleted.
  const orphans = await Channel.find({ kind: 'department', department: { $nin: deptIds } }).select('_id');
  for (const o of orphans) {
    await TeamMessage.deleteMany({ channel: o._id });
    await o.deleteOne();
  }
};

/** Load a channel (with department populated) or throw 404. */
const loadChannel = async (channelId) => {
  const channel = await Channel.findById(channelId).populate('department', 'name');
  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }
  return channel;
};

/** Ids of every user who can see/post in a channel. */
const channelMemberIds = async (channel) => {
  const filter =
    channel.kind === 'org'
      ? { role: { $in: ['admin', 'employee'] } }
      : { role: 'employee', departments: channelName(channel) };
  const users = await User.find(filter).select('_id').lean();
  return users.map((u) => u._id.toString());
};

/** Whether a user belongs to a channel. */
const isMember = (channel, user) => {
  if (channel.kind === 'org') return user.role === 'admin' || user.role === 'employee';
  // department channel — employees in that department only
  return user.role === 'employee' && (user.departments || []).includes(channelName(channel));
};

const assertMember = (channel, user) => {
  if (!isMember(channel, user)) {
    const err = new Error('You are not a member of this channel');
    err.statusCode = 403;
    throw err;
  }
};

/** Channels the user may see, each with a display name + member count. */
const visibleChannelsFor = async (user) => {
  await ensureChannels();
  const channels = await Channel.find().populate('department', 'name').sort({ kind: 1 }).lean();

  // Re-derive name on lean docs (no virtuals)
  const withName = (c) => ({
    _id: c._id,
    kind: c.kind,
    name: c.kind === 'org' ? ORG_CHANNEL_NAME : (c.department?.name || 'Department'),
  });

  const visible = channels.filter((c) => {
    if (c.kind === 'org') return true;
    return user.role === 'employee' && (user.departments || []).includes(c.department?.name);
  });

  // Attach member counts
  const result = [];
  for (const c of visible) {
    const ids = await channelMemberIds({ kind: c.kind, department: c.department });
    result.push({ ...withName(c), memberCount: ids.length });
  }
  // Org first, then departments alphabetically
  result.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'org' ? -1 : 1));
  return result;
};

/* ── Messages ──────────────────────────────────────────────────────────── */

const POPULATE_MSG = [
  { path: 'sender', select: 'name role' },
  { path: 'mentions', select: 'name' },
];

/**
 * Paginated channel history (newest page first, returned ascending for display).
 * `before` is an ISO createdAt cursor for loading older messages.
 */
const getMessages = async (channelId, user, { before, limit = 30 } = {}) => {
  const channel = await loadChannel(channelId);
  assertMember(channel, user);

  const filter = { channel: channel._id };
  if (before) filter.createdAt = { $lt: new Date(before) };

  const page = await TeamMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate(POPULATE_MSG);

  const hasMore = page.length > limit;
  const messages = page.slice(0, limit).reverse(); // ascending for the thread
  return { channel: { _id: channel._id, kind: channel.kind, name: channelName(channel) }, messages, hasMore };
};

/**
 * People the requester may @mention in a channel (excluding themselves).
 * Org channel: every other staff member + every department (as a group target).
 * Dept channel: the department's other members.
 */
const getMentionables = async (channelId, user) => {
  const channel = await loadChannel(channelId);
  assertMember(channel, user);

  const memberFilter =
    channel.kind === 'org'
      ? { role: { $in: ['admin', 'employee'] } }
      : { role: 'employee', departments: channelName(channel) };

  const members = await User.find(memberFilter).select('name role').lean();
  const people = members
    .filter((m) => m._id.toString() !== user.id.toString())
    .map((m) => ({ _id: m._id, name: m.name, role: m.role }));

  if (channel.kind === 'org') {
    const departments = await Department.find().select('name').sort({ name: 1 }).lean();
    for (const d of departments) {
      people.push({ _id: `dept:${d.name}`, name: d.name, role: 'department' });
    }
  }

  return people;
};

/**
 * Split a raw mentions array (mixed user-ids and `dept:<Name>` tokens) into
 * validated user ids (must be channel members, never self) and department names.
 */
const resolveMentions = async (channel, senderId, rawMentions = []) => {
  const deptNames = [];
  const rawUserIds = [];
  for (const m of rawMentions || []) {
    const s = String(m);
    if (s.startsWith('dept:')) deptNames.push(s.slice(5));
    else rawUserIds.push(s);
  }

  const memberIds = new Set(await channelMemberIds(channel));
  const userIds = [...new Set(rawUserIds)].filter(
    (id) => memberIds.has(id) && id !== senderId.toString(),
  );

  // Keep only department names that exist (and, on a dept channel, only its own).
  let validDeptNames = [];
  if (deptNames.length) {
    const existing = await Department.find({ name: { $in: deptNames } }).select('name').lean();
    const existingNames = new Set(existing.map((d) => d.name));
    validDeptNames = [...new Set(deptNames)].filter((n) => {
      if (!existingNames.has(n)) return false;
      if (channel.kind === 'department') return n === channelName(channel);
      return true;
    });
  }

  return { userIds, deptNames: validDeptNames };
};

/**
 * Notify a single user about a team-chat event, honouring their per-channel
 * preferences. Fire-and-forget (never throws). Mirrors orderService.notify.
 */
const notifyTeam = (userId, { key, typeLabel, title, body, channelId }) => {
  User.findById(userId)
    .select('name email role notificationPrefs')
    .then((u) => {
      if (!u) return;
      const prefs = u.notificationPrefs || {};
      const home = u.role === 'admin' ? '/admin/employees' : '/employee/team';
      const link = `${home}?channel=${channelId}`;

      if (prefs.inApp?.[key] !== false) {
        Notification.create({ userId, channelId, link, type: 'team', typeLabel, title, body })
          .then((notif) => emitToUser(userId, 'notification:new', notif.toObject()))
          .catch(() => {});
      }

      if (prefs.email?.[key] === true) {
        sendGenericNotification({
          to: u.email,
          recipientName: u.name,
          subject: `${typeLabel} — ${title}`,
          heading: typeLabel,
          message: body,
          ctaLabel: 'Open Team',
          ctaUrl: `${FRONTEND_URL}${link}`,
        });
      }
    })
    .catch(() => {});
};

/** Broadcast a channel message to everyone in the channel (live update). */
const broadcastMessage = (channel, memberIds, message, event = 'team:message') => {
  const payload = { channelId: channel._id.toString(), message };
  if (channel.kind === 'org') emitToStaff(event, payload);
  else emitToUsers(memberIds, event, payload);
};

/**
 * Post a chat message. Notifies @mentioned members (`mentions`) and every other
 * channel member (`teamMessage`), skipping the sender and avoiding duplicates.
 */
const postMessage = async (channelId, user, { text = '', attachments = [], mentions = [] }) => {
  const channel = await loadChannel(channelId);
  assertMember(channel, user);

  const trimmed = (text || '').trim();
  if (!trimmed && attachments.length === 0) {
    const err = new Error('Message text or at least one attachment is required');
    err.statusCode = 400;
    throw err;
  }

  const { userIds, deptNames } = await resolveMentions(channel, user.id, mentions);

  const created = await TeamMessage.create({
    channel: channel._id,
    sender: user.id,
    senderRole: user.role,
    kind: 'message',
    text: trimmed,
    attachments,
    mentions: userIds,
    mentionDepartments: deptNames,
  });
  const message = await created.populate(POPULATE_MSG);

  const memberIds = await channelMemberIds(channel);
  const chanName = channelName(channel);
  const senderName = message.sender?.name || 'Someone';
  const preview = trimmed
    ? `${senderName}: "${trimmed.slice(0, 80)}"`
    : `${senderName} shared ${attachments.length} file${attachments.length > 1 ? 's' : ''} in ${chanName}.`;

  // Resolve who was mentioned (individuals + everyone in mentioned departments).
  const mentionedSet = new Set(userIds.map(String));
  if (deptNames.length) {
    const deptUsers = await User.find({ role: 'employee', departments: { $in: deptNames } }).select('_id').lean();
    deptUsers.forEach((u) => mentionedSet.add(u._id.toString()));
  }
  mentionedSet.delete(user.id.toString());

  // Mention notifications
  for (const uid of mentionedSet) {
    if (!memberIds.includes(uid)) continue;
    notifyTeam(uid, {
      key: 'mentions',
      typeLabel: 'You were mentioned',
      title: chanName,
      body: trimmed
        ? `${senderName} mentioned you in ${chanName}: "${trimmed.slice(0, 80)}"`
        : `${senderName} mentioned you in ${chanName}.`,
      channelId: channel._id,
    });
  }

  // Regular message notifications to the rest of the channel
  for (const uid of memberIds) {
    if (uid === user.id.toString() || mentionedSet.has(uid)) continue;
    notifyTeam(uid, {
      key: 'teamMessage',
      typeLabel: `New message in ${chanName}`,
      title: chanName,
      body: preview,
      channelId: channel._id,
    });
  }

  broadcastMessage(channel, memberIds, message);
  return message;
};

/**
 * Authorize streaming of a channel attachment: the requester must be a channel
 * member and the filename must belong to a message actually posted there.
 */
const assertChannelFileAccess = async (channelId, user, filename) => {
  const channel = await loadChannel(channelId);
  assertMember(channel, user);
  const msg = await TeamMessage.findOne({
    channel: channel._id,
    'attachments.filename': filename,
  }).select('_id').lean();
  if (!msg) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }
};

/* ── Meetings ──────────────────────────────────────────────────────────── */

/** Resolve invitees from selected department names + individual user ids. */
const resolveAttendees = async (channel, { departments = [], individuals = [] }) => {
  const memberIds = new Set(await channelMemberIds(channel));

  const ids = new Set();
  for (const id of individuals) {
    const s = String(id);
    if (memberIds.has(s)) ids.add(s);
  }
  if (departments.length) {
    const deptUsers = await User.find({ role: 'employee', departments: { $in: departments } }).select('_id').lean();
    deptUsers.forEach((u) => {
      const s = u._id.toString();
      if (memberIds.has(s)) ids.add(s);
    });
  }

  if (ids.size === 0) {
    const err = new Error('Select at least one department or person to invite');
    err.statusCode = 400;
    throw err;
  }

  return User.find({ _id: { $in: [...ids] } }).select('name email').lean();
};

const meetingEventArgs = (organizerName, note) => ({
  summary: 'merQetia · Team meeting',
  description: ['Team meeting', `Organised by ${organizerName}`, note ? `\nNotes: ${note}` : '']
    .filter(Boolean)
    .join('\n'),
});

const scheduleMeeting = async (channelId, user, { scheduledAt, durationMins, note, departments, individuals }) => {
  const channel = await loadChannel(channelId);
  assertMember(channel, user);
  const { when, duration } = meetingService.parseMeetingTime(scheduledAt, durationMins);

  const organizer = await User.findById(user.id).select('name email');
  const attendees = await resolveAttendees(channel, { departments, individuals });
  const attendeeEmails = [organizer?.email, ...attendees.map((a) => a.email)].filter(Boolean);

  const meeting = await meetingService.createMeeting({
    ...meetingEventArgs(organizer?.name || 'A teammate', note),
    when,
    durationMins: duration,
    note,
    scheduledByName: organizer?.name || '',
    attendees: attendeeEmails,
  });

  const created = await TeamMessage.create({
    channel: channel._id,
    sender: user.id,
    senderRole: user.role,
    kind: 'meeting',
    meeting,
    meetingAttendees: attendees.map((a) => a._id),
  });
  const message = await created.populate(POPULATE_MSG);

  const chanName = channelName(channel);
  const whenStr = meetingService.fmtWhen(when);
  attendees.forEach((a) =>
    notifyTeam(a._id, {
      key: 'teamMeeting',
      typeLabel: 'Team meeting scheduled',
      title: chanName,
      body: `${organizer?.name || 'A teammate'} scheduled a team meeting for ${whenStr}. A calendar invite with the video link has been emailed to you.`,
      channelId: channel._id,
    }),
  );

  const memberIds = await channelMemberIds(channel);
  broadcastMessage(channel, memberIds, message);
  return message;
};

/** Load a meeting message in a channel (the scheduler or any admin may manage it). */
const loadMeetingMessage = async (channel, user, messageId) => {
  const message = await TeamMessage.findOne({ _id: messageId, channel: channel._id, kind: 'meeting' });
  if (!message || !message.meeting || message.meeting.status === 'cancelled') {
    const err = new Error('Meeting not found');
    err.statusCode = 404;
    throw err;
  }
  if (user.role !== 'admin' && message.sender.toString() !== user.id.toString()) {
    const err = new Error('Only the organiser or an admin can change this meeting');
    err.statusCode = 403;
    throw err;
  }
  return message;
};

const rescheduleMeeting = async (channelId, user, messageId, { scheduledAt, durationMins, note }) => {
  const channel = await loadChannel(channelId);
  assertMember(channel, user);
  const { when, duration } = meetingService.parseMeetingTime(scheduledAt, durationMins);

  const message = await loadMeetingMessage(channel, user, messageId);
  const organizer = await User.findById(user.id).select('name');

  const attendees = await User.find({ _id: { $in: message.meetingAttendees } }).select('name email').lean();
  await meetingService.rescheduleMeeting(message.meeting, {
    ...meetingEventArgs(organizer?.name || 'A teammate', note),
    when,
    durationMins: duration,
    note,
    attendees: attendees.map((a) => a.email).filter(Boolean),
  });
  await message.save();
  const populated = await message.populate(POPULATE_MSG);

  const chanName = channelName(channel);
  const whenStr = meetingService.fmtWhen(when);
  attendees.forEach((a) =>
    notifyTeam(a._id, {
      key: 'teamMeeting',
      typeLabel: 'Team meeting rescheduled',
      title: chanName,
      body: `The team meeting in ${chanName} has been moved to ${whenStr}. An updated calendar invite has been emailed to you.`,
      channelId: channel._id,
    }),
  );

  const memberIds = await channelMemberIds(channel);
  broadcastMessage(channel, memberIds, populated, 'team:message:update');
  return populated;
};

const cancelMeeting = async (channelId, user, messageId) => {
  const channel = await loadChannel(channelId);
  assertMember(channel, user);
  const message = await loadMeetingMessage(channel, user, messageId);

  const attendees = await User.find({ _id: { $in: message.meetingAttendees } }).select('name email').lean();
  await meetingService.cancelMeeting(message.meeting);
  await message.save();
  const populated = await message.populate(POPULATE_MSG);

  const chanName = channelName(channel);
  attendees.forEach((a) =>
    notifyTeam(a._id, {
      key: 'teamMeeting',
      typeLabel: 'Team meeting cancelled',
      title: chanName,
      body: `The team meeting in ${chanName} has been cancelled.`,
      channelId: channel._id,
    }),
  );

  const memberIds = await channelMemberIds(channel);
  broadcastMessage(channel, memberIds, populated, 'team:message:update');
  return populated;
};

module.exports = {
  ensureChannels,
  visibleChannelsFor,
  getMessages,
  getMentionables,
  assertChannelFileAccess,
  postMessage,
  scheduleMeeting,
  rescheduleMeeting,
  cancelMeeting,
};
