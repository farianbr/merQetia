import api from './axios';

// Calendar events (order placements, deadlines, meetings) within a window.
// `start`/`end` are ISO strings covering the visible month grid.
export const getCalendarEvents = (start, end) =>
  api.get('/calendar', { params: { start, end } });
