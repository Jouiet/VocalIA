/**
 * VocalIA - Sovereign Knowledge Ingestion Engine
 * 
 * Role: Autonomous Web Scraper & Knowledge Formatter
 * Tech: Playwright (Headless) + Mozilla Readability + Turndown
 * 
 * Features:
 * - Headless Browsing (Playwright)
 * - Smart Content Extraction (Readability.js)
 * - HTML -> Markdown Conversion (Turndown)
 * - Anti-Bot Evasion (Basic User-Agent rotation)
 * 
 * Usage:
 *   const ingestor = new KnowledgeIngestion();
 *   const markdown = await ingestor.scrape("https://client-site.com/pricing");
 */

// Lazy-loaded optional deps (removed from package.json in B76 — 240MB savings)
let chromium, stealth, Readability, JSDOM, TurndownService;
let depsAvailable = false;
try {
  chromium = require('playwright-extra').chromium;
  stealth = require('puppeteer-extra-plugin-stealth')();
  chromium.use(stealth);
  Readability = require('@mozilla/readability').Readability;
  JSDOM = require('jsdom').JSDOM;
  TurndownService = require('turndown');
  depsAvailable = true;
} catch (e) {
  // Dependencies not installed — scrape() will return 503
}

class KnowledgeIngestion {
    constructor(options = {}) {
        this.browser = null;
        this.turndownService = depsAvailable ? new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        }) : null;
        this.options = {
            headless: true, // true for production, false for debugging
            timeout: 30000,
            ...options
        };
    }

    /**
     * Initialize Browser (Lazy Loading)
     */
    async init() {
        if (!depsAvailable) {
            throw new Error('KnowledgeIngestion deps not installed (playwright-extra, jsdom, turndown). Install with: npm install playwright-extra puppeteer-extra-plugin-stealth @mozilla/readability jsdom turndown');
        }
        if (!this.browser) {
            console.log('[KnowledgeIngestion] Launching Headless Operations...');
            this.browser = await chromium.launch({
                headless: this.options.headless
            });
        }
    }

    /**
     * Scrape & Process a URL
     * @param {string} url - Target URL
     * @returns {Promise<{title: string, content: string, markdown: string, metadata: object}>}
     */
    async scrape(url) {
        if (!this.browser) await this.init();

        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        try {
            console.log(`[KnowledgeIngestion] Visiting: ${url}`);
            // SOTA: Stealth navigation
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeout });

            // SOTA: Smart Wait (Network Idle or Specific Selector if known)
            try {
                // Wait for network to be idle (hydration complete) or timeout after 5s
                await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { });

                // Scroll to bottom to trigger lazy loading
                await page.evaluate(async () => {
                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        const distance = 100;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 100);
                    });
                });

                // Wait a bit more for lazy content
                await page.waitForTimeout(1000);
            } catch (e) {
                console.warn(`[KnowledgeIngestion] Smart wait partial fail: ${e.message}`);
            }

            // 1. Get Raw HTML
            const html = await page.content();

            // 2. Parse with JSDOM + Readability (Noise Reduction)
            const doc = new JSDOM(html, { url });
            const reader = new Readability(doc.window.document);
            const article = reader.parse();

            if (!article) {
                throw new Error('Readability failed to parse content');
            }

            // 3. Convert to Markdown (LLM Ready)
            const markdown = this.turndownService.turndown(article.content);

            // 4. Extract Metadata (Basic)
            const metadata = {
                url,
                scrapedAt: new Date().toISOString(),
                title: article.title,
                byline: article.byline,
                length: markdown.length
            };

            console.log(`[KnowledgeIngestion] Scraped ${metadata.length} chars from ${url}`);

            return {
                ...metadata,
                markdown
            };

        } catch (error) {
            console.error(`[KnowledgeIngestion] Failed to scrape ${url}:`, error.message);
            throw error;
        } finally {
            await page.close();
            await context.close();
        }
    }

    /**
     * Close Browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('[KnowledgeIngestion] Browser closed.');
        }
    }
}

// CLI Testing
if (require.main === module) {
    (async () => {
        const ingestor = new KnowledgeIngestion();
        const url = process.argv[2] || 'https://example.com';
        try {
            const result = await ingestor.scrape(url);
            console.log('\n--- METADATA ---');
            console.log(result);
            console.log('\n--- MARKDOWN ---');
            console.log(result.markdown.substring(0, 500) + '...');
        } catch (e) {
            console.error(e);
        } finally {
            await ingestor.close();
        }
    })();
}

module.exports = KnowledgeIngestion;
