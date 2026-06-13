import api from './axios';

export const sendSupportMessage = (data) => api.post('/support/contact', data);
