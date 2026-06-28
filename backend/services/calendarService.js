const Order = require('../models/Order');
const SupportRequest = require('../models/SupportRequest');
const TeamMessage = require('../models/TeamMessage');
const { visibleChannelsFor } = require('./teamService');

/**
 * Aggregate everything the calendar shows for a date window:
 *   - order-placed   : when an order was created (order.createdAt)
 *   - order-deadline : an order's delivery/due date (order.deliveryDate)
 *   - meeting        : scheduled video meetings from orders, support tickets
 *                      and team channels
 *
 * Each event is normalised to a common shape so the frontend can render them
 * uniformly:
 *   { id, type, title, date, allDay, link, meta }
 *
 * Scoped by the requesting `user`: admins see everything; employees see only
 * their own assigned orders/tickets and meetings in channels they belong to.
 * Deep links are role-aware so each event opens in the right area of the app.
 *
 * `start`/`end` bound the window (the visible month grid). They're required —
 * the controller defaults them to the current month if absent.
 */
async function getCalendarEvents({ start, end, user }) {
  const range = { $gte: start, $lte: end };
  const isAdmin = user.role === 'admin';
  const orderLink = (id) => (isAdmin ? `/admin/orders/${id}` : '/employee/orders');
  const events = [];

  /* ── Orders: placed dates, deadlines, and order↔client meetings ── */
  const orderFilter = {
    $or: [
      { createdAt: range },
      { deliveryDate: range },
      { meetings: { $elemMatch: { scheduledAt: range, status: 'scheduled' } } },
    ],
  };
  // Employees only see orders assigned to them.
  if (!isAdmin) orderFilter.assignedEmployee = user.id;

  const orders = await Order.find(orderFilter)
    .populate('clientId', 'name')
    .populate('assignedEmployee', 'name')
    .populate('services', 'name')
    .lean();

  for (const o of orders) {
    const serviceName = (o.services || []).map((s) => s.name).filter(Boolean).join(', ') || 'Order';
    const clientName = o.clientId?.name || '';
    const link = orderLink(o._id);

    if (o.createdAt && o.createdAt >= start && o.createdAt <= end) {
      events.push({
        id: `order-placed-${o._id}`,
        type: 'order-placed',
        title: serviceName,
        date: o.createdAt,
        allDay: true,
        link,
        meta: { orderId: String(o._id), client: clientName, status: o.status },
      });
    }

    if (o.deliveryDate && o.deliveryDate >= start && o.deliveryDate <= end) {
      events.push({
        id: `order-deadline-${o._id}`,
        type: 'order-deadline',
        title: serviceName,
        date: o.deliveryDate,
        allDay: true,
        link,
        meta: {
          orderId: String(o._id),
          client: clientName,
          employee: o.assignedEmployee?.name || '',
          status: o.status,
        },
      });
    }

    for (const m of o.meetings || []) {
      if (m.status !== 'scheduled' || !m.scheduledAt) continue;
      if (m.scheduledAt < start || m.scheduledAt > end) continue;
      events.push({
        id: `order-meeting-${o._id}-${m._id}`,
        type: 'meeting',
        title: clientName ? `Meeting · ${clientName}` : `Meeting · ${serviceName}`,
        date: m.scheduledAt,
        allDay: false,
        link,
        meta: {
          source: 'order',
          orderId: String(o._id),
          client: clientName,
          durationMins: m.durationMins || null,
          meetingLink: m.meetingLink || '',
          note: m.note || '',
        },
      });
    }
  }

  /* ── Support tickets: scheduled meetings ── */
  const supportFilter = {
    meetings: { $elemMatch: { scheduledAt: range, status: 'scheduled' } },
  };
  // Employees only see tickets they've accepted.
  if (!isAdmin) supportFilter.assignedTo = user.id;
  const tickets = await SupportRequest.find(supportFilter).lean();

  for (const t of tickets) {
    for (const m of t.meetings || []) {
      if (m.status !== 'scheduled' || !m.scheduledAt) continue;
      if (m.scheduledAt < start || m.scheduledAt > end) continue;
      events.push({
        id: `support-meeting-${t._id}-${m._id}`,
        type: 'meeting',
        title: `Support · ${t.clientName || t.ticketId || 'Ticket'}`,
        date: m.scheduledAt,
        allDay: false,
        link: `${isAdmin ? '/admin/support' : '/employee/support'}?ticket=${t._id}`,
        meta: {
          source: 'support',
          ticketId: t.ticketId || '',
          client: t.clientName || '',
          subject: t.subject || '',
          durationMins: m.durationMins || null,
          meetingLink: m.meetingLink || '',
          note: m.note || '',
        },
      });
    }
  }

  /* ── Team channels: scheduled meetings ── */
  const teamFilter = {
    kind: 'meeting',
    'meeting.scheduledAt': range,
    'meeting.status': 'scheduled',
  };
  // Employees only see meetings in channels they belong to (org + their depts).
  if (!isAdmin) {
    const channels = await visibleChannelsFor(user);
    teamFilter.channel = { $in: channels.map((c) => c._id) };
  }
  const teamMeetings = await TeamMessage.find(teamFilter)
    .populate('channel', 'name')
    .lean();

  for (const tm of teamMeetings) {
    const m = tm.meeting;
    if (!m || !m.scheduledAt) continue;
    const channelName = tm.channel?.name || 'Team';
    events.push({
      id: `team-meeting-${tm._id}`,
      type: 'meeting',
      title: `Team · ${channelName}`,
      date: m.scheduledAt,
      allDay: false,
      link: null,
      meta: {
        source: 'team',
        channel: channelName,
        organizer: m.scheduledByName || '',
        durationMins: m.durationMins || null,
        meetingLink: m.meetingLink || '',
        note: m.note || '',
      },
    });
  }

  // Chronological — keeps each day's chips in time order on the client.
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

module.exports = { getCalendarEvents };
