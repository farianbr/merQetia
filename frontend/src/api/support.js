import api from './axios';

// Client
export const sendSupportMessage = (data) => api.post('/support/contact', data);
export const getMyTickets = () => api.get('/support/my');

// Conversation — client (ticket owner) or assigned staff
export const postSupportMessage = (id, body) => api.post(`/support/${id}/messages`, { body });

// Admin & employee
export const getSupportRequests = (params) => api.get('/support', { params });
export const acceptSupportRequest = (id) => api.patch(`/support/${id}/accept`);
export const updateSupportStatus = (id, status) => api.patch(`/support/${id}/status`, { status });
export const scheduleSupportMeeting = (id, data) => api.post(`/support/${id}/meetings`, data);
export const rescheduleSupportMeeting = (id, meetingId, data) => api.patch(`/support/${id}/meetings/${meetingId}`, data);
export const cancelSupportMeeting = (id, meetingId) => api.delete(`/support/${id}/meetings/${meetingId}`);
