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
export const submitForReview = (id) =>
  api.patch(`/orders/${id}/submit-review`);
export const confirmOrder = (id) =>
  api.patch(`/orders/${id}/confirm`);
export const requestChanges = (id, note) =>
  api.patch(`/orders/${id}/request-changes`, { note });
export const forceCompleteOrder = (id) =>
  api.patch(`/orders/${id}/force-complete`);
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

export const getOrderParticipants = (id) =>
  api.get(`/orders/${id}/participants`);

export const sendUpdate = (id, text, files = [], mentions = []) => {
  if (files.length === 0) {
    return api.post(`/orders/${id}/updates`, { text, mentions });
  }
  const fd = new FormData();
  if (text) fd.append('text', text);
  fd.append('mentions', JSON.stringify(mentions));
  files.forEach((f) => fd.append('files', f));
  return api.post(`/orders/${id}/updates`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const adminSetDeliveryDate = (id, deliveryDate) =>
  api.patch(`/orders/${id}/delivery-date`, { deliveryDate });

export const adminResetStatus = (id) =>
  api.patch(`/orders/${id}/reset-status`);
