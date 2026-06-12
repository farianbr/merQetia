import api from './axios';

export const getInvoices = (params) => api.get('/invoices', { params });
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const markAsPaid = (id) => api.patch(`/invoices/${id}/pay`);
export const clientPayInvoice = (id) => api.patch(`/invoices/${id}/client-pay`);
export const voidInvoice = (id) => api.delete(`/invoices/${id}`);
export const createInvoice = (data) => api.post('/invoices', data);
export const downloadPDF = (id) =>
  api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
