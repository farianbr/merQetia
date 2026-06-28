const { getCalendarEvents } = require('../services/calendarService');

/**
 * GET /api/calendar
 * Admin + employee — calendar events (order placements, deadlines, meetings)
 * for a date window. Results are scoped to the requester inside the service.
 * Query: ?start=<ISO>&end=<ISO>  (defaults to the current month if absent)
 */
const events = async (req, res, next) => {
  try {
    let start = req.query.start ? new Date(req.query.start) : null;
    let end = req.query.end ? new Date(req.query.end) : null;

    if (!start || Number.isNaN(start.getTime())) {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (!end || Number.isNaN(end.getTime())) {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const list = await getCalendarEvents({ start, end, user: req.user });
    res.status(200).json({ success: true, events: list });
  } catch (err) {
    next(err);
  }
};

module.exports = { events };
