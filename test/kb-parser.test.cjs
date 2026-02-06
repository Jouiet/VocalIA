'use strict';

/**
 * VocalIA KB Parser Tests
 *
 * Tests:
 * - SUPPORTED_FORMATS constant
 * - JSON parsing (object, array with keys)
 * - CSV/TSV parsing (headers, quotes, extra columns)
 * - TXT Q&A format parsing
 * - Markdown FAQ format parsing
 * - normalizeKey helper
 * - markdownToText helper
 * - validate method
 * - getSupportedFormats
 * - Error handling (unsupported format, bad CSV)
 *
 * Run: node --test test/kb-parser.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { KBParser, SUPPORTED_FORMATS } = require('../core/kb-parser.cjs');

const parser = new KBParser();

describe('SUPPORTED_FORMATS', () => {
  test('includes json, csv, tsv, xlsx, txt, md, markdown', () => {
    assert.ok(SUPPORTED_FORMATS.includes('json'));
    assert.ok(SUPPORTED_FORMATS.includes('csv'));
    assert.ok(SUPPORTED_FORMATS.includes('tsv'));
    assert.ok(SUPPORTED_FORMATS.includes('txt'));
    assert.ok(SUPPORTED_FORMATS.includes('md'));
    assert.ok(SUPPORTED_FORMATS.includes('markdown'));
  });

  test('has at least 6 formats', () => {
    assert.ok(SUPPORTED_FORMATS.length >= 6);
  });
});

describe('KBParser JSON', () => {
  test('parses simple JSON object', () => {
    const result = parser.parseContent('{"horaires": {"response": "9h-18h"}}', 'json');
    assert.ok(result.horaires);
    assert.strictEqual(result.horaires.response, '9h-18h');
  });

  test('parses array with key field', () => {
    const data = JSON.stringify([
      { key: 'horaires', response: '9h-18h' },
      { key: 'contact', response: '+212600000000' }
    ]);
    const result = parser.parseContent(data, 'json');
    assert.ok(result.horaires);
    assert.ok(result.contact);
  });

  test('returns object as-is when no key field', () => {
    const result = parser.parseContent('{"test": "value"}', 'json');
    assert.strictEqual(result.test, 'value');
  });
});

describe('KBParser CSV', () => {
  test('parses basic CSV with key,response', () => {
    const csv = 'key,response\nhoraires,Ouvert 9h-18h\ncontact,+212600000000';
    const result = parser.parseContent(csv, 'csv');
    assert.strictEqual(result.horaires, 'Ouvert 9h-18h');
    assert.strictEqual(result.contact, '+212600000000');
  });

  test('parses CSV with clé header (French)', () => {
    const csv = 'clé,réponse\nhoraires,Ouvert 9h-18h';
    const result = parser.parseContent(csv, 'csv');
    assert.ok(result.horaires);
  });

  test('parses CSV with quoted fields', () => {
    const csv = 'key,response\nservices,"Détartrage, Blanchiment, Implants"';
    const result = parser.parseContent(csv, 'csv');
    assert.ok(result.services.includes('Détartrage'));
  });

  test('skips empty lines', () => {
    const csv = 'key,response\nhoraires,9h-18h\n\ncontact,+212\n';
    const result = parser.parseContent(csv, 'csv');
    assert.strictEqual(Object.keys(result).length, 2);
  });

  test('throws for CSV without header', () => {
    assert.throws(() => parser.parseContent('only one line', 'csv'), /header/);
  });

  test('throws for CSV without key column', () => {
    assert.throws(() => parser.parseContent('name,value\na,b', 'csv'), /key/i);
  });

  test('parses extra columns as fields', () => {
    const csv = 'key,response,category\nhoraires,9h-18h,info';
    const result = parser.parseContent(csv, 'csv');
    assert.ok(result.horaires);
    assert.strictEqual(result.horaires.category, 'info');
  });
});

describe('KBParser TSV', () => {
  test('parses tab-separated values', () => {
    const tsv = 'key\tresponse\nhoraires\t9h-18h';
    const result = parser.parseContent(tsv, 'tsv');
    assert.strictEqual(result.horaires, '9h-18h');
  });
});

describe('KBParser TXT', () => {
  test('parses Q&A format', () => {
    const txt = 'Q: Quels sont vos horaires?\nA: Nous sommes ouverts de 9h à 18h.';
    const result = parser.parseContent(txt, 'txt');
    const key = Object.keys(result)[0];
    assert.ok(result[key].includes('9h'));
  });

  test('parses bracket format [key]', () => {
    const txt = '[horaires]\nNous sommes ouverts de 9h à 18h.';
    const result = parser.parseContent(txt, 'txt');
    assert.ok(result.horaires);
    assert.ok(result.horaires.includes('9h'));
  });

  test('parses multiple Q&A entries', () => {
    const txt = 'Q: Hours\nA: 9-18\nQ: Phone\nA: +212600000000';
    const result = parser.parseContent(txt, 'txt');
    assert.strictEqual(Object.keys(result).length, 2);
  });
});

describe('KBParser Markdown', () => {
  test('parses ## headers as keys', () => {
    const md = '## Horaires\nNous sommes ouverts de 9h à 18h.';
    const result = parser.parseContent(md, 'md');
    assert.ok(result.horaires);
    assert.ok(result.horaires.includes('9h'));
  });

  test('parses ### sub-headers', () => {
    const md = '### Contact\n+212600000000';
    const result = parser.parseContent(md, 'markdown');
    assert.ok(result.contact);
  });

  test('handles multiple sections', () => {
    const md = '## Horaires\n9h-18h\n\n## Services\nDétartrage\nBlanchiment';
    const result = parser.parseContent(md, 'md');
    assert.ok(result.horaires);
    assert.ok(result.services);
  });

  test('strips markdown formatting from values', () => {
    const md = '## Info\nThis is **bold** and *italic* text with [a link](http://test.com)';
    const result = parser.parseContent(md, 'md');
    assert.ok(!result.info.includes('**'));
    assert.ok(!result.info.includes('*'));
    assert.ok(!result.info.includes('['));
    assert.ok(result.info.includes('bold'));
    assert.ok(result.info.includes('a link'));
  });
});

describe('KBParser normalizeKey', () => {
  test('lowercases', () => {
    assert.strictEqual(parser.normalizeKey('Horaires'), 'horaires');
  });

  test('replaces spaces with underscores', () => {
    assert.strictEqual(parser.normalizeKey('Opening Hours'), 'opening_hours');
  });

  test('removes special characters', () => {
    assert.strictEqual(parser.normalizeKey('What is your phone?'), 'what_is_your_phone');
  });

  test('collapses multiple underscores', () => {
    assert.strictEqual(parser.normalizeKey('test---key'), 'test_key');
  });

  test('trims leading/trailing underscores', () => {
    assert.strictEqual(parser.normalizeKey(' _test_ '), 'test');
  });
});

describe('KBParser markdownToText', () => {
  test('removes bold markers', () => {
    assert.strictEqual(parser.markdownToText('**bold**'), 'bold');
  });

  test('removes italic markers', () => {
    assert.strictEqual(parser.markdownToText('*italic*'), 'italic');
  });

  test('removes links, keeps text', () => {
    assert.strictEqual(parser.markdownToText('[VocalIA](https://vocalia.ma)'), 'VocalIA');
  });

  test('removes inline code backticks', () => {
    assert.strictEqual(parser.markdownToText('Use `npm install`'), 'Use npm install');
  });
});

describe('KBParser validate', () => {
  test('valid data passes', () => {
    const result = parser.validate({ horaires: { response: '9h-18h' } });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.entryCount, 1);
  });

  test('empty data warns', () => {
    const result = parser.validate({});
    assert.ok(result.warnings.length > 0);
  });

  test('null data fails', () => {
    const result = parser.validate(null);
    assert.strictEqual(result.valid, false);
  });

  test('non-object data fails', () => {
    const result = parser.validate('string');
    assert.strictEqual(result.valid, false);
  });

  test('entry with empty string errors', () => {
    const result = parser.validate({ test: '' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('no value')));
  });

  test('__meta key is excluded from count', () => {
    const result = parser.validate({ __meta: { version: 1 }, horaires: '9h-18h' });
    assert.strictEqual(result.entryCount, 1);
  });
});

describe('KBParser getSupportedFormats', () => {
  test('returns formats list', () => {
    const info = parser.getSupportedFormats();
    assert.ok(info.formats);
    assert.ok(info.details);
    assert.ok(info.details.json);
    assert.ok(info.details.csv);
    assert.ok(info.details.txt);
    assert.ok(info.details.md);
  });
});

describe('KBParser error handling', () => {
  test('throws for unsupported format', () => {
    assert.throws(
      () => parser.parseContent('data', 'xml'),
      /Unsupported format/
    );
  });

  test('handles invalid JSON', () => {
    assert.throws(() => parser.parseContent('not json', 'json'));
  });
});
