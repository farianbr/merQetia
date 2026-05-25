const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_PORT === '465', // true for port 465, false otherwise
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Send an email
 * @param {string}  to
 * @param {string}  subject
 * @param {string}  html
 * @param {Array}   [attachments] - Nodemailer attachment objects
 */
const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || 'merQetia <no-reply@merqetia.com>',
    to,
    subject,
    html,
    attachments,
  });
};

module.exports = { sendEmail };
