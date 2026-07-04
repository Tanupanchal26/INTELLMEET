"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const nodemailer = require('nodemailer');
const config = require('../config/env');
const { smtp, clientUrl } = config;
const logger = require('../shared/utils/logger');
// ── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
});
const send = async ({ to, subject, html }) => {
    if (!smtp.host) {
        // SMTP not configured — log the email for local dev
        logger.debug(`[EMAIL SKIP] To: ${to} | Subject: ${subject}`);
        return;
    }
    try {
        await transporter.sendMail({ from: smtp.from, to, subject, html });
        logger.info(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
    }
    catch (err) {
        logger.error(`[EMAIL ERROR] ${err.message}`);
        throw err;
    }
};
// ── Email templates ───────────────────────────────────────────────────────────
const sendVerificationEmail = (user, rawToken) => send({
    to: user.email,
    subject: 'IntellMeet — Verify Your Email',
    html: `
      <h2>Hi ${user.name},</h2>
      <p>Click the button below to verify your email address.</p>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <a href="${clientUrl}/verify-email/${rawToken}"
         style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Verify Email
      </a>
      <p>If you didn't create an account, ignore this email.</p>
    `,
});
const sendPasswordResetEmail = (user, rawToken) => send({
    to: user.email,
    subject: 'IntellMeet — Reset Your Password',
    html: `
      <h2>Hi ${user.name},</h2>
      <p>You requested a password reset. Click the button below.</p>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <a href="${clientUrl}/reset-password/${rawToken}"
         style="background:#DC2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
        Reset Password
      </a>
      <p>If you did not request this, your account may be at risk — change your password immediately.</p>
    `,
});
module.exports = { send, sendVerificationEmail, sendPasswordResetEmail };
