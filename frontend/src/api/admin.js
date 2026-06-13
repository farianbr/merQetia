import api from './axios';

export const getEmployees = () => api.get('/employees');
export const getEmployeeById = (id) => api.get(`/employees/${id}`);
export const inviteEmployee = (data) => api.post('/employees/invite', data);
export const updateEmployeeDepartments = (id, departments) =>
  api.patch(`/employees/${id}/departments`, { departments });

// Departments (dynamic teams)
export const getDepartments = () => api.get('/departments');
export const createDepartment = (data) => api.post('/departments', data);
export const updateDepartment = (id, data) => api.put(`/departments/${id}`, data);
export const deleteDepartment = (id) => api.delete(`/departments/${id}`);
export const getClients = () => api.get('/clients');
export const getClientById = (id) => api.get(`/clients/${id}`);
export const getReportSummary = (params) => api.get('/reports/summary', { params });
export const getOrderStats = (params) => api.get('/reports/orders', { params });
export const getTopServices = (params) => api.get('/reports/top-services', { params });
export const getExpenses = (params) => api.get('/expenses', { params });
export const createExpense = (data) => api.post('/expenses', data);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);
