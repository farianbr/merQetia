import api from './axios';

export const getClientDashboard = () => api.get('/clients/dashboard');
