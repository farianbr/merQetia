import api from './axios';

// Admin — Google Calendar connection
export const getGoogleStatus = () => api.get('/integrations/google/status');
export const getGoogleAuthUrl = () => api.get('/integrations/google/auth-url');
export const disconnectGoogle = () => api.post('/integrations/google/disconnect');
