#!/usr/bin/env node
/**
 * VocalIA - Knowledge Base Web Crawler
 *
 * Crawl client websites to extract content for KB:
 * - FAQ pages
 * - Product pages
 * - Contact/About pages
 * - Pricing pages
 *
 * Supports:
 * - Single URL crawling
 * - Sitemap parsing
 * - Structured data extraction (JSON-LD, schema.org)
 * - Multiple page types detection
 *
 * Version: 1.0.0 | Session 250.45 | 02/02/2026
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Patterns to identify page types
const PAGE_PATTERNS = {
  faq: /\b(faq|questions?|aide|help|support)\b/i,
  contact: /\b(contact|nous-contacter|contactez|reach-us)\b/i,
  about: /\b(about|a-propos|qui-sommes|notre-histoire)\b/i,
  hours: /\b(horaires?|hours?|ouverture|opening)\b/i,
  delivery: /\b(livraison|delivery|shipping|expedition)\b/i,
  returns: /\b(retour|return|refund|remboursement)\b/i,
  pricing: /\b(prix|tarif|pricing|prices|rates)\b/i,
  services: /\b(services|prestations|offres)\b/i,
  products: /\b(produits?|products?|catalogue|catalog)\b/i
};

/**
 * Web Crawler for KB extraction
 */
class KBCrawler {
  constructor(options = {}) {
    this.maxPages = options.maxPages || 20;
    this.timeout = options.timeout || 10000;
    this.delay = options.delay || 1000; // Delay between requests
    this.userAgent = options.userAgent || 'VocalIA-KBCrawler/1.0';
    this.visited = new Set();
    this.results = {};
  }

  /**
   * Crawl a single URL
   * @param {string} url - URL to crawl
   * @returns {object} Extracted KB data
   */
  async crawlURL(url) {
    try {
      const html = await this.fetchPage(url);
      const pageType = this.detectPageType(url);
      const content = this.extractContent(html, pageType);

      return {
        url,
        pageType,
        content,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error(`[KBCrawler] Error crawling ${url}: ${e.message}`);
      return { url, error: e.message };
    }
  }

  /**
   * Crawl multiple URLs from a sitemap or list
   * @param {string} baseUrl - Base URL or sitemap URL
   * @param {object} options - Crawling options
   * @returns {object} KB data from all pages
   */
  async crawlSite(baseUrl, options = {}) {
    const urlObj = new URL(baseUrl);
    const baseHost = urlObj.hostname;

    // Try to find sitemap
    let urls = options.urls || [];

    if (urls.length === 0) {
      const sitemapUrls = await this.findSitemap(baseUrl);
      if (sitemapUrls.length > 0) {
        urls = sitemapUrls;
        console.log(`[KBCrawler] Found ${urls.length} URLs in sitemap`);
      } else {
        // Start with base URL and discover links
        urls = [baseUrl];
      }
    }

    // Filter relevant pages
    const relevantUrls = urls
      .filter(u => {
        try {
          const uObj = new URL(u);
          return uObj.hostname === baseHost;
        } catch (e) {
          return false;
        }
      })
      .filter(u => this.isRelevantPage(u))
      .slice(0, this.maxPages);

    console.log(`[KBCrawler] Crawling ${relevantUrls.length} relevant pages...`);

    // Crawl each URL
    const kbData = {};
    for (const url of relevantUrls) {
      if (this.visited.has(url)) continue;
      this.visited.add(url);

      console.log(`[KBCrawler] Crawling: ${url}`);
      const result = await this.crawlURL(url);

      if (result.content && Object.keys(result.content).length > 0) {
        for (const [key, value] of Object.entries(result.content)) {
          if (kbData[key]) {
            // Merge if key exists
            if (typeof kbData[key] === 'object' && typeof value === 'object') {
              kbData[key] = { ...kbData[key], ...value };
            }
          } else {
            kbData[key] = value;
          }
        }
      }

      // Delay between requests
      await this.sleep(this.delay);
    }

    // Add metadata
    kbData.__meta = {
      source: baseUrl,
      crawled_at: new Date().toISOString(),
      pages_crawled: this.visited.size,
      crawler_version: '1.0.0'
    };

    return kbData;
  }

  /**
   * Find sitemap URL and parse it
   */
  async findSitemap(baseUrl) {
    const urlObj = new URL(baseUrl);
    const sitemapUrls = [
      `${urlObj.origin}/sitemap.xml`,
      `${urlObj.origin}/sitemap_index.xml`,
      `${urlObj.origin}/sitemap-index.xml`
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const xml = await this.fetchPage(sitemapUrl);
        const urls = this.parseSitemap(xml);
        if (urls.length > 0) return urls;
      } catch (e) {
        // Try next
      }
    }

    return [];
  }

  /**
   * Parse sitemap XML
   */
  parseSitemap(xml) {
    const urls = [];
    const locRegex = /<loc>([^<]+)<\/loc>/g;
    let match;

    while ((match = locRegex.exec(xml)) !== null) {
      urls.push(match[1].trim());
    }

    return urls;
  }

  /**
   * Check if URL is relevant for KB extraction
   */
  isRelevantPage(url) {
    const urlLower = url.toLowerCase();

    // Skip media/asset files
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|css|js|woff|woff2|ttf|ico)$/i.test(url)) {
      return false;
    }

    // Skip admin/login/cart pages
    if (/\b(admin|login|cart|checkout|panier|compte|account|wp-admin)\b/i.test(url)) {
      return false;
    }

    // Check for relevant patterns
    for (const pattern of Object.values(PAGE_PATTERNS)) {
      if (pattern.test(urlLower)) return true;
    }

    // Include home page and main pages
    const path = new URL(url).pathname;
    if (path === '/' || path.split('/').filter(Boolean).length <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Detect page type from URL
   */
  detectPageType(url) {
    const urlLower = url.toLowerCase();

    for (const [type, pattern] of Object.entries(PAGE_PATTERNS)) {
      if (pattern.test(urlLower)) return type;
    }

    return 'general';
  }

  /**
   * Fetch page content
   */
  fetchPage(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr,en;q=0.5'
        }
      };

      const req = protocol.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          return resolve(this.fetchPage(redirectUrl));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Extract KB content from HTML
   */
  extractContent(html, pageType) {
    const content = {};

    // Extract structured data (JSON-LD)
    const jsonLdData = this.extractJsonLd(html);
    if (jsonLdData) {
      Object.assign(content, jsonLdData);
    }

    // Extract based on page type
    switch (pageType) {
      case 'faq':
        Object.assign(content, this.extractFAQ(html));
        break;
      case 'contact':
        Object.assign(content, this.extractContact(html));
        break;
      case 'hours':
        Object.assign(content, this.extractHours(html));
        break;
      case 'delivery':
        Object.assign(content, this.extractDelivery(html));
        break;
      case 'returns':
        Object.assign(content, this.extractReturns(html));
        break;
      default:
        Object.assign(content, this.extractGeneral(html));
    }

    return content;
  }

  /**
   * Extract JSON-LD structured data
   */
  extractJsonLd(html) {
    const result = {};
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const types = Array.isArray(data) ? data : [data];

        for (const item of types) {
          if (item['@type'] === 'FAQPage' && item.mainEntity) {
            result.faq = {};
            for (const q of item.mainEntity) {
              const key = this.normalizeKey(q.name);
              result.faq[key] = q.acceptedAnswer?.text || '';
            }
          }

          if (item['@type'] === 'LocalBusiness' || item['@type'] === 'Organization') {
            if (item.name) result.business_name = item.name;
            if (item.telephone) result.phone = item.telephone;
            if (item.email) result.email = item.email;
            if (item.address) {
              result.address = typeof item.address === 'object'
                ? `${item.address.streetAddress || ''}, ${item.address.postalCode || ''} ${item.address.addressLocality || ''}`
                : item.address;
            }
            if (item.openingHours) {
              result.horaires = { response: Array.isArray(item.openingHours) ? item.openingHours.join(', ') : item.openingHours };
            }
          }
        }
      } catch (e) {
        // Invalid JSON-LD, skip
      }
    }

    return result;
  }

  /**
   * Extract FAQ content
   */
  extractFAQ(html) {
    const faq = {};

    // Look for FAQ patterns in HTML
    // Pattern 1: <dt>Question</dt><dd>Answer</dd>
    const dlRegex = /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let match;
    while ((match = dlRegex.exec(html)) !== null) {
      const key = this.normalizeKey(this.stripHtml(match[1]));
      const value = this.stripHtml(match[2]);
      if (key && value) faq[key] = value;
    }

    // Pattern 2: Accordion with data-question/data-answer
    const accordionRegex = /data-question="([^"]+)"[\s\S]*?data-answer="([^"]+)"/gi;
    while ((match = accordionRegex.exec(html)) !== null) {
      const key = this.normalizeKey(match[1]);
      const value = match[2];
      if (key && value) faq[key] = value;
    }

    // Pattern 3: h3/h4 followed by p
    const headingRegex = /<h[34][^>]*>([^<]+)<\/h[34]>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = headingRegex.exec(html)) !== null) {
      const question = this.stripHtml(match[1]);
      if (question.endsWith('?')) {
        const key = this.normalizeKey(question);
        const value = this.stripHtml(match[2]);
        if (key && value) faq[key] = value;
      }
    }

    return Object.keys(faq).length > 0 ? { faq } : {};
  }

  /**
   * Extract contact information
   */
  extractContact(html) {
    const contact = {};

    // Phone
    const phoneMatch = html.match(/(?:tel:|phone:|téléphone)?\s*(\+?\d[\d\s\-\.]{8,})/i);
    if (phoneMatch) contact.phone = phoneMatch[1].replace(/[\s\-\.]/g, '');

    // Email
    const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) contact.email = emailMatch[1];

    // Address (common patterns)
    const addressMatch = html.match(/(?:adresse|address)[\s:]*([^<]{20,100})/i);
    if (addressMatch) contact.address = this.stripHtml(addressMatch[1]).trim();

    return Object.keys(contact).length > 0 ? { contact_info: contact } : {};
  }

  /**
   * Extract opening hours
   */
  extractHours(html) {
    const hours = {};

    // Look for day patterns
    const days = {
      lundi: 'lundi', monday: 'lundi',
      mardi: 'mardi', tuesday: 'mardi',
      mercredi: 'mercredi', wednesday: 'mercredi',
      jeudi: 'jeudi', thursday: 'jeudi',
      vendredi: 'vendredi', friday: 'vendredi',
      samedi: 'samedi', saturday: 'samedi',
      dimanche: 'dimanche', sunday: 'dimanche'
    };

    for (const [dayPattern, dayKey] of Object.entries(days)) {
      const regex = new RegExp(`${dayPattern}[^\\d]*(\\d{1,2}[h:]\\d{2}\\s*[-–à]\\s*\\d{1,2}[h:]\\d{2}|fermé|closed)`, 'i');
      const match = html.match(regex);
      if (match) {
        hours[dayKey] = match[1].toLowerCase().includes('fermé') || match[1].toLowerCase().includes('closed')
          ? 'Fermé'
          : match[1].replace(/[–à]/g, '-').replace(/h/g, ':');
      }
    }

    if (Object.keys(hours).length > 0) {
      return {
        horaires: {
          response: this.formatHoursResponse(hours),
          details: hours
        }
      };
    }

    return {};
  }

  /**
   * Format hours into readable response
   */
  formatHoursResponse(hours) {
    const openDays = Object.entries(hours)
      .filter(([_, v]) => v !== 'Fermé')
      .map(([k, v]) => `${k}: ${v}`);

    if (openDays.length === 0) return 'Horaires non disponibles';
    return openDays.join(', ');
  }

  /**
   * Extract delivery information
   */
  extractDelivery(html) {
    const text = this.stripHtml(html);
    const delivery = {};

    // Look for delivery times
    const delaiMatch = text.match(/livraison[^.]*(\d+[–-]?\d*\s*(?:jours?|heures?|h))/i);
    if (delaiMatch) delivery.delai = delaiMatch[1];

    // Look for prices
    const prixMatch = text.match(/(?:frais|prix)[^.]*livraison[^.]*(\d+(?:[,.]\d{2})?\s*(?:€|DH|MAD|EUR))/i);
    if (prixMatch) delivery.frais = prixMatch[1];

    // Look for free shipping
    if (/livraison\s*gratuite/i.test(text)) {
      delivery.gratuite = true;
    }

    if (Object.keys(delivery).length > 0) {
      return {
        livraison: {
          response: this.formatDeliveryResponse(delivery),
          details: delivery
        }
      };
    }

    return {};
  }

  /**
   * Format delivery response
   */
  formatDeliveryResponse(delivery) {
    const parts = [];
    if (delivery.gratuite) parts.push('Livraison gratuite');
    if (delivery.delai) parts.push(`Délai: ${delivery.delai}`);
    if (delivery.frais) parts.push(`Frais: ${delivery.frais}`);
    return parts.join('. ') || 'Information livraison disponible sur le site.';
  }

  /**
   * Extract returns policy
   */
  extractReturns(html) {
    const text = this.stripHtml(html);

    // Look for return period
    const periodeMatch = text.match(/retour[^.]*(\d+\s*jours?)/i);
    const policy = {};

    if (periodeMatch) {
      policy.periode = periodeMatch[1];
    }

    if (/gratuit/i.test(text) && /retour/i.test(text)) {
      policy.gratuit = true;
    }

    if (Object.keys(policy).length > 0) {
      return {
        retours: {
          response: policy.gratuit
            ? `Retours gratuits sous ${policy.periode || '14 jours'}`
            : `Retours acceptés sous ${policy.periode || '14 jours'}`,
          details: policy
        }
      };
    }

    return {};
  }

  /**
   * Extract general content
   */
  extractGeneral(html) {
    const result = {};

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.page_title = this.stripHtml(titleMatch[1]);
    }

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (descMatch) {
      result.description = descMatch[1];
    }

    return result;
  }

  /**
   * Strip HTML tags
   */
  stripHtml(html) {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize key
   */
  normalizeKey(text) {
    return text
      .toLowerCase()
      .trim()
      .slice(0, 50)
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
let instance = null;

function getInstance(options = {}) {
  if (!instance) {
    instance = new KBCrawler(options);
  }
  return instance;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(`
VocalIA KB Crawler

Crawl client websites to extract KB content.

Usage:
  node kb-crawler.cjs [options] <url>

Options:
  --help              Show this help
  --max-pages <n>     Maximum pages to crawl (default: 20)
  --output <file>     Write result to JSON file
  --single            Crawl single URL only (no site crawl)

Examples:
  node kb-crawler.cjs https://www.example.com
  node kb-crawler.cjs --single https://www.example.com/faq
  node kb-crawler.cjs --output kb.json --max-pages 10 https://www.example.com
`);
    process.exit(0);
  }

  const url = args.find(a => a.startsWith('http'));
  if (!url) {
    console.error('Error: URL required');
    process.exit(1);
  }

  const maxPagesIdx = args.indexOf('--max-pages');
  const maxPages = maxPagesIdx !== -1 ? parseInt(args[maxPagesIdx + 1]) : 20;

  const crawler = new KBCrawler({ maxPages });

  (async () => {
    try {
      console.log(`[KBCrawler] Starting crawl of ${url}...`);

      let result;
      if (args.includes('--single')) {
        result = await crawler.crawlURL(url);
      } else {
        result = await crawler.crawlSite(url);
      }

      console.log('\n📊 Extracted KB:');
      console.log(JSON.stringify(result, null, 2));

      const outputIdx = args.indexOf('--output');
      if (outputIdx !== -1 && args[outputIdx + 1]) {
        const outputFile = args[outputIdx + 1];
        require('fs').writeFileSync(outputFile, JSON.stringify(result, null, 2));
        console.log(`\n✅ Written to: ${outputFile}`);
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  })();
}

module.exports = {
  KBCrawler,
  getInstance,
  PAGE_PATTERNS
};
