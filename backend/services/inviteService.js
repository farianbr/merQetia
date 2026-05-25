const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../utils/mailer');

const generateToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * Admin invites an employee by email.
 * Generates a signed invite token (JWT) and emails a registration link.
 */
const inviteEmployee = async ({ email, name, departments }) => {
  // Prevent duplicate invitations or re-inviting existing users
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('A user with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  // Signed token valid for 48 hours — contains email, name, departments + purpose
  const token = jwt.sign(
    { email, name, departments, purpose: 'employee-invite' },
    process.env.INVITE_TOKEN_SECRET,
    { expiresIn: '48h' }
  );

  const inviteLink = `${process.env.APP_URL}/register/employee?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'You have been invited to join merQetia',
    html: `
      <h2>You're invited!</h2>
      <p>An admin has invited you to join merQetia as an employee.</p>
      <p>Click the link below to complete your registration. This link expires in 48 hours.</p>
      <a href="${inviteLink}" style="
        display:inline-block;padding:12px 24px;background:#4F46E5;
        color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;
      ">Accept Invitation</a>
      <p style="margin-top:16px;color:#6B7280;font-size:13px;">
        If you did not expect this invitation, please ignore this email.
      </p>
    `,
  });

  return { message: `Invitation sent to ${email}` };
};

/**
 * Employee completes registration using the invite token.
 */
const registerEmployee = async ({ token, name, password }) => {
  let payload;

  try {
    payload = jwt.verify(token, process.env.INVITE_TOKEN_SECRET);
  } catch (err) {
    const error = new Error('Invite link is invalid or has expired');
    error.statusCode = 400;
    throw error;
  }

  if (payload.purpose !== 'employee-invite') {
    const err = new Error('Invalid invite token');
    err.statusCode = 400;
    throw err;
  }

  // Guard against the email being registered between invite and accept
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    const err = new Error('This invite has already been used');
    err.statusCode = 409;
    throw err;
  }

  const user = await User.create({
    name,
    email: payload.email,
    password,
    role: 'employee',
    isInvited: true,
    departments: payload.departments || [],
  });

  const authToken = generateToken(user._id, user.role);

  return {
    token: authToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

module.exports = { inviteEmployee, registerEmployee };
