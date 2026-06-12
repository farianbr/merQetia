const express = require('express');
const router = express.Router();
const { getInvoices, getInvoice, pay, clientPay, destroyInvoice, createInvoice, downloadPDF } = require('../controllers/invoiceController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

// Admin + Client — list invoices (scoped by role inside controller)
router.get('/', protect, authorize('admin', 'client'), getInvoices);

// Admin + Client — single invoice (ownership checked inside controller)
router.get('/:id', protect, authorize('admin', 'client'), getInvoice);

// Admin + Client — download invoice as PDF
router.get('/:id/pdf', protect, authorize('admin', 'client'), downloadPDF);

// Admin only — mark invoice as paid (manual override)
router.patch('/:id/pay', protect, authorize('admin'), pay);

// Client only — demo payment gateway
router.patch('/:id/client-pay', protect, authorize('client'), clientPay);

// Admin only — void (delete) an unpaid invoice
router.delete('/:id', protect, authorize('admin'), destroyInvoice);

// Admin only — create a partial/advance invoice manually
router.post('/', protect, authorize('admin'), createInvoice);

module.exports = router;
