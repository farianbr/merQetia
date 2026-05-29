import api from './axios';

export const getOrders = (params) => api.get('/orders', { params });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const createOrder = (data) => api.post('/orders', data);
export const assignEmployee = (id, employeeId) =>
  api.patch(`/orders/${id}/assign`, { employeeId });
export const getMyAssignments = () => api.get('/orders/my-assignments');

export const acceptOrder = (id, deliveryDate) =>
  api.patch(`/orders/${id}/accept`, { deliveryDate });
export const rejectOrder = (id, reason) =>
  api.patch(`/orders/${id}/reject`, { reason });
export const completeOrder = (id) =>
  api.patch(`/orders/${id}/complete`);
export const sendMessage = (id, text, files = []) => {
  if (files.length === 0) {
    return api.post(`/orders/${id}/messages`, { text });
  }
  const fd = new FormData();
  if (text) fd.append('text', text);
  files.forEach((f) => fd.append('files', f));
  return api.post(`/orders/${id}/messages`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const sendUpdate = (id, text, files = []) => {
  if (files.length === 0) {
    return api.post(`/orders/${id}/updates`, { text });
  }
  const fd = new FormData();
  if (text) fd.append('text', text);
  files.forEach((f) => fd.append('files', f));
  return api.post(`/orders/${id}/updates`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
