import api from './axios';

export const getEmployees = () => api.get('/employees');
export const getEmployeeById = (id) => api.get(`/employees/${id}`);
export const inviteEmployee = (data) => api.post('/employees/invite', data);
export const getClients = () => api.get('/clients');
export const getClientById = (id) => api.get(`/clients/${id}`);
export const getReportSummary = (params) => api.get('/reports/summary', { params });
export const getOrderStats = (params) => api.get('/reports/orders', { params });
export const getTopServices = (params) => api.get('/reports/top-services', { params });
export const getExpenses = (params) => api.get('/expenses', { params });
export const createExpense = (data) => api.post('/expenses', data);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);
