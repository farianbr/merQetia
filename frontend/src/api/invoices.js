import api from './axios';

export const getInvoices = () => api.get('/invoices');
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const markAsPaid = (id) => api.patch(`/invoices/${id}/pay`);
export const downloadPDF = (id) =>
  api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
