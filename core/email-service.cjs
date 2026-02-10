'use strict';

/**
 * VocalIA Email Service
 *
 * Handles cart recovery emails via SMTP (nodemailer).
 * Falls back gracefully if nodemailer is not installed.
 *
 * Required env vars for SMTP:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * @version 1.0.0
 * Session 250.153
 */

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  console.warn('[EmailService] nodemailer not installed — email features disabled. Run: npm install nodemailer');
}

const ENV = process.env;

// Lazy-initialized transporter
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!nodemailer) return null;

  const host = ENV.SMTP_HOST;
  const port = parseInt(ENV.SMTP_PORT || '587', 10);
  const user = ENV.SMTP_USER;
  const pass = ENV.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[EmailService] SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
    return null;
  }

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
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, method: 'email_not_configured' };
  }

  const from = ENV.SMTP_FROM || ENV.SMTP_USER;
  const lang = language || 'fr';

  // i18n subject lines
  const subjects = {
    fr: 'Votre panier vous attend !',
    en: 'Your cart is waiting for you!',
    es: '¡Tu carrito te espera!',
    ar: 'سلة التسوق بانتظارك!',
    ary: 'لباني ديالك كيتسناك!'
  };

  const subject = subjects[lang] || subjects.fr;

  // Build cart items HTML
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
<html dir="${lang === 'ar' || lang === 'ary' ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #5E6AD2, #4f46e5); padding: 30px; text-align: center;">
        <h1 style="margin: 0; color: white; font-size: 24px;">${subject}</h1>
      </div>
      <!-- Cart items -->
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
        <!-- CTA -->
        <div style="text-align: center; margin-top: 30px;">
          <a href="${escapeHtml(recoveryUrl || '#')}" style="display: inline-block; padding: 14px 32px; background: #5E6AD2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ${ctaText}
          </a>
        </div>
      </div>
      <!-- Footer -->
      <div style="padding: 20px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af;">
        <p>Powered by <a href="https://vocalia.ma" style="color: #5E6AD2; text-decoration: none;">VocalIA</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: `VocalIA <${from}>`,
      to,
      subject,
      html
    });
    console.log(`✅ [EmailService] Cart recovery email sent to ${to} (${info.messageId})`);
    return { success: true, method: 'email', messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [EmailService] Send failed:`, err.message);
    return { success: false, method: 'email_error', error: err.message };
  }
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
 * Send email verification link
 */
async function sendVerificationEmail(email, token, name = '') {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[EmailService] Cannot send verification email — SMTP not configured');
    return false;
  }

  const baseUrl = ENV.APP_URL || 'https://vocalia.ma';
  const verifyUrl = `${baseUrl}/app/auth/verify-email.html?token=${encodeURIComponent(token)}`;

  try {
    await transporter.sendMail({
      from: ENV.SMTP_FROM || 'VocalIA <no-reply@vocalia.ma>',
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
    return true;
  } catch (err) {
    console.error('❌ [EmailService] Verification email failed:', err.message);
    return false;
  }
}

/**
 * Send password reset link
 */
async function sendPasswordResetEmail(email, token, name = '') {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[EmailService] Cannot send reset email — SMTP not configured');
    return false;
  }

  const baseUrl = ENV.APP_URL || 'https://vocalia.ma';
  const resetUrl = `${baseUrl}/app/auth/forgot-password.html?token=${encodeURIComponent(token)}`;

  try {
    await transporter.sendMail({
      from: ENV.SMTP_FROM || 'VocalIA <no-reply@vocalia.ma>',
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
    return true;
  } catch (err) {
    console.error('❌ [EmailService] Password reset email failed:', err.message);
    return false;
  }
}

module.exports = {
  sendCartRecoveryEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  getTransporter
};
