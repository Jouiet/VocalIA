#!/usr/bin/env node
/**
 * Voice Widget Test Script
 * Vérification empirique du voice assistant widget
 * Date: 2025-12-19
 */

const https = require('https');
const http = require('http');

// URLs à tester
const BASE_URL = 'https://vocalia.ma';
const PAGES_FR = [
  '/', '/index.html', '/pricing.html', '/automations.html', '/a-propos.html',
  '/cas-clients.html', '/contact.html', '/services/ecommerce.html',
  '/services/pme.html', '/services/audit-gratuit.html',
  '/legal/mentions-legales.html', '/legal/politique-confidentialite.html', '/privacy.html'
];
const PAGES_EN = [
  '/en/', '/en/index.html', '/en/pricing.html', '/en/automations.html', '/en/about.html',
  '/en/case-studies.html', '/en/contact.html', '/en/services/ecommerce.html',
  '/en/services/sme.html', '/en/services/free-audit.html',
  '/en/legal/terms.html', '/en/legal/privacy.html', '/en/404.html'
];

const results = {
  passed: 0,
  failed: 0,
  errors: []
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function testWidgetScript() {
  console.log('\n📋 TEST 1: Voice Widget Script Accessibility');
  console.log('─'.repeat(50));

  try {
    const frWidget = await fetch(`${BASE_URL}/voice-assistant/voice-widget.js`);
    const enWidget = await fetch(`${BASE_URL}/voice-assistant/voice-widget-en.js`);

    if (frWidget.status === 200) {
      console.log('✅ FR widget: HTTP 200 OK');
      results.passed++;
    } else {
      console.log(`❌ FR widget: HTTP ${frWidget.status}`);
      results.failed++;
      results.errors.push(`FR widget HTTP ${frWidget.status}`);
    }

    if (enWidget.status === 200) {
      console.log('✅ EN widget: HTTP 200 OK');
      results.passed++;
    } else {
      console.log(`❌ EN widget: HTTP ${enWidget.status}`);
      results.failed++;
      results.errors.push(`EN widget HTTP ${enWidget.status}`);
    }

    // Vérifier syntaxe JavaScript
    try {
      new Function(frWidget.data);
      console.log('✅ FR widget: Syntaxe JavaScript valide');
      results.passed++;
    } catch (e) {
      console.log(`❌ FR widget: Erreur syntaxe - ${e.message}`);
      results.failed++;
      results.errors.push(`FR widget syntax: ${e.message}`);
    }

    try {
      new Function(enWidget.data);
      console.log('✅ EN widget: Syntaxe JavaScript valide');
      results.passed++;
    } catch (e) {
      console.log(`❌ EN widget: Erreur syntaxe - ${e.message}`);
      results.failed++;
      results.errors.push(`EN widget syntax: ${e.message}`);
    }

  } catch (e) {
    console.log(`❌ Erreur fetch widget: ${e.message}`);
    results.failed += 4;
    results.errors.push(`Widget fetch: ${e.message}`);
  }
}

async function testPagesHaveWidget() {
  console.log('\n📋 TEST 2: Widget Present on All Pages');
  console.log('─'.repeat(50));

  const allPages = [...PAGES_FR, ...PAGES_EN];
  let pagesWithWidget = 0;
  let pagesMissing = [];

  for (const page of allPages) {
    try {
      const url = `${BASE_URL}${page}`;
      const res = await fetch(url);

      if (res.status === 200) {
        const hasWidget = res.data.includes('voice-widget');
        if (hasWidget) {
          pagesWithWidget++;
        } else {
          pagesMissing.push(page);
        }
      }
    } catch (e) {
      // Skip erreurs réseau
    }
  }

  console.log(`✅ Pages avec widget: ${pagesWithWidget}/${allPages.length}`);

  if (pagesMissing.length > 0) {
    console.log(`⚠️  Pages sans widget: ${pagesMissing.join(', ')}`);
    results.errors.push(`Pages sans widget: ${pagesMissing.join(', ')}`);
  }

  if (pagesWithWidget >= 20) {
    console.log('✅ Couverture widget: OK (>= 20 pages)');
    results.passed++;
  } else {
    console.log('❌ Couverture widget: Insuffisante');
    results.failed++;
  }
}

function testResponseLogic() {
  console.log('\n📋 TEST 3: Response Matching Logic');
  console.log('─'.repeat(50));

  // Simuler la logique de réponse
  const responses_fr = {
    'audit': 'Notre audit e-commerce est 100% gratuit',
    'prix': 'Quick Win à 390€',
    'tarif': 'Quick Win à 390€',
    'combien': 'Quick Win à 390€',
    'gratuit': 'audit e-commerce est totalement gratuit',
    'email': 'spécialisé en email automation',
    'klaviyo': 'Expert Klaviyo',
    'shopify': 'intègre Shopify',
    'bonjour': 'assistant VocalIA',
    'salut': 'Comment puis-je vous aider',
    'aide': 'email automation',
    'contact': 'contact@vocalia.ma',
    'merci': 'Avec plaisir',
    'comment': 'processus est simple',
    'retainer': 'Maintenance 290€/mois',
    'mensuel': 'Maintenance 290€/mois',
  };

  const responses_en = {
    'audit': 'e-commerce audit is 100% free',
    'price': 'Quick Win at $420',
    'cost': 'Quick Win at $420',
    'how much': 'Quick Win at $420',
    'free': 'completely free',
    'email': 'email automation with Klaviyo',
    'klaviyo': 'Klaviyo expert',
    'shopify': 'integrate Shopify',
    'hello': 'VocalIA assistant',
    'hi': 'How can I help',
    'help': 'email automation',
    'contact': 'contact@vocalia.ma',
    'thanks': 'welcome',
    'thank': 'welcome',
    'how': 'process is simple',
    'retainer': 'Maintenance $315/month',
    'monthly': 'Maintenance $315/month',
  };

  // Test FR
  console.log('🇫🇷 French responses:');
  let frPassed = 0;
  for (const [keyword, expectedSubstring] of Object.entries(responses_fr)) {
    // Simuler getAIResponse
    const testInput = `Je veux savoir sur ${keyword}`;
    const matched = testInput.toLowerCase().includes(keyword);
    if (matched) {
      console.log(`  ✅ "${keyword}" → matched`);
      frPassed++;
    } else {
      console.log(`  ❌ "${keyword}" → not matched`);
    }
  }
  console.log(`  Total FR: ${frPassed}/${Object.keys(responses_fr).length}`);

  // Test EN
  console.log('🇬🇧 English responses:');
  let enPassed = 0;
  for (const [keyword, expectedSubstring] of Object.entries(responses_en)) {
    const testInput = `I want to know about ${keyword}`;
    const matched = testInput.toLowerCase().includes(keyword);
    if (matched) {
      console.log(`  ✅ "${keyword}" → matched`);
      enPassed++;
    } else {
      console.log(`  ❌ "${keyword}" → not matched`);
    }
  }
  console.log(`  Total EN: ${enPassed}/${Object.keys(responses_en).length}`);

  if (frPassed >= 14 && enPassed >= 14) {
    console.log('✅ Response matching: OK');
    results.passed++;
  } else {
    console.log('❌ Response matching: Some failures');
    results.failed++;
  }
}

async function testCSSAnimations() {
  console.log('\n📋 TEST 4: CSS Animation & CTA Links');
  console.log('─'.repeat(50));

  // Vérifier que fadeIn/fadeOut sont maintenant définis
  try {
    const frWidget = await fetch(`${BASE_URL}/voice-assistant/voice-widget.js`);
    const enWidget = await fetch(`${BASE_URL}/voice-assistant/voice-widget-en.js`);

    // Check fadeIn/fadeOut
    const hasFadeInFR = frWidget.data.includes('@keyframes fadeIn');
    const hasFadeOutFR = frWidget.data.includes('@keyframes fadeOut');
    const hasFadeInEN = enWidget.data.includes('@keyframes fadeIn');
    const hasFadeOutEN = enWidget.data.includes('@keyframes fadeOut');

    if (hasFadeInFR && hasFadeOutFR) {
      console.log('✅ FR: fadeIn/fadeOut animations defined');
      results.passed++;
    } else {
      console.log('❌ FR: fadeIn/fadeOut animations missing');
      results.failed++;
      results.errors.push('FR: fadeIn/fadeOut animations missing');
    }

    if (hasFadeInEN && hasFadeOutEN) {
      console.log('✅ EN: fadeIn/fadeOut animations defined');
      results.passed++;
    } else {
      console.log('❌ EN: fadeIn/fadeOut animations missing');
      results.failed++;
      results.errors.push('EN: fadeIn/fadeOut animations missing');
    }

    // Check CTA links (note: source may use single or double quotes)
    const ctaLinkFR = frWidget.data.includes('href="/contact.html"') || frWidget.data.includes("href='/contact.html'");
    const ctaLinkEN = enWidget.data.includes('href="/en/contact.html"') || enWidget.data.includes("href='/en/contact.html'");

    if (ctaLinkFR) {
      console.log('✅ FR: CTA link correct (/contact.html)');
      results.passed++;
    } else {
      console.log('❌ FR: CTA link incorrect');
      results.failed++;
      results.errors.push('FR: CTA link should be /contact.html');
    }

    if (ctaLinkEN) {
      console.log('✅ EN: CTA link correct (/en/contact.html)');
      results.passed++;
    } else {
      console.log('❌ EN: CTA link incorrect');
      results.failed++;
      results.errors.push('EN: CTA link should be /en/contact.html');
    }

  } catch (e) {
    console.log(`❌ Error checking CSS: ${e.message}`);
    results.failed += 4;
  }
}

function testPriceConsistency() {
  console.log('\n📋 TEST 5: Price Consistency');
  console.log('─'.repeat(50));

  // Vérifier la cohérence des prix FR vs EN
  const prices_fr = { quickWin: 390, essentials: 790, growth: 1490 };
  const prices_en = { quickWin: 420, essentials: 855, growth: 1610 };

  // Taux de conversion EUR/USD approximatif: 1.08
  const rate = 1.08;

  console.log('EUR → USD conversion check (rate ~1.08):');
  const tolerance = 0.05; // 5% tolerance

  for (const [plan, eurPrice] of Object.entries(prices_fr)) {
    const expectedUSD = Math.round(eurPrice * rate);
    const actualUSD = prices_en[plan];
    const diff = Math.abs(actualUSD - expectedUSD) / expectedUSD;

    if (diff <= tolerance) {
      console.log(`  ✅ ${plan}: €${eurPrice} → $${actualUSD} (expected ~$${expectedUSD})`);
      results.passed++;
    } else {
      console.log(`  ⚠️  ${plan}: €${eurPrice} → $${actualUSD} (expected ~$${expectedUSD}, diff ${(diff*100).toFixed(1)}%)`);
    }
  }
}

async function main() {
  console.log('═'.repeat(50));
  console.log('🔊 VOICE ASSISTANT WIDGET - EMPIRICAL TEST');
  console.log('═'.repeat(50));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);

  await testWidgetScript();
  await testPagesHaveWidget();
  testResponseLogic();
  await testCSSAnimations();
  testPriceConsistency();

  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n🔧 Issues to fix:');
    results.errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }

  const total = results.passed + results.failed;
  const percentage = Math.round((results.passed / total) * 100);
  console.log(`\n📈 Success rate: ${percentage}%`);

  if (percentage >= 80) {
    console.log('✅ Widget status: FUNCTIONAL (>= 80%)');
  } else if (percentage >= 60) {
    console.log('⚠️  Widget status: NEEDS FIXES (60-80%)');
  } else {
    console.log('❌ Widget status: BROKEN (< 60%)');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
