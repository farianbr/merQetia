import api from './axios';

export const getClientDashboard = () => api.get('/clients/dashboard');

// Employee — scoped client profile (clients they share an order with)
export const getSharedClient = (id) => api.get(`/clients/${id}/shared`);

// Client — scoped (limited) employee profile (employees on their own orders)
export const getPublicEmployee = (id) => api.get(`/employees/${id}/public`);
