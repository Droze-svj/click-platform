// Email notification service

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Email service configuration
let transporter = null;

/**
 * Initialize email service
 */
function initEmailService() {
  const emailProvider = process.env.EMAIL_PROVIDER || 'sendgrid'; // sendgrid, mailgun, ses, smtp

  try {
    switch (emailProvider) {
      case 'sendgrid':
        if (process.env.SENDGRID_API_KEY) {
          transporter = nodemailer.createTransport({
            service: 'SendGrid',
            auth: {
              user: 'apikey',
              pass: process.env.SENDGRID_API_KEY,
            },
          });
          logger.info('✅ Email service initialized (SendGrid)');
        } else {
          logger.warn('⚠️ SendGrid API key not found. Email service disabled.');
        }
        break;

      case 'mailgun':
        if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
          transporter = nodemailer.createTransport({
            host: `smtp.mailgun.org`,
            port: 587,
            secure: false,
            auth: {
              user: process.env.MAILGUN_SMTP_USER || `postmaster@${process.env.MAILGUN_DOMAIN}`,
              pass: process.env.MAILGUN_API_KEY,
            },
          });
          logger.info('✅ Email service initialized (Mailgun)');
        } else {
          logger.warn('⚠️ Mailgun credentials not found. Email service disabled.');
        }
        break;

      case 'ses':
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
          transporter = nodemailer.createTransport({
            SES: {
              aws: require('@aws-sdk/client-ses'),
              region: process.env.AWS_SES_REGION || 'us-east-1',
            },
          });
          logger.info('✅ Email service initialized (AWS SES)');
        } else {
          logger.warn('⚠️ AWS credentials not found. Email service disabled.');
        }
        break;

      case 'smtp':
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
          transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });
          logger.info('✅ Email service initialized (SMTP)');
        } else {
          logger.warn('⚠️ SMTP credentials not found. Email service disabled.');
        }
        break;

      default:
        logger.warn(`⚠️ Unknown email provider: ${emailProvider}. Email service disabled.`);
    }
  } catch (error) {
    logger.error('Email service initialization error', { error: error.message });
    captureException(error, { tags: { service: 'email', operation: 'init' } });
  }
}

/**
 * Check if email service is available
 */
function isEmailServiceAvailable() {
  return transporter !== null;
}

/**
 * Send email
 */
async function sendEmail(options) {
  if (!isEmailServiceAvailable()) {
    logger.warn('Email service not available. Email not sent.', { to: options.to, subject: options.subject });
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const fromEmail = process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || 'noreply@click.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'Click';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html || options.text,
      text: options.text || options.html?.replace(/<[^>]*>/g, ''),
    };

    if (options.cc) mailOptions.cc = options.cc;
    if (options.bcc) mailOptions.bcc = options.bcc;
    if (options.replyTo) mailOptions.replyTo = options.replyTo;
    if (options.attachments) mailOptions.attachments = options.attachments;

    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', { to: options.to, subject: options.subject, messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Email send error', { error: error.message, to: options.to });
    captureException(error, { tags: { service: 'email', operation: 'send' }, extra: { to: options.to } });
    return { success: false, error: error.message };
  }
}

/**
 * Send welcome email with template
 */
async function sendWelcomeEmail(userEmail, userName) {
  const { getEmailTemplate } = require('../utils/emailTemplateEngine');
  
  // Try to use template, fallback to inline HTML
  let html = getEmailTemplate('welcome', {
    userName: userName || 'there',
    headerTitle: 'Welcome to Click! 🎉',
    subject: 'Welcome to Click!',
    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
  });

  // Fallback to inline HTML if template not found
  if (!html) {
    html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Click! 🎉</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>Welcome to Click! We're excited to have you on board.</p>
          <p>Click is your all-in-one content creation platform. Here's what you can do:</p>
          <ul>
            <li>✨ Generate engaging social media content</li>
            <li>🎬 Create short-form videos from long content</li>
            <li>📝 Generate scripts for YouTube, podcasts, and blogs</li>
            <li>📅 Schedule and publish to multiple platforms</li>
            <li>📊 Track your content performance</li>
          </ul>
          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">Get Started</a>
          </p>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Happy creating!<br>The Click Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Click. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  }

  return sendEmail({
    to: userEmail,
    subject: 'Welcome to Click! 🎉',
    html,
  });
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(userEmail, resetToken, userName) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>We received a request to reset your password for your Click account.</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </div>
          <p>If you have any questions, contact our support team.</p>
          <p>Best regards,<br>The Click Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Click. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: 'Reset Your Password - Click',
    html,
  });
}

/**
 * Send content processing complete email
 */
async function sendContentProcessingEmail(userEmail, contentTitle, contentType, userName) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Content Ready!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>Great news! Your ${contentType} "${contentTitle}" has been processed and is ready to use.</p>
          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/content" class="button">View Content</a>
          </p>
          <p>You can now schedule it, publish it, or make any edits you need.</p>
          <p>Happy creating!<br>The Click Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Click. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Your ${contentType} is ready! ✅`,
    html,
  });
}

/**
 * Send subscription expiration warning
 */
async function sendSubscriptionExpirationEmail(userEmail, daysRemaining, userName, planName) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${daysRemaining <= 3 ? '#dc3545' : '#ffc107'}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Subscription Expiring Soon</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>Your ${planName} subscription will expire in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.</p>
          <p>Renew now to continue enjoying all Click features without interruption.</p>
          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing" class="button">Renew Subscription</a>
          </p>
          <p>Thank you for being a valued Click user!</p>
          <p>Best regards,<br>The Click Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Click. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Your Click subscription expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`,
    html,
  });
}

/**
 * Send team invitation email
 */
async function sendTeamInvitationEmail(userEmail, inviterName, teamName, invitationToken, userName) {
  const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/teams/accept?token=${invitationToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Team Invitation</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p><strong>${inviterName}</strong> has invited you to join the <strong>${teamName}</strong> team on Click.</p>
          <p>Accept the invitation to start collaborating on content creation.</p>
          <p style="text-align: center;">
            <a href="${acceptUrl}" class="button">Accept Invitation</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${acceptUrl}</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          <p>Best regards,<br>The Click Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Click. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: `You've been invited to join ${teamName} on Click`,
    html,
  });
}

/**
 * Send weekly digest email
 */
async function sendWeeklyDigestEmail(userEmail, stats, userName) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .stat { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; text-align: center; }
        .stat-number { font-size: 32px; font-weight: bold; color: #667eea; }
        .stat-label { color: #666; margin-top: 5px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Weekly Summary 📊</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>Here's what you accomplished this week:</p>
          <div class="stat">
            <div class="stat-number">${stats.contentCreated || 0}</div>
            <div class="stat-label">Content Created</div>
          </div>
          <div class="stat">
            <div class="stat-number">${stats.postsPublished || 0}</div>
            <div class="stat-label">Posts Published</div>
          </div>
          <div class="stat">
            <div class="stat-number">${stats.totalEngagement || 0}</div>
            <div class="stat-label">Total Engagement</div>
          </div>
          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">View Dashboard</a>
          </p>
          <p>Keep up the great work! 🚀</p>
          <p>Best regards,<br>The Click Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Click. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: 'Your Weekly Click Summary 📊',
    html,
  });
}

module.exports = {
  initEmailService,
  isEmailServiceAvailable,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendContentProcessingEmail,
  sendSubscriptionExpirationEmail,
  sendTeamInvitationEmail,
  sendWeeklyDigestEmail,
};



