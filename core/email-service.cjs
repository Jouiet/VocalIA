'use strict';

/**
 * VocalIA Email Service — Dual-Mode (Resend + Nodemailer SMTP)
 *
 * Primary: Resend API (fast, reliable, no SMTP config needed)
 * Fallback: Nodemailer SMTP (for self-hosted/custom SMTP setups)
 *
 * Required env vars:
 *   Resend:     RESEND_API_KEY
 *   Nodemailer: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * @version 2.0.0
 * Session 250.205
 */

let Resend = null;
let nodemailer = null;
let _resend = null;
let _transporter = null;

try {
  ({ Resend } = require('resend'));
} catch {
  // Resend not installed — will use nodemailer fallback
}

try {
  nodemailer = require('nodemailer');
} catch {
  // nodemailer not installed
}

const ENV = process.env;

function getResendClient() {
  if (_resend) return _resend;
  if (!Resend) return null;
  if (!ENV.RESEND_API_KEY) return null;

  _resend = new Resend(ENV.RESEND_API_KEY);
  console.log('✅ [EmailService] Resend client ready');
  return _resend;
}

function getTransporter() {
  if (_transporter) return _transporter;
  if (!nodemailer) return null;

  const host = ENV.SMTP_HOST;
  const port = parseInt(ENV.SMTP_PORT || '587', 10);
  const user = ENV.SMTP_USER;
  const pass = ENV.SMTP_PASS;

  if (!host || !user || !pass) return null;

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: true }
  });

  console.log(`✅ [EmailService] SMTP transporter ready: ${host}:${port}`);
  return _transporter;
}

/**
 * Send email via Resend (primary) or nodemailer (fallback)
 * @param {Object} opts
 * @param {string} opts.to - Recipient email
 * @param {string} opts.subject - Email subject
 * @param {string} opts.html - HTML body
 * @param {string} [opts.from] - Sender (default: VocalIA <noreply@vocalia.ma>)
 * @returns {Promise<{success: boolean, method: string, messageId?: string, error?: string}>}
 */
async function sendEmail({ to, subject, html, from }) {
  const sender = from || ENV.SMTP_FROM || 'VocalIA <noreply@vocalia.ma>';

  // Try Resend first
  const resend = getResendClient();
  if (resend) {
    try {
      const result = await resend.emails.send({
        from: sender,
        to: [to],
        subject,
        html
      });
      if (result.error) {
        console.error('❌ [EmailService] Resend error:', result.error.message);
        // Fall through to nodemailer
      } else {
        console.log(`✅ [EmailService] Email sent via Resend to ${to} (${result.data?.id})`);
        return { success: true, method: 'resend', messageId: result.data?.id };
      }
    } catch (err) {
      console.error('❌ [EmailService] Resend exception:', err.message);
      // Fall through to nodemailer
    }
  }

  // Fallback to nodemailer SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({ from: sender, to, subject, html });
      console.log(`✅ [EmailService] Email sent via SMTP to ${to} (${info.messageId})`);
      return { success: true, method: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error('❌ [EmailService] SMTP send failed:', err.message);
      return { success: false, method: 'smtp_error', error: err.message };
    }
  }

  console.warn('[EmailService] No email provider configured (set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS)');
  return { success: false, method: 'email_not_configured' };
}

/**
 * Simple HTML escape for email content
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send cart recovery email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.tenantId - Tenant identifier
 * @param {Array} options.cart - Cart items [{name, price, quantity, image}]
 * @param {number} options.discount - Discount percentage
 * @param {string} options.language - Language code (fr/en/es/ar/ary)
 * @param {string} options.recoveryUrl - URL to recover the cart
 * @returns {Promise<{success: boolean, method: string, messageId?: string}>}
 */
async function sendCartRecoveryEmail({ to, tenantId, cart, discount, language, recoveryUrl }) {
  const lang = language || 'fr';
  const isRtl = lang === 'ar' || lang === 'ary';

  const subjects = {
    fr: 'Votre panier vous attend !',
    en: 'Your cart is waiting for you!',
    es: '¡Tu carrito te espera!',
    ar: 'سلة التسوق بانتظارك!',
    ary: 'لباني ديالك كيتسناك!'
  };

  const subject = subjects[lang] || subjects.fr;

  const cartItemsHtml = (cart || []).map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" width="50" height="50" style="border-radius: 6px; object-fit: cover;">` : ''}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${escapeHtml(item.name || '')}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${parseInt(item.quantity, 10) || 1}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${escapeHtml(String(item.price || ''))}</td>
    </tr>
  `).join('');

  const discountBlock = discount > 0 ? `
    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #059669;">
        ${lang === 'fr' ? `${discount}% de réduction vous attend !` :
          lang === 'en' ? `${discount}% discount waiting for you!` :
          lang === 'es' ? `¡${discount}% de descuento te espera!` :
          `${discount}% تخفيض بانتظارك!`}
      </p>
    </div>
  ` : '';

  const ctaText = {
    fr: 'Récupérer mon panier',
    en: 'Recover my cart',
    es: 'Recuperar mi carrito',
    ar: 'استعادة سلتي',
    ary: 'رجع لباني ديالي'
  }[lang] || 'Récupérer mon panier';

  const html = `
<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #5E6AD2, #4f46e5); padding: 30px; text-align: center;">
        <h1 style="margin: 0; color: white; font-size: 24px;">${subject}</h1>
      </div>
      <div style="padding: 30px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;"></th>
              <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">${lang === 'fr' ? 'Produit' : lang === 'en' ? 'Product' : 'Producto'}</th>
              <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">${lang === 'fr' ? 'Qté' : 'Qty'}</th>
              <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">${lang === 'fr' ? 'Prix' : 'Price'}</th>
            </tr>
          </thead>
          <tbody>${cartItemsHtml}</tbody>
        </table>
        ${discountBlock}
        <div style="text-align: center; margin-top: 30px;">
          <a href="${escapeHtml(recoveryUrl || '#')}" style="display: inline-block; padding: 14px 32px; background: #5E6AD2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ${ctaText}
          </a>
        </div>
      </div>
      <div style="padding: 20px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af;">
        <p>Powered by <a href="https://vocalia.ma" style="color: #5E6AD2; text-decoration: none;">VocalIA</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({ to, subject, html });
}

/**
 * Send email verification link
 */
async function sendVerificationEmail(email, token, name = '') {
  const baseUrl = ENV.APP_URL || 'https://vocalia.ma';
  const verifyUrl = `${baseUrl}/app/auth/verify-email.html?token=${encodeURIComponent(token)}`;

  return sendEmail({
    to: email,
    subject: 'Vérifiez votre email — VocalIA',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #5E6AD2;">Bienvenue sur VocalIA${name ? ', ' + escapeHtml(name) : ''} !</h2>
        <p>Cliquez sur le bouton ci-dessous pour vérifier votre adresse email :</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #5E6AD2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Vérifier mon email
        </a>
        <p style="color: #71717a; font-size: 14px;">Ce lien expire dans 24 heures.</p>
        <p style="color: #71717a; font-size: 12px;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
      </div>
    `
  });
}

/**
 * Send password reset link
 */
async function sendPasswordResetEmail(email, token, name = '') {
  const baseUrl = ENV.APP_URL || 'https://vocalia.ma';
  const resetUrl = `${baseUrl}/app/auth/forgot-password.html?token=${encodeURIComponent(token)}`;

  return sendEmail({
    to: email,
    subject: 'Réinitialisation de mot de passe — VocalIA',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #5E6AD2;">Réinitialisation de mot de passe</h2>
        <p>${name ? escapeHtml(name) + ', v' : 'V'}ous avez demandé une réinitialisation de mot de passe.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #5E6AD2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Réinitialiser mon mot de passe
        </a>
        <p style="color: #71717a; font-size: 14px;">Ce lien expire dans 6 heures.</p>
        <p style="color: #71717a; font-size: 12px;">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
      </div>
    `
  });
}

/**
 * Send transactional email (generic — welcome, invoice, notification)
 * @param {Object} opts
 * @param {string} opts.to - Recipient email
 * @param {string} opts.subject - Email subject
 * @param {string} opts.template - Template name: 'welcome', 'invoice', 'notification'
 * @param {Object} opts.data - Template data
 * @param {string} [opts.language] - Language code (fr/en/es/ar/ary)
 * @returns {Promise<{success: boolean, method: string, messageId?: string}>}
 */
async function sendTransactionalEmail({ to, subject, template, data = {}, language = 'fr' }) {
  const lang = language;
  const isRtl = lang === 'ar' || lang === 'ary';

  let body = '';

  switch (template) {
    case 'welcome':
      body = `
        <h2 style="color: #5E6AD2;">${lang === 'fr' ? 'Bienvenue sur VocalIA' : lang === 'en' ? 'Welcome to VocalIA' : lang === 'es' ? 'Bienvenido a VocalIA' : 'مرحبا بك في VocalIA'}${data.name ? ', ' + escapeHtml(data.name) : ''} !</h2>
        <p>${lang === 'fr' ? 'Votre compte est prêt. Commencez à configurer votre agent vocal.' : lang === 'en' ? 'Your account is ready. Start configuring your voice agent.' : 'Tu cuenta está lista. Comienza a configurar tu agente vocal.'}</p>
        <a href="${escapeHtml(data.dashboardUrl || 'https://vocalia.ma/app/client/dashboard.html')}" style="display: inline-block; background: #5E6AD2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          ${lang === 'fr' ? 'Accéder au dashboard' : lang === 'en' ? 'Go to dashboard' : 'Ir al panel'}
        </a>`;
      break;

    case 'invoice':
      body = `
        <h2 style="color: #5E6AD2;">${lang === 'fr' ? 'Facture VocalIA' : 'VocalIA Invoice'} #${escapeHtml(data.invoiceId || '')}</h2>
        <p>${lang === 'fr' ? 'Montant' : 'Amount'}: <strong>${escapeHtml(data.amount || '')}</strong></p>
        <p>${lang === 'fr' ? 'Période' : 'Period'}: ${escapeHtml(data.period || '')}</p>
        ${data.invoiceUrl ? `<a href="${escapeHtml(data.invoiceUrl)}" style="display: inline-block; background: #5E6AD2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">${lang === 'fr' ? 'Voir la facture' : 'View invoice'}</a>` : ''}`;
      break;

    default:
      body = `<p>${escapeHtml(data.message || '')}</p>`;
  }

  const html = `
<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb;">
  <div style="max-width: 500px; margin: 0 auto; padding: 32px;">
    ${body}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      <a href="https://vocalia.ma" style="color: #5E6AD2; text-decoration: none;">VocalIA</a> — Voice AI Platform
    </p>
  </div>
</body>
</html>`;

  return sendEmail({ to, subject, html });
}

module.exports = {
  sendEmail,
  sendCartRecoveryEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail,
  getTransporter
};
