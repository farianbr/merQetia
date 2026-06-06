import api from './axios';

export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const registerEmployee = (data) => api.post('/employees/register', data);
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);
export const uploadAvatar = (formData) => api.post('/auth/avatar', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const saveDashboardPrefs = (prefs) => api.put('/auth/dashboard-prefs', prefs);
