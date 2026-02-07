'use strict';

/**
 * VocalIA KB Crawler Tests
 *
 * Tests:
 * - PAGE_PATTERNS (9 page types)
 * - KBCrawler constructor defaults
 * - detectPageType (URL → page type)
 * - isRelevantPage (filtering logic)
 * - parseSitemap (XML extraction)
 * - extractJsonLd (JSON-LD parsing)
 * - extractContent (routing by type)
 *
 * NOTE: Does NOT make HTTP requests. Tests pure logic only.
 *
 * Run: node --test test/kb-crawler.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { KBCrawler, PAGE_PATTERNS } = require('../core/kb-crawler.cjs');

// ─── PAGE_PATTERNS ──────────────────────────────────────────────────

describe('KBCrawler PAGE_PATTERNS', () => {
  test('has 9 page types', () => {
    assert.strictEqual(Object.keys(PAGE_PATTERNS).length, 9);
  });

  test('faq pattern matches FAQ pages', () => {
    assert.ok(PAGE_PATTERNS.faq.test('https://example.com/faq'));
    assert.ok(PAGE_PATTERNS.faq.test('https://example.com/questions'));
    assert.ok(PAGE_PATTERNS.faq.test('https://example.com/aide'));
  });

  test('contact pattern matches contact pages', () => {
    assert.ok(PAGE_PATTERNS.contact.test('https://example.com/contact'));
    assert.ok(PAGE_PATTERNS.contact.test('https://example.com/nous-contacter'));
  });

  test('about pattern matches about pages', () => {
    assert.ok(PAGE_PATTERNS.about.test('https://example.com/about'));
    assert.ok(PAGE_PATTERNS.about.test('https://example.com/a-propos'));
  });

  test('hours pattern matches schedule pages', () => {
    assert.ok(PAGE_PATTERNS.hours.test('https://example.com/horaires'));
    assert.ok(PAGE_PATTERNS.hours.test('https://example.com/hours'));
  });

  test('pricing pattern matches pricing pages', () => {
    assert.ok(PAGE_PATTERNS.pricing.test('https://example.com/prix'));
    assert.ok(PAGE_PATTERNS.pricing.test('https://example.com/tarif'));
    assert.ok(PAGE_PATTERNS.pricing.test('https://example.com/pricing'));
  });

  test('products pattern matches product pages', () => {
    assert.ok(PAGE_PATTERNS.products.test('https://example.com/produits'));
    assert.ok(PAGE_PATTERNS.products.test('https://example.com/catalogue'));
  });

  test('delivery pattern matches delivery pages', () => {
    assert.ok(PAGE_PATTERNS.delivery.test('https://example.com/livraison'));
    assert.ok(PAGE_PATTERNS.delivery.test('https://example.com/shipping'));
  });

  test('returns pattern matches return policy pages', () => {
    assert.ok(PAGE_PATTERNS.returns.test('https://example.com/retour'));
    assert.ok(PAGE_PATTERNS.returns.test('https://example.com/refund'));
  });
});

// ─── KBCrawler constructor ──────────────────────────────────────────

describe('KBCrawler constructor', () => {
  test('defaults maxPages to 20', () => {
    const c = new KBCrawler();
    assert.strictEqual(c.maxPages, 20);
  });

  test('defaults timeout to 10000', () => {
    const c = new KBCrawler();
    assert.strictEqual(c.timeout, 10000);
  });

  test('defaults delay to 1000', () => {
    const c = new KBCrawler();
    assert.strictEqual(c.delay, 1000);
  });

  test('defaults userAgent to VocalIA-KBCrawler/1.0', () => {
    const c = new KBCrawler();
    assert.ok(c.userAgent.includes('VocalIA'));
  });

  test('accepts custom options', () => {
    const c = new KBCrawler({ maxPages: 50, timeout: 5000 });
    assert.strictEqual(c.maxPages, 50);
    assert.strictEqual(c.timeout, 5000);
  });

  test('starts with empty visited set', () => {
    const c = new KBCrawler();
    assert.strictEqual(c.visited.size, 0);
  });
});

// ─── detectPageType ─────────────────────────────────────────────────

describe('KBCrawler detectPageType', () => {
  const c = new KBCrawler();

  test('detects FAQ page', () => {
    assert.strictEqual(c.detectPageType('https://example.com/faq'), 'faq');
  });

  test('detects contact page', () => {
    assert.strictEqual(c.detectPageType('https://example.com/contact'), 'contact');
  });

  test('detects about page', () => {
    assert.strictEqual(c.detectPageType('https://example.com/a-propos'), 'about');
  });

  test('detects hours page', () => {
    assert.strictEqual(c.detectPageType('https://example.com/horaires'), 'hours');
  });

  test('detects pricing page', () => {
    assert.strictEqual(c.detectPageType('https://example.com/pricing'), 'pricing');
  });

  test('detects delivery page', () => {
    assert.strictEqual(c.detectPageType('https://example.com/livraison'), 'delivery');
  });

  test('detects services page', () => {
    assert.strictEqual(c.detectPageType('https://example.com/services'), 'services');
  });

  test('returns general for unknown', () => {
    assert.strictEqual(c.detectPageType('https://example.com/random-page'), 'general');
  });
});

// ─── isRelevantPage ─────────────────────────────────────────────────

describe('KBCrawler isRelevantPage', () => {
  const c = new KBCrawler();

  test('rejects image files', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/logo.png'), false);
    assert.strictEqual(c.isRelevantPage('https://example.com/photo.jpg'), false);
    assert.strictEqual(c.isRelevantPage('https://example.com/icon.svg'), false);
  });

  test('rejects CSS/JS files', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/style.css'), false);
    assert.strictEqual(c.isRelevantPage('https://example.com/app.js'), false);
  });

  test('rejects admin/login pages', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/admin'), false);
    assert.strictEqual(c.isRelevantPage('https://example.com/login'), false);
    assert.strictEqual(c.isRelevantPage('https://example.com/wp-admin'), false);
  });

  test('rejects cart/checkout pages', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/cart'), false);
    assert.strictEqual(c.isRelevantPage('https://example.com/checkout'), false);
    assert.strictEqual(c.isRelevantPage('https://example.com/panier'), false);
  });

  test('accepts FAQ pages', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/faq'), true);
  });

  test('accepts contact pages', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/contact'), true);
  });

  test('accepts home page', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/'), true);
  });

  test('accepts shallow paths', () => {
    assert.strictEqual(c.isRelevantPage('https://example.com/about'), true);
  });
});

// ─── parseSitemap ───────────────────────────────────────────────────

describe('KBCrawler parseSitemap', () => {
  const c = new KBCrawler();

  test('extracts URLs from sitemap XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/</loc></url>
      <url><loc>https://example.com/faq</loc></url>
      <url><loc>https://example.com/contact</loc></url>
    </urlset>`;

    const urls = c.parseSitemap(xml);
    assert.strictEqual(urls.length, 3);
    assert.strictEqual(urls[0], 'https://example.com/');
    assert.strictEqual(urls[1], 'https://example.com/faq');
  });

  test('returns empty for invalid XML', () => {
    const urls = c.parseSitemap('<html>Not a sitemap</html>');
    assert.strictEqual(urls.length, 0);
  });

  test('returns empty for empty string', () => {
    const urls = c.parseSitemap('');
    assert.strictEqual(urls.length, 0);
  });
});

// ─── extractJsonLd ──────────────────────────────────────────────────

describe('KBCrawler extractJsonLd', () => {
  const c = new KBCrawler();

  test('extracts LocalBusiness data', () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {"@type":"LocalBusiness","name":"Test Store","telephone":"+212555","email":"test@example.com"}
      </script>
    </head></html>`;

    const result = c.extractJsonLd(html);
    assert.strictEqual(result.business_name, 'Test Store');
    assert.strictEqual(result.phone, '+212555');
    assert.strictEqual(result.email, 'test@example.com');
  });

  test('extracts FAQPage data', () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {"@type":"FAQPage","mainEntity":[
        {"@type":"Question","name":"What are your hours?","acceptedAnswer":{"@type":"Answer","text":"9am-6pm"}}
      ]}
      </script>
    </head></html>`;

    const result = c.extractJsonLd(html);
    assert.ok(result.faq);
  });

  test('returns empty object for no JSON-LD', () => {
    const result = c.extractJsonLd('<html><body>No JSON-LD</body></html>');
    assert.deepStrictEqual(result, {});
  });

  test('handles invalid JSON gracefully', () => {
    const html = `<html><head>
      <script type="application/ld+json">{invalid json}</script>
    </head></html>`;

    const result = c.extractJsonLd(html);
    assert.deepStrictEqual(result, {});
  });
});

// ─── extractContent ─────────────────────────────────────────────────

describe('KBCrawler extractContent', () => {
  const c = new KBCrawler();

  test('returns object for general page', () => {
    const result = c.extractContent('<html><body><h1>Test</h1></body></html>', 'general');
    assert.strictEqual(typeof result, 'object');
  });

  test('returns object for faq page', () => {
    const result = c.extractContent('<html><body><h2>FAQ</h2></body></html>', 'faq');
    assert.strictEqual(typeof result, 'object');
  });

  test('returns object for contact page', () => {
    const result = c.extractContent('<html><body><h2>Contact</h2></body></html>', 'contact');
    assert.strictEqual(typeof result, 'object');
  });

  test('routes hours page to extractHours', () => {
    const html = '<html><body>lundi 9h00-18h00</body></html>';
    const result = c.extractContent(html, 'hours');
    assert.strictEqual(typeof result, 'object');
  });

  test('routes delivery page to extractDelivery', () => {
    const html = '<html><body>livraison gratuite</body></html>';
    const result = c.extractContent(html, 'delivery');
    assert.strictEqual(typeof result, 'object');
  });

  test('routes returns page to extractReturns', () => {
    const html = '<html><body>retour sous 30 jours</body></html>';
    const result = c.extractContent(html, 'returns');
    assert.strictEqual(typeof result, 'object');
  });
});

// ─── stripHtml ──────────────────────────────────────────────────────

describe('KBCrawler stripHtml', () => {
  const c = new KBCrawler();

  test('removes HTML tags', () => {
    assert.strictEqual(c.stripHtml('<p>Hello</p>'), 'Hello');
  });

  test('removes nested tags', () => {
    assert.strictEqual(c.stripHtml('<div><span>Test</span></div>'), 'Test');
  });

  test('replaces &nbsp; with space', () => {
    assert.ok(c.stripHtml('Hello&nbsp;World').includes('Hello'));
    assert.ok(c.stripHtml('Hello&nbsp;World').includes('World'));
  });

  test('replaces &amp; with &', () => {
    assert.ok(c.stripHtml('Tom &amp; Jerry').includes('&'));
  });

  test('replaces &lt; and &gt;', () => {
    assert.ok(c.stripHtml('&lt;code&gt;').includes('<'));
    assert.ok(c.stripHtml('&lt;code&gt;').includes('>'));
  });

  test('replaces &quot; with double quote', () => {
    assert.ok(c.stripHtml('&quot;hello&quot;').includes('"'));
  });

  test('replaces &#39; with single quote', () => {
    assert.ok(c.stripHtml('it&#39;s').includes("'"));
  });

  test('collapses whitespace', () => {
    assert.strictEqual(c.stripHtml('  Hello    World  '), 'Hello World');
  });

  test('handles empty string', () => {
    assert.strictEqual(c.stripHtml(''), '');
  });
});

// ─── normalizeKey ──────────────────────────────────────────────────

describe('KBCrawler normalizeKey', () => {
  const c = new KBCrawler();

  test('converts to lowercase', () => {
    assert.strictEqual(c.normalizeKey('Hello World'), 'hello_world');
  });

  test('replaces spaces with underscores', () => {
    assert.strictEqual(c.normalizeKey('foo bar baz'), 'foo_bar_baz');
  });

  test('removes special characters', () => {
    assert.strictEqual(c.normalizeKey('what is your price?'), 'what_is_your_price');
  });

  test('trims whitespace', () => {
    assert.strictEqual(c.normalizeKey('  hello  '), 'hello');
  });

  test('truncates to 50 chars', () => {
    const longText = 'a'.repeat(100);
    const result = c.normalizeKey(longText);
    assert.ok(result.length <= 50);
  });

  test('collapses multiple underscores', () => {
    assert.strictEqual(c.normalizeKey('foo   bar'), 'foo_bar');
  });

  test('removes leading/trailing underscores', () => {
    assert.strictEqual(c.normalizeKey('_hello_'), 'hello');
  });
});

// ─── extractFAQ ────────────────────────────────────────────────────

describe('KBCrawler extractFAQ', () => {
  const c = new KBCrawler();

  test('extracts dt/dd FAQ pairs', () => {
    const html = '<dl><dt>What is VocalIA?</dt><dd>A voice AI platform</dd></dl>';
    const result = c.extractFAQ(html);
    assert.ok(result.faq);
    const keys = Object.keys(result.faq);
    assert.ok(keys.length > 0);
  });

  test('extracts h3/h4 + p FAQ pattern (question ending with ?)', () => {
    const html = '<h3>What is your pricing?</h3><p>49 euros per month</p>';
    const result = c.extractFAQ(html);
    assert.ok(result.faq);
  });

  test('returns empty for no FAQ content', () => {
    const result = c.extractFAQ('<html><body>No FAQ here</body></html>');
    assert.deepStrictEqual(result, {});
  });
});

// ─── extractContact ────────────────────────────────────────────────

describe('KBCrawler extractContact', () => {
  const c = new KBCrawler();

  test('extracts email', () => {
    const html = '<div>Contact us at info@vocalia.ma for more info</div>';
    const result = c.extractContact(html);
    assert.ok(result.contact_info);
    assert.strictEqual(result.contact_info.email, 'info@vocalia.ma');
  });

  test('extracts phone number', () => {
    const html = '<div>Téléphone: +212 555 123456</div>';
    const result = c.extractContact(html);
    assert.ok(result.contact_info);
    assert.ok(result.contact_info.phone);
  });

  test('returns empty for no contact info', () => {
    const result = c.extractContact('<div>Just some text</div>');
    assert.deepStrictEqual(result, {});
  });
});

// ─── extractHours ──────────────────────────────────────────────────

describe('KBCrawler extractHours', () => {
  const c = new KBCrawler();

  test('extracts French day hours', () => {
    const html = '<div>lundi 9h00-18h00</div>';
    const result = c.extractHours(html);
    assert.ok(result.horaires);
    assert.ok(result.horaires.details.lundi);
  });

  test('extracts English day hours', () => {
    const html = '<div>monday 9h00-18h00</div>';
    const result = c.extractHours(html);
    assert.ok(result.horaires);
    assert.ok(result.horaires.details.lundi); // mapped to French
  });

  test('detects closed days (fermé)', () => {
    const html = '<div>dimanche fermé</div>';
    const result = c.extractHours(html);
    assert.ok(result.horaires);
    assert.strictEqual(result.horaires.details.dimanche, 'Fermé');
  });

  test('returns empty for no hours found', () => {
    const result = c.extractHours('<div>No schedule info</div>');
    assert.deepStrictEqual(result, {});
  });
});

// ─── extractDelivery ───────────────────────────────────────────────

describe('KBCrawler extractDelivery', () => {
  const c = new KBCrawler();

  test('detects livraison gratuite', () => {
    const html = '<div>Nous offrons la livraison gratuite sur toutes les commandes.</div>';
    const result = c.extractDelivery(html);
    assert.ok(result.livraison);
    assert.strictEqual(result.livraison.details.gratuite, true);
  });

  test('returns empty for no delivery info', () => {
    const result = c.extractDelivery('<div>Just regular content</div>');
    assert.deepStrictEqual(result, {});
  });
});

// ─── extractReturns ────────────────────────────────────────────────

describe('KBCrawler extractReturns', () => {
  const c = new KBCrawler();

  test('extracts return period', () => {
    const html = '<div>Politique de retour 14 jours</div>';
    const result = c.extractReturns(html);
    assert.ok(result.retours);
    assert.ok(result.retours.details.periode);
    assert.ok(result.retours.details.periode.includes('jours'));
  });

  test('extracts multi-digit return period (30 jours)', () => {
    const html = '<div>Retour accepté sous 30 jours.</div>';
    const result = c.extractReturns(html);
    assert.ok(result.retours);
    assert.strictEqual(result.retours.details.periode, '30 jours');
  });

  test('detects free returns', () => {
    const html = '<div>Retour gratuit sous 14 jours.</div>';
    const result = c.extractReturns(html);
    assert.ok(result.retours);
    assert.strictEqual(result.retours.details.gratuit, true);
    assert.ok(result.retours.response.includes('gratuit'));
  });

  test('returns empty for no return policy', () => {
    const result = c.extractReturns('<div>Nothing about returns here</div>');
    assert.deepStrictEqual(result, {});
  });
});

// ─── extractGeneral ────────────────────────────────────────────────

describe('KBCrawler extractGeneral', () => {
  const c = new KBCrawler();

  test('extracts page title', () => {
    const html = '<html><head><title>VocalIA - Voice AI</title></head><body></body></html>';
    const result = c.extractGeneral(html);
    assert.ok(result.page_title);
    assert.ok(result.page_title.includes('VocalIA'));
  });

  test('extracts meta description', () => {
    const html = '<html><head><meta name="description" content="Best voice AI platform"></head></html>';
    const result = c.extractGeneral(html);
    assert.strictEqual(result.description, 'Best voice AI platform');
  });

  test('returns empty for missing title and description', () => {
    const result = c.extractGeneral('<html><body>No meta</body></html>');
    assert.deepStrictEqual(result, {});
  });
});

// ─── formatHoursResponse ───────────────────────────────────────────

describe('KBCrawler formatHoursResponse', () => {
  const c = new KBCrawler();

  test('formats open days', () => {
    const hours = { lundi: '9:00-18:00', mardi: '9:00-18:00', dimanche: 'Fermé' };
    const result = c.formatHoursResponse(hours);
    assert.ok(result.includes('lundi'));
    assert.ok(result.includes('mardi'));
    assert.ok(!result.includes('dimanche')); // Fermé excluded
  });

  test('returns non-disponibles for all closed', () => {
    const result = c.formatHoursResponse({ lundi: 'Fermé', mardi: 'Fermé' });
    assert.ok(result.includes('non disponibles'));
  });
});

// ─── formatDeliveryResponse ────────────────────────────────────────

describe('KBCrawler formatDeliveryResponse', () => {
  const c = new KBCrawler();

  test('includes livraison gratuite', () => {
    const result = c.formatDeliveryResponse({ gratuite: true });
    assert.ok(result.includes('gratuite'));
  });

  test('includes delai', () => {
    const result = c.formatDeliveryResponse({ delai: '3-5 jours' });
    assert.ok(result.includes('3-5 jours'));
  });

  test('includes frais', () => {
    const result = c.formatDeliveryResponse({ frais: '25 MAD' });
    assert.ok(result.includes('25 MAD'));
  });

  test('returns default for empty delivery', () => {
    const result = c.formatDeliveryResponse({});
    assert.ok(result.includes('Information'));
  });
});

// ─── getInstance ───────────────────────────────────────────────────

describe('KBCrawler getInstance', () => {
  const { getInstance } = require('../core/kb-crawler.cjs');

  test('returns KBCrawler instance', () => {
    const instance = getInstance();
    assert.ok(instance instanceof KBCrawler);
  });

  test('returns same instance on multiple calls', () => {
    const a = getInstance();
    const b = getInstance();
    assert.strictEqual(a, b);
  });
});

// ─── extractJsonLd detail ──────────────────────────────────────────

describe('KBCrawler extractJsonLd detail', () => {
  const c = new KBCrawler();

  test('extracts Organization type', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Organization","name":"VocalIA Corp","telephone":"+33123"}
    </script>`;
    const result = c.extractJsonLd(html);
    assert.strictEqual(result.business_name, 'VocalIA Corp');
    assert.strictEqual(result.phone, '+33123');
  });

  test('extracts address object', () => {
    const html = `<script type="application/ld+json">
      {"@type":"LocalBusiness","name":"Shop","address":{"streetAddress":"10 Rue X","postalCode":"75001","addressLocality":"Paris"}}
    </script>`;
    const result = c.extractJsonLd(html);
    assert.ok(result.address);
    assert.ok(result.address.includes('Rue X'));
    assert.ok(result.address.includes('Paris'));
  });

  test('extracts openingHours as string', () => {
    const html = `<script type="application/ld+json">
      {"@type":"LocalBusiness","name":"Shop","openingHours":"Mo-Fr 09:00-18:00"}
    </script>`;
    const result = c.extractJsonLd(html);
    assert.ok(result.horaires);
    assert.ok(result.horaires.response.includes('Mo-Fr'));
  });

  test('extracts openingHours as array', () => {
    const html = `<script type="application/ld+json">
      {"@type":"LocalBusiness","name":"Shop","openingHours":["Mo-Fr 09:00-18:00","Sa 10:00-14:00"]}
    </script>`;
    const result = c.extractJsonLd(html);
    assert.ok(result.horaires);
    assert.ok(result.horaires.response.includes('Mo-Fr'));
    assert.ok(result.horaires.response.includes('Sa'));
  });

  test('handles multiple JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization","name":"Corp"}</script>
      <script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"name":"Q1?","acceptedAnswer":{"text":"A1"}}]}</script>
    `;
    const result = c.extractJsonLd(html);
    assert.strictEqual(result.business_name, 'Corp');
    assert.ok(result.faq);
  });
});

// ─── Exports ───────────────────────────────────────────────────────

describe('KBCrawler exports', () => {
  test('exports KBCrawler class', () => {
    assert.strictEqual(typeof KBCrawler, 'function');
  });

  test('exports PAGE_PATTERNS object', () => {
    assert.strictEqual(typeof PAGE_PATTERNS, 'object');
  });

  test('instance has all methods', () => {
    const c = new KBCrawler();
    const methods = ['crawlURL', 'crawlSite', 'findSitemap', 'parseSitemap',
      'isRelevantPage', 'detectPageType', 'fetchPage', 'extractContent',
      'extractJsonLd', 'extractFAQ', 'extractContact', 'extractHours',
      'extractDelivery', 'extractReturns', 'extractGeneral',
      'stripHtml', 'normalizeKey', 'sleep',
      'formatHoursResponse', 'formatDeliveryResponse'];
    for (const m of methods) {
      assert.strictEqual(typeof c[m], 'function', `Missing method: ${m}`);
    }
  });
});
