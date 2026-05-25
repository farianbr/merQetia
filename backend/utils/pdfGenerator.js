const puppeteer = require('puppeteer');
const { generateInvoiceHTML } = require('./invoiceTemplate');

/**
 * Converts a populated invoice object into a PDF buffer.
 * @param {Object} invoice - Fully populated invoice document
 * @returns {Buffer} PDF binary buffer
 */
const generatePDF = async (invoice) => {
  const html = generateInvoiceHTML(invoice);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Prevents crashes in low-memory environments
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return pdf;
  } finally {
    await browser.close();
  }
};

module.exports = { generatePDF };
