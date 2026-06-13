import api from './axios';

// Client
export const sendSupportMessage = (data) => api.post('/support/contact', data);

// Admin
export const getSupportRequests = (params) => api.get('/support', { params });
export const updateSupportStatus = (id, status) => api.patch(`/support/${id}/status`, { status });
export const replySupportRequest = (id, message) => api.post(`/support/${id}/reply`, { message });
