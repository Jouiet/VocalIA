require('dotenv').config({ path: '/Users/mac/Desktop/VocalIA/.env' });
const fs = require('fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const esPath = '/Users/mac/Desktop/VocalIA/website/src/locales/es.json';
const frPath = '/Users/mac/Desktop/VocalIA/website/src/locales/fr.json';

const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));

const frenchPatterns = /\b(vous|nous|mais|avec|pour|dans|votre|notre|cette|c'est|automatique|connexion|synchronisation|détection|transfert)\b/gi;

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function findContaminated(obj, path = '') {
  const contaminated = [];
  for (const key in obj) {
    const fullPath = path ? path + '.' + key : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      contaminated.push(...findContaminated(obj[key], fullPath));
    } else if (typeof obj[key] === 'string') {
      if (frenchPatterns.test(obj[key])) {
        const frValue = getNestedValue(fr, fullPath);
        if (frValue) contaminated.push({ key: fullPath, frValue });
      }
    }
  }
  return contaminated;
}

async function translateBatch(items) {
  const textItems = items.map(i => '"' + i.key + '": "' + i.frValue.replace(/"/g, '\\"') + '"').join('\n');

  const prompt = 'Translate these French texts to proper Spanish (Spain).\nKeep technical terms unchanged (VocalIA, Widget, API, CRM, B2B, BANT, ROI).\nReturn ONLY key-value pairs in format: "key": "Spanish translation"\n\n' + textItems;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
      })
    }
  );

  const data = await response.json();
  if (!data.candidates || !data.candidates[0]) {
    console.log('API error:', JSON.stringify(data).substring(0, 200));
    return {};
  }

  const text = data.candidates[0].content.parts[0].text;
  const translations = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/"([^"]+)":\s*"(.+)"/);
    if (match) translations[match[1]] = match[2];
  }
  return translations;
}

async function main() {
  const contaminated = findContaminated(es);
  console.log('Found ' + contaminated.length + ' contaminated entries');

  const BATCH_SIZE = 15;
  let fixed = 0;
  const totalBatches = Math.ceil(contaminated.length / BATCH_SIZE);

  for (let i = 0; i < contaminated.length; i += BATCH_SIZE) {
    const batch = contaminated.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const translations = await translateBatch(batch);

      for (const key in translations) {
        setNestedValue(es, key, translations[key]);
        fixed++;
      }

      console.log('Batch ' + batchNum + '/' + totalBatches + ': ' + Object.keys(translations).length + ' fixed');
    } catch (err) {
      console.log('Batch ' + batchNum + ' error: ' + err.message);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  fs.writeFileSync(esPath, JSON.stringify(es, null, 2));
  console.log('\n✅ Fixed ' + fixed + '/' + contaminated.length + ' entries');
  console.log('Saved to: ' + esPath);
}

main().catch(console.error);
