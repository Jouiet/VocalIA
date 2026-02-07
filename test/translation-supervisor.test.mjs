/**
 * VocalIA Translation Supervisor Tests
 *
 * Tests:
 * - A2A Agent Card
 * - Task state history (A2A lifecycle)
 * - Hallucination detection (EN + FR boilerplate)
 * - cleanTextForTTS (markdown, emojis, whitespace)
 * - generateFallback (5 languages)
 * - enforceDarijaAuthenticity (FR→Darija replacements)
 *
 * Run: node --test test/translation-supervisor.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import supervisor from '../core/translation-supervisor.cjs';

describe('TranslationSupervisor Agent Card', () => {
  test('has A2A agent card', () => {
    const card = supervisor.getAgentCard();
    assert.ok(card);
    assert.strictEqual(card.name, 'TranslationSupervisor');
    assert.ok(card.version);
    assert.ok(card.description);
  });

  test('agent card has provider info', () => {
    const card = supervisor.getAgentCard();
    assert.strictEqual(card.provider.organization, 'VocalIA');
    assert.strictEqual(card.provider.url, 'https://vocalia.ma');
  });

  test('agent card has skills', () => {
    const card = supervisor.getAgentCard();
    assert.ok(card.skills);
    assert.ok(card.skills.length >= 3);
    const skillIds = card.skills.map(s => s.id);
    assert.ok(skillIds.includes('hallucination_detection'));
    assert.ok(skillIds.includes('language_consistency'));
  });

  test('agent card has capabilities', () => {
    const card = supervisor.getAgentCard();
    assert.ok(card.capabilities);
    assert.strictEqual(card.capabilities.stateTransitionHistory, true);
  });
});

describe('TranslationSupervisor Task History', () => {
  test('records and retrieves task state', () => {
    const corrId = 'test_' + Date.now();
    supervisor.recordTaskState(corrId, 'submitted', { test: true });
    supervisor.recordTaskState(corrId, 'working', { step: 1 });
    supervisor.recordTaskState(corrId, 'completed', { result: 'ok' });

    const history = supervisor.getTaskHistory(corrId);
    assert.ok(history);
    assert.ok(Array.isArray(history));
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].state, 'submitted');
    assert.strictEqual(history[2].state, 'completed');
  });

  test('returns empty array for unknown correlation ID', () => {
    const history = supervisor.getTaskHistory('nonexistent_id');
    assert.deepStrictEqual(history, []);
  });

  test('task state entry has timestamp', () => {
    const corrId = 'ts_test_' + Date.now();
    supervisor.recordTaskState(corrId, 'submitted');
    const history = supervisor.getTaskHistory(corrId);
    assert.ok(history[0].timestamp);
  });
});

describe('TranslationSupervisor Hallucination Detection', () => {
  test('detects EN boilerplate: "as an AI language model"', () => {
    assert.strictEqual(supervisor.detectHallucination('As an AI language model, I cannot...'), true);
  });

  test('detects EN boilerplate: "I am an artificial intelligence"', () => {
    assert.strictEqual(supervisor.detectHallucination('I am an artificial intelligence assistant'), true);
  });

  test('detects EN boilerplate: "my cutoff date"', () => {
    assert.strictEqual(supervisor.detectHallucination('My cutoff date is January 2025'), true);
  });

  test('detects EN boilerplate: "OpenAI"', () => {
    assert.strictEqual(supervisor.detectHallucination('I was created by OpenAI'), true);
  });

  test('detects FR boilerplate: "en tant que modèle de langue"', () => {
    assert.strictEqual(supervisor.detectHallucination('En tant que modèle de langue, je...'), true);
  });

  test('detects FR boilerplate: "je suis une intelligence artificielle"', () => {
    assert.strictEqual(supervisor.detectHallucination('Je suis une intelligence artificielle'), true);
  });

  test('clean text passes detection', () => {
    assert.strictEqual(supervisor.detectHallucination('Bonjour, comment puis-je vous aider ?'), false);
  });

  test('business text passes detection', () => {
    assert.strictEqual(supervisor.detectHallucination('Nos horaires sont de 9h à 18h du lundi au vendredi.'), false);
  });
});

describe('TranslationSupervisor cleanTextForTTS', () => {
  test('removes markdown bold', () => {
    assert.strictEqual(supervisor.cleanTextForTTS('**bold text**'), 'bold text');
  });

  test('removes markdown italic', () => {
    assert.strictEqual(supervisor.cleanTextForTTS('_italic_'), 'italic');
  });

  test('removes markdown headers', () => {
    assert.strictEqual(supervisor.cleanTextForTTS('# Header'), 'Header');
  });

  test('removes backticks', () => {
    assert.strictEqual(supervisor.cleanTextForTTS('`code`'), 'code');
  });

  test('collapses whitespace', () => {
    assert.strictEqual(supervisor.cleanTextForTTS('word1   word2    word3'), 'word1 word2 word3');
  });

  test('trims result', () => {
    assert.strictEqual(supervisor.cleanTextForTTS('  text  '), 'text');
  });

  test('handles combined markdown', () => {
    const input = '**Bold** and _italic_ with `code` and ## heading';
    const result = supervisor.cleanTextForTTS(input);
    assert.ok(!result.includes('*'));
    assert.ok(!result.includes('_'));
    assert.ok(!result.includes('`'));
    assert.ok(!result.includes('#'));
  });
});

describe('TranslationSupervisor generateFallback', () => {
  test('generates FR fallback (default)', () => {
    const fallback = supervisor.generateFallback('fr');
    assert.ok(fallback.includes('Pardon'));
    assert.ok(fallback.includes('répéter'));
  });

  test('generates EN fallback', () => {
    const fallback = supervisor.generateFallback('en');
    assert.ok(fallback.includes('Sorry'));
    assert.ok(fallback.includes('repeat'));
  });

  test('generates ES fallback', () => {
    const fallback = supervisor.generateFallback('es');
    assert.ok(fallback.includes('siento'));
    assert.ok(fallback.includes('repetir'));
  });

  test('generates AR fallback', () => {
    const fallback = supervisor.generateFallback('ar');
    assert.ok(/[\u0600-\u06FF]/.test(fallback)); // Contains Arabic
  });

  test('generates ARY (Darija) fallback', () => {
    const fallback = supervisor.generateFallback('ary');
    assert.ok(fallback.includes('Smahli'));
    assert.ok(fallback.includes('3afak'));
  });

  test('unknown language defaults to FR', () => {
    const fallback = supervisor.generateFallback('xx');
    assert.ok(fallback.includes('Pardon'));
  });
});

describe('TranslationSupervisor enforceDarijaAuthenticity', () => {
  test('replaces "bonjour" with "Salam"', () => {
    const result = supervisor.enforceDarijaAuthenticity('Bonjour, comment allez-vous?');
    assert.ok(result.includes('Salam'));
    assert.ok(!result.includes('Bonjour'));
  });

  test('replaces "au revoir" with "Beslama"', () => {
    const result = supervisor.enforceDarijaAuthenticity('Au revoir!');
    assert.ok(result.includes('Beslama'));
  });

  test('replaces "merci" with "Choukran"', () => {
    const result = supervisor.enforceDarijaAuthenticity('Merci beaucoup');
    assert.ok(result.includes('Choukran'));
  });

  test('replaces "s\'il vous plaît" with "3afak"', () => {
    const result = supervisor.enforceDarijaAuthenticity("s'il vous plaît");
    assert.ok(result.includes('3afak'));
  });

  test('replaces "oui" with "Ah"', () => {
    const result = supervisor.enforceDarijaAuthenticity('Oui');
    assert.ok(result.includes('Ah'));
  });

  test('replaces "non" with "Lla"', () => {
    const result = supervisor.enforceDarijaAuthenticity('Non');
    assert.ok(result.includes('Lla'));
  });

  test('already Darija text unchanged', () => {
    const darija = 'Salam, kifach nkdro n3awnok?';
    const result = supervisor.enforceDarijaAuthenticity(darija);
    assert.strictEqual(result, darija);
  });
});
