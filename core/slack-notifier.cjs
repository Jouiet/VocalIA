'use strict';
/**
 * Slack Notifier — Internal notifications + per-tenant bot messaging
 *
 * Env vars:
 * - SLACK_BOT_TOKEN — Bot token for VocalIA internal workspace
 * - SLACK_NOTIFICATION_CHANNEL — Channel ID for internal alerts (e.g. #vocalia-alerts)
 *
 * @module slack-notifier
 * @version 1.0.0
 */

const SLACK_API = 'https://slack.com/api/chat.postMessage';

/**
 * Escape Slack mrkdwn special characters to prevent injection
 * Slack uses &amp; &lt; &gt; for escaping (same as HTML entities)
 */
function escapeSlack(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Send a message to a Slack channel
 */
async function sendMessage(text, channel, blocks) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !channel) return;

  const body = { channel, text };
  if (blocks) body.blocks = blocks;

  await fetch(SLACK_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).catch(() => {}); // fire-and-forget
}

/**
 * Send a message using a tenant's own bot token
 */
async function sendToTenant(botToken, channel, text, blocks) {
  if (!botToken || !channel) return;

  const body = { channel, text };
  if (blocks) body.blocks = blocks;

  await fetch(SLACK_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).catch(() => {}); // fire-and-forget
}

/**
 * Notify internal team of a new signup
 */
function notifySignup({ email, name, plan, tenantId }) {
  const channel = process.env.SLACK_NOTIFICATION_CHANNEL;
  if (!channel) return;

  const text = `*Nouveau signup* :tada:\n>*${escapeSlack(name || email)}* (${escapeSlack(email)})\n>Plan: \`${escapeSlack(plan || 'starter')}\` | Tenant: \`${escapeSlack(tenantId)}\``;
  sendMessage(text, channel).catch(() => {});
}

/**
 * Notify internal team of a critical/high error
 */
function notifyError({ component, error, severity, tenantId }) {
  const channel = process.env.SLACK_NOTIFICATION_CHANNEL;
  if (!channel) return;

  const emoji = severity === 'critical' ? ':rotating_light:' : ':warning:';
  const text = `${emoji} *${escapeSlack(severity).toUpperCase()}*: ${escapeSlack(component)}\n>\`${escapeSlack(error)}\`\n>Tenant: \`${escapeSlack(tenantId || 'unknown')}\``;
  sendMessage(text, channel).catch(() => {});
}

/**
 * Notify internal team of a payment event
 */
function notifyPayment({ tenantId, amount, plan, action }) {
  const channel = process.env.SLACK_NOTIFICATION_CHANNEL;
  if (!channel) return;

  const text = `*Paiement* :moneybag:\n>Tenant: \`${escapeSlack(tenantId)}\` | Plan: \`${escapeSlack(plan || '?')}\`${amount ? ` | ${escapeSlack(amount)}` : ''}\n>Action: ${escapeSlack(action || 'payment')}`;
  sendMessage(text, channel).catch(() => {});
}

module.exports = {
  sendMessage,
  sendToTenant,
  notifySignup,
  notifyError,
  notifyPayment,
  escapeSlack
};
