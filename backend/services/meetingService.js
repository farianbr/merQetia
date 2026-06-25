const googleCalendar = require('./googleCalendarService');
const { sendMeetingEmail } = require('./emailService');

// Human-friendly date/time for emails & notifications.
const fmtWhen = (date) =>
  new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

// End time of a meeting (start + duration). Used to decide if it's still active.
const meetingEnd = (m) =>
  m?.scheduledAt ? new Date(m.scheduledAt).getTime() + (m.durationMins || 0) * 60000 : 0;

/**
 * Whether a parent already has a meeting that hasn't ended yet (and isn't
 * cancelled). A new meeting can only be scheduled when this is false.
 */
const hasActiveMeeting = (meetings = []) =>
  meetings.some((m) => m.status === 'scheduled' && meetingEnd(m) > Date.now());

/**
 * Create a Google Calendar event (with a Meet link) and return a meeting
 * subdocument ready to push onto a parent's `meetings` array. Throws (with a
 * statusCode) when the calendar call fails so callers can surface it.
 */
const createMeeting = async ({ summary, description, when, durationMins, note, scheduledByName, attendees }) => {
  const event = await googleCalendar.createMeetingEvent({
    summary,
    description,
    startISO: when.toISOString(),
    durationMins,
    attendees: (attendees || []).filter(Boolean),
  });
  return {
    scheduledAt: when,
    bookedAt: new Date(),
    durationMins,
    eventId: event.eventId,
    meetingLink: event.meetingLink || '',
    htmlLink: event.htmlLink || '',
    provider: 'google',
    note: note || '',
    scheduledByName: scheduledByName || '',
    status: 'scheduled',
  };
};

/**
 * Reschedule an existing meeting subdocument in place (mutates it). Updates the
 * calendar event and re-notifies attendees.
 */
const rescheduleMeeting = async (meeting, { summary, description, when, durationMins, note, attendees }) => {
  const event = await googleCalendar.updateMeetingEvent({
    eventId: meeting.eventId,
    summary,
    description,
    startISO: when.toISOString(),
    durationMins,
    attendees,
  });
  meeting.scheduledAt = when;
  meeting.bookedAt = new Date();
  meeting.durationMins = durationMins;
  meeting.meetingLink = event.meetingLink || meeting.meetingLink;
  meeting.htmlLink = event.htmlLink || meeting.htmlLink;
  if (note !== undefined) meeting.note = note;
  meeting.status = 'scheduled';
  return meeting;
};

/**
 * Cancel a meeting: delete its calendar event (notifying attendees) and mark it
 * cancelled. The subdocument is kept so the conversation history stays intact.
 */
const cancelMeeting = async (meeting) => {
  await googleCalendar.deleteMeetingEvent(meeting.eventId);
  meeting.status = 'cancelled';
  return meeting;
};

module.exports = {
  fmtWhen,
  meetingEnd,
  hasActiveMeeting,
  createMeeting,
  rescheduleMeeting,
  cancelMeeting,
  sendMeetingEmail,
};
