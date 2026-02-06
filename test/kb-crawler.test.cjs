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
});
