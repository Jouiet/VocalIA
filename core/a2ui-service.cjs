#!/usr/bin/env node
/**
 * A2UI Service - Agent-to-UI Pipeline
 * VocalIA - Session 250.39
 *
 * Implements the complete A2UI pipeline:
 * Agent Context → Stitch API → Widget DOM → User → AG-UI Events
 *
 * Protocol: A2UI (Agent-to-UI) - Google Standard
 * Source: https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/
 *
 * Usage:
 *   const A2UIService = require('./a2ui-service.cjs');
 *   const ui = await A2UIService.generateUI({ type: 'booking', context: {...} });
 */

const { execSync } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

// Optional DOMPurify import (falls back to basic sanitization if not available)
let DOMPurify = null;
try {
  DOMPurify = require('isomorphic-dompurify');
} catch (e) {
  // DOMPurify not installed - will use basic sanitization fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const STITCH_CONFIG = '/Users/mac/.stitch-mcp/config';
const GCLOUD_PATH = '/Users/mac/.stitch-mcp/google-cloud-sdk/bin/gcloud';
const QUOTA_PROJECT = 'gen-lang-client-0843127575';
const BASE_URL = 'stitch.googleapis.com';
const MCP_PATH = '/mcp';

// A2UI Component Templates (fallback when Stitch unavailable)
const COMPONENT_TEMPLATES = {
  booking: {
    name: 'DatePicker',
    html: `
      <div class="va-a2ui-booking" data-a2ui-component="booking">
        <h4 class="va-a2ui-title">{{title}}</h4>
        <div class="va-a2ui-date-grid">
          {{#slots}}
          <button class="va-a2ui-slot" data-slot="{{value}}" data-a2ui-action="select_slot">
            {{label}}
          </button>
          {{/slots}}
        </div>
        <button class="va-a2ui-confirm" data-a2ui-action="confirm_booking" disabled>
          Confirmer
        </button>
      </div>
    `,
    css: `
      .va-a2ui-booking { padding: 12px; background: rgba(30,41,59,0.95); border-radius: 12px; }
      .va-a2ui-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #fff; }
      .va-a2ui-date-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
      .va-a2ui-slot { padding: 8px; background: rgba(94,106,210,0.2); border: 1px solid rgba(94,106,210,0.3); border-radius: 8px; color: #a5b4fc; font-size: 12px; cursor: pointer; transition: all 0.2s; }
      .va-a2ui-slot:hover { background: rgba(94,106,210,0.4); transform: translateY(-1px); }
      .va-a2ui-slot.selected { background: #5e6ad2; color: #fff; border-color: #5e6ad2; }
      .va-a2ui-confirm { width: 100%; padding: 10px; background: #10b981; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; transition: all 0.2s; }
      .va-a2ui-confirm:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
      .va-a2ui-confirm:not(:disabled):hover { background: #059669; }
    `
  },
  lead_form: {
    name: 'LeadForm',
    html: `
      <div class="va-a2ui-lead-form" data-a2ui-component="lead_form">
        <h4 class="va-a2ui-title">{{title}}</h4>
        <form class="va-a2ui-form" data-a2ui-action="submit_lead">
          {{#fields}}
          <div class="va-a2ui-field">
            <label>{{label}}</label>
            <input type="{{type}}" name="{{name}}" placeholder="{{placeholder}}" {{#required}}required{{/required}}>
          </div>
          {{/fields}}
          <button type="submit" class="va-a2ui-submit">Envoyer</button>
        </form>
      </div>
    `,
    css: `
      .va-a2ui-lead-form { padding: 12px; background: rgba(30,41,59,0.95); border-radius: 12px; }
      .va-a2ui-form { display: flex; flex-direction: column; gap: 10px; }
      .va-a2ui-field label { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
      .va-a2ui-field input { width: 100%; padding: 8px 10px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.2); border-radius: 6px; color: #fff; font-size: 13px; }
      .va-a2ui-field input:focus { outline: none; border-color: #5e6ad2; }
      .va-a2ui-submit { padding: 10px; background: #5e6ad2; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; }
      .va-a2ui-submit:hover { background: #4f5bc7; }
    `
  },
  cart: {
    name: 'CartPreview',
    html: `
      <div class="va-a2ui-cart" data-a2ui-component="cart">
        <h4 class="va-a2ui-title">{{title}}</h4>
        <div class="va-a2ui-items">
          {{#items}}
          <div class="va-a2ui-item" data-product-id="{{id}}">
            <span class="va-a2ui-item-name">{{name}}</span>
            <span class="va-a2ui-item-qty">x{{qty}}</span>
            <span class="va-a2ui-item-price">{{price}}</span>
          </div>
          {{/items}}
        </div>
        <div class="va-a2ui-total">
          <span>Total:</span>
          <span class="va-a2ui-total-value">{{total}}</span>
        </div>
        <button class="va-a2ui-checkout" data-a2ui-action="checkout">
          Payer maintenant
        </button>
      </div>
    `,
    css: `
      .va-a2ui-cart { padding: 12px; background: rgba(30,41,59,0.95); border-radius: 12px; }
      .va-a2ui-items { margin: 10px 0; }
      .va-a2ui-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(148,163,184,0.1); font-size: 12px; }
      .va-a2ui-item-name { color: #fff; flex: 1; }
      .va-a2ui-item-qty { color: #94a3b8; margin: 0 8px; }
      .va-a2ui-item-price { color: #10b981; font-weight: 600; }
      .va-a2ui-total { display: flex; justify-content: space-between; padding: 10px 0; font-weight: 600; }
      .va-a2ui-total-value { color: #10b981; font-size: 16px; }
      .va-a2ui-checkout { width: 100%; padding: 10px; background: #10b981; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; }
      .va-a2ui-checkout:hover { background: #059669; }
    `
  },
  confirmation: {
    name: 'Confirmation',
    html: `
      <div class="va-a2ui-confirmation" data-a2ui-component="confirmation">
        <div class="va-a2ui-icon">{{icon}}</div>
        <h4 class="va-a2ui-title">{{title}}</h4>
        <p class="va-a2ui-message">{{message}}</p>
        {{#details}}
        <div class="va-a2ui-details">
          {{#items}}
          <div class="va-a2ui-detail-row">
            <span>{{label}}:</span>
            <span>{{value}}</span>
          </div>
          {{/items}}
        </div>
        {{/details}}
        <button class="va-a2ui-close" data-a2ui-action="close">OK</button>
      </div>
    `,
    css: `
      .va-a2ui-confirmation { padding: 16px; background: rgba(30,41,59,0.95); border-radius: 12px; text-align: center; }
      .va-a2ui-icon { font-size: 32px; margin-bottom: 8px; }
      .va-a2ui-message { font-size: 13px; color: #94a3b8; margin: 8px 0; }
      .va-a2ui-details { background: rgba(15,23,42,0.5); border-radius: 8px; padding: 10px; margin: 12px 0; text-align: left; }
      .va-a2ui-detail-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; }
      .va-a2ui-detail-row span:first-child { color: #94a3b8; }
      .va-a2ui-detail-row span:last-child { color: #fff; font-weight: 500; }
      .va-a2ui-close { margin-top: 12px; padding: 8px 24px; background: #5e6ad2; border: none; border-radius: 8px; color: #fff; cursor: pointer; }
    `
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STITCH API INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────
function getAccessToken() {
  try {
    const token = execSync(
      `CLOUDSDK_CONFIG="${STITCH_CONFIG}" ${GCLOUD_PATH} auth application-default print-access-token 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    return token;
  } catch (e) {
    console.warn('[A2UI] Stitch auth failed, using templates:', e.message);
    return null;
  }
}

function mcpRequest(method, args = {}) {
  return new Promise((resolve, reject) => {
    const token = getAccessToken();
    if (!token) {
      reject(new Error('No Stitch access token'));
      return;
    }

    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: method, arguments: args },
      id: Date.now()
    });

    const options = {
      hostname: BASE_URL,
      port: 443,
      path: MCP_PATH,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-goog-user-project': QUOTA_PROJECT,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          } else {
            resolve(parsed.result);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Stitch API timeout')));
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE ENGINE (Mustache-lite)
// ─────────────────────────────────────────────────────────────────────────────
function renderTemplate(template, data) {
  let result = template;

  // Handle sections {{#section}}...{{/section}}
  const sectionRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(sectionRegex, (match, key, content) => {
    const value = data[key];
    if (!value) return '';
    if (Array.isArray(value)) {
      return value.map(item => renderTemplate(content, item)).join('');
    }
    if (typeof value === 'object') {
      return renderTemplate(content, value);
    }
    return value ? content : '';
  });

  // Handle variables {{variable}}
  const varRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(varRegex, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : '';
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// A2UI SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────
class A2UIService {
  constructor() {
    this.stitchEnabled = false;
    this.projectId = null;
    this.cache = new Map(); // Cache generated UIs
    this.maxCacheSize = 200;
  }

  /**
   * Initialize Stitch connection
   */
  async initialize() {
    try {
      const token = getAccessToken();
      if (token) {
        this.stitchEnabled = true;
        console.log('[A2UI] Stitch API connected');
      }
    } catch (e) {
      console.warn('[A2UI] Stitch not available, using templates');
    }
    return this;
  }

  /**
   * Generate UI component based on context
   * @param {Object} options - Generation options
   * @param {string} options.type - Component type: booking, lead_form, cart, confirmation
   * @param {Object} options.context - Context data for generation
   * @param {string} options.language - UI language (fr, en, ar, etc.)
   * @param {boolean} options.useStitch - Force Stitch generation (default: false for speed)
   * @returns {Object} Generated UI with html, css, actions
   */
  async generateUI({ type, context = {}, language = 'fr', useStitch = false }) {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${type}_${language}_${JSON.stringify(context)}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return { ...cached, cached: true, latency: Date.now() - startTime };
    }

    let result;

    if (useStitch && this.stitchEnabled) {
      result = await this.generateWithStitch(type, context, language);
    } else {
      result = this.generateFromTemplate(type, context, language);
    }

    // Sanitize HTML
    result.html = this.sanitizeHTML(result.html);

    // Cache result (bounded)
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);

    return {
      ...result,
      cached: false,
      latency: Date.now() - startTime
    };
  }

  /**
   * Generate UI using Stitch API (Gemini 3)
   */
  async generateWithStitch(type, context, language) {
    const prompt = this.buildStitchPrompt(type, context, language);

    try {
      const result = await mcpRequest('generate_screen_from_text', {
        projectId: this.projectId || 'vocalia-a2ui',
        prompt,
        deviceType: 'DESKTOP',
        modelId: 'GEMINI_3_FLASH'
      });

      if (result?.structuredContent?.outputComponents?.[0]?.design?.screens?.[0]) {
        const screen = result.structuredContent.outputComponents[0].design.screens[0];
        return {
          html: await this.fetchStitchHTML(screen.htmlCode?.downloadUrl),
          css: '',
          type,
          source: 'stitch',
          actions: this.extractActions(type)
        };
      }
    } catch (e) {
      console.warn('[A2UI] Stitch generation failed, falling back to template:', e.message);
    }

    // Fallback to template
    return this.generateFromTemplate(type, context, language);
  }

  /**
   * Generate UI from pre-built templates (fast path)
   */
  generateFromTemplate(type, context, language) {
    const template = COMPONENT_TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown component type: ${type}`);
    }

    // Add language-specific labels
    const localizedContext = this.localizeContext(context, type, language);

    return {
      html: renderTemplate(template.html, localizedContext),
      css: template.css,
      type,
      source: 'template',
      actions: this.extractActions(type)
    };
  }

  /**
   * Localize context data
   */
  localizeContext(context, type, language) {
    const labels = {
      fr: {
        booking: { title: 'Choisissez un créneau', confirm: 'Confirmer' },
        lead_form: { title: 'Complétez vos informations', submit: 'Envoyer' },
        cart: { title: 'Votre panier', checkout: 'Payer maintenant', total: 'Total' },
        confirmation: { title: 'Confirmé !', close: 'OK' }
      },
      en: {
        booking: { title: 'Choose a time slot', confirm: 'Confirm' },
        lead_form: { title: 'Complete your information', submit: 'Submit' },
        cart: { title: 'Your cart', checkout: 'Pay now', total: 'Total' },
        confirmation: { title: 'Confirmed!', close: 'OK' }
      },
      ar: {
        booking: { title: 'اختر موعداً', confirm: 'تأكيد' },
        lead_form: { title: 'أكمل معلوماتك', submit: 'إرسال' },
        cart: { title: 'سلتك', checkout: 'ادفع الآن', total: 'المجموع' },
        confirmation: { title: 'تم التأكيد!', close: 'موافق' }
      }
    };

    const langLabels = labels[language] || labels.fr;
    const typeLabels = langLabels[type] || {};

    return {
      ...typeLabels,
      ...context
    };
  }

  /**
   * Extract AG-UI actions for a component type
   */
  extractActions(type) {
    const actionMap = {
      booking: ['select_slot', 'confirm_booking'],
      lead_form: ['submit_lead', 'field_change'],
      cart: ['update_qty', 'remove_item', 'checkout'],
      confirmation: ['close']
    };
    return actionMap[type] || [];
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  sanitizeHTML(html) {
    // Use DOMPurify if available
    if (DOMPurify && DOMPurify.sanitize) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['div', 'span', 'button', 'input', 'form', 'label', 'h4', 'p'],
        ALLOWED_ATTR: ['class', 'data-a2ui-component', 'data-a2ui-action', 'data-slot', 'data-product-id', 'type', 'name', 'placeholder', 'required', 'disabled']
      });
    }

    // Basic sanitization fallback
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }

  /**
   * Build Stitch prompt for UI generation
   */
  buildStitchPrompt(type, context, language) {
    const prompts = {
      booking: `Create a minimal, dark-themed date/time picker component for booking appointments.
        Style: VocalIA brand (dark slate background #1e293b, indigo accent #5e6ad2, emerald confirm #10b981).
        Show ${context.slots?.length || 6} time slots in a grid layout.
        Include a "Confirm" button that's disabled until a slot is selected.
        Language: ${language}. Component only, no page chrome.`,
      lead_form: `Create a compact lead capture form with fields: ${context.fields?.map(f => f.name).join(', ') || 'name, email, phone'}.
        Style: VocalIA dark theme (#1e293b), indigo submit button.
        Mobile-friendly, single column. Language: ${language}.`,
      cart: `Create a mini shopping cart preview showing ${context.items?.length || 3} items.
        Show item name, quantity, price. Total at bottom.
        "Pay now" CTA button in emerald green.
        VocalIA dark theme. Language: ${language}.`,
      confirmation: `Create a success confirmation card.
        Icon: checkmark. Message: "${context.message || 'Votre demande a été enregistrée.'}".
        VocalIA dark theme, emerald accent for success.`
    };
    return prompts[type] || prompts.confirmation;
  }

  /**
   * Fetch HTML from Stitch download URL
   */
  async fetchStitchHTML(url) {
    if (!url) return '';
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  /**
   * Health check
   */
  async health() {
    return {
      service: 'A2UI',
      version: '1.0.0',
      stitchEnabled: this.stitchEnabled,
      templatesAvailable: Object.keys(COMPONENT_TEMPLATES),
      cacheSize: this.cache.size
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────
const a2uiService = new A2UIService();

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    a2uiService.initialize().then(() => {
      console.log(JSON.stringify(a2uiService.health(), null, 2));
    });
  } else if (args.includes('--test')) {
    a2uiService.initialize().then(async () => {
      const testUI = await a2uiService.generateUI({
        type: 'booking',
        context: {
          slots: [
            { value: '2026-02-01T10:00', label: 'Lun 10h' },
            { value: '2026-02-01T14:00', label: 'Lun 14h' },
            { value: '2026-02-02T10:00', label: 'Mar 10h' }
          ]
        },
        language: 'fr'
      });
      console.log('Generated UI:');
      console.log(JSON.stringify(testUI, null, 2));
    });
  } else {
    console.log(`
A2UI Service - Agent-to-UI Pipeline
====================================
Usage:
  node a2ui-service.cjs --health    # Check service status
  node a2ui-service.cjs --test      # Generate test UI

Programmatic:
  const A2UI = require('./a2ui-service.cjs');
  const ui = await A2UI.generateUI({ type: 'booking', context: {...} });
    `);
  }
}

module.exports = a2uiService;
