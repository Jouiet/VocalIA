#!/usr/bin/env node
/**
 * VocalIA - Knowledge Base Parser
 *
 * Multi-format KB import parser supporting:
 * - JSON (native structure)
 * - CSV (key,response,details columns)
 * - TSV (tab-separated)
 * - XLSX (Excel) via xlsx package
 * - TXT (simple Q&A format)
 * - Markdown (structured FAQ)
 *
 * Version: 1.0.0 | Session 250.45 | 02/02/2026
 */

const fs = require('fs');
const path = require('path');

// Supported formats
const SUPPORTED_FORMATS = ['json', 'csv', 'tsv', 'xlsx', 'txt', 'md', 'markdown'];

/**
 * Parse KB data from various file formats
 */
class KBParser {
  constructor() {
    this.xlsxAvailable = false;
    try {
      require.resolve('xlsx');
      this.xlsxAvailable = true;
    } catch (e) {
      console.warn('[KBParser] xlsx package not installed, Excel import disabled');
    }
  }

  /**
   * Parse file based on extension
   * @param {string} filePath - Path to file
   * @param {object} options - Parsing options
   * @returns {Array|object} Parsed data
   */
  parseFile(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const content = fs.readFileSync(filePath, 'utf8');
    return this.parseContent(content, ext, options);
  }

  /**
   * Parse content based on format
   * @param {string} content - File content
   * @param {string} format - File format (json, csv, etc.)
   * @param {object} options - Parsing options
   * @returns {Array|object} Parsed data
   */
  parseContent(content, format, options = {}) {
    const fmt = format.toLowerCase();

    switch (fmt) {
      case 'json':
        return this.parseJSON(content);
      case 'csv':
        return this.parseCSV(content, ',', options);
      case 'tsv':
        return this.parseCSV(content, '\t', options);
      case 'xlsx':
      case 'xls':
        return this.parseXLSX(content, options);
      case 'txt':
        return this.parseTXT(content, options);
      case 'md':
      case 'markdown':
        return this.parseMarkdown(content, options);
      default:
        throw new Error(`Unsupported format: ${format}. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
    }
  }

  /**
   * Parse JSON content
   */
  parseJSON(content) {
    const data = JSON.parse(content);

    // If it's already the right format, return as-is
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data;
    }

    // If it's an array, convert to object with keys
    if (Array.isArray(data)) {
      const result = {};
      for (const entry of data) {
        if (entry.key) {
          const key = entry.key;
          delete entry.key;
          result[key] = entry;
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Parse CSV/TSV content
   * Expected columns: key, response, [details as JSON], [additional columns become fields]
   */
  parseCSV(content, delimiter = ',', options = {}) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have header row and at least one data row');
    }

    // Parse header
    const headers = this.parseCSVLine(lines[0], delimiter);
    const keyIndex = headers.findIndex(h => h.toLowerCase() === 'key' || h.toLowerCase() === 'clé');
    const responseIndex = headers.findIndex(h =>
      h.toLowerCase() === 'response' || h.toLowerCase() === 'réponse' || h.toLowerCase() === 'answer'
    );

    if (keyIndex === -1) {
      throw new Error('CSV must have a "key" or "clé" column');
    }

    const result = {};
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = this.parseCSVLine(lines[i], delimiter);
      const key = this.normalizeKey(values[keyIndex]);

      if (!key) continue;

      const entry = {};

      // Add response if column exists
      if (responseIndex !== -1 && values[responseIndex]) {
        entry.response = values[responseIndex];
      }

      // Add other columns as fields
      for (let j = 0; j < headers.length; j++) {
        if (j === keyIndex || j === responseIndex) continue;
        const header = headers[j].toLowerCase();
        const value = values[j];

        if (!value) continue;

        // Try to parse as JSON for 'details' column
        if (header === 'details' || header === 'détails') {
          try {
            entry.details = JSON.parse(value);
          } catch (e) {
            entry[header] = value;
          }
        } else {
          entry[header] = value;
        }
      }

      result[key] = Object.keys(entry).length === 1 && entry.response
        ? entry.response
        : entry;
    }

    return result;
  }

  /**
   * Parse a single CSV line handling quotes
   */
  parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  }

  /**
   * Parse Excel XLSX content
   */
  parseXLSX(content, options = {}) {
    if (!this.xlsxAvailable) {
      throw new Error('xlsx package not installed. Run: npm install xlsx');
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.read(content, { type: 'string' });

    // Use first sheet or specified sheet
    const sheetName = options.sheet || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    // Convert to CSV and parse
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return this.parseCSV(csv, ',', options);
  }

  /**
   * Parse simple TXT format (Q&A style)
   * Format:
   *   Q: Question or key
   *   A: Answer or response
   *
   * Or:
   *   [key]
   *   Response text
   */
  parseTXT(content, options = {}) {
    const result = {};
    const lines = content.split('\n');

    let currentKey = null;
    let currentResponse = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Q&A format
      if (trimmed.match(/^(Q|Question|Clé|Key):\s*/i)) {
        if (currentKey && currentResponse.length) {
          result[currentKey] = currentResponse.join('\n').trim();
        }
        currentKey = this.normalizeKey(trimmed.replace(/^(Q|Question|Clé|Key):\s*/i, ''));
        currentResponse = [];
      }
      else if (trimmed.match(/^(A|Answer|Réponse|Response):\s*/i)) {
        currentResponse.push(trimmed.replace(/^(A|Answer|Réponse|Response):\s*/i, ''));
      }
      // Bracket format [key]
      else if (trimmed.match(/^\[(.+)\]$/)) {
        if (currentKey && currentResponse.length) {
          result[currentKey] = currentResponse.join('\n').trim();
        }
        currentKey = this.normalizeKey(trimmed.match(/^\[(.+)\]$/)[1]);
        currentResponse = [];
      }
      // Add to current response
      else if (currentKey && trimmed) {
        currentResponse.push(trimmed);
      }
    }

    // Save last entry
    if (currentKey && currentResponse.length) {
      result[currentKey] = currentResponse.join('\n').trim();
    }

    return result;
  }

  /**
   * Parse Markdown format (FAQ style)
   * Format:
   *   ## Key or Question
   *   Response text
   *
   *   ### Sub-key
   *   Sub-response
   */
  parseMarkdown(content, options = {}) {
    const result = {};
    const lines = content.split('\n');

    let currentKey = null;
    let currentResponse = [];
    let inCodeBlock = false;

    for (const line of lines) {
      // Track code blocks
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (currentKey) currentResponse.push(line);
        continue;
      }

      // Inside code block, just add to response
      if (inCodeBlock) {
        if (currentKey) currentResponse.push(line);
        continue;
      }

      // H2 or H3 headers become keys
      const headerMatch = line.match(/^#{2,3}\s+(.+)$/);
      if (headerMatch) {
        if (currentKey && currentResponse.length) {
          result[currentKey] = this.markdownToText(currentResponse.join('\n').trim());
        }
        currentKey = this.normalizeKey(headerMatch[1]);
        currentResponse = [];
      }
      // Regular content
      else if (currentKey) {
        currentResponse.push(line);
      }
    }

    // Save last entry
    if (currentKey && currentResponse.length) {
      result[currentKey] = this.markdownToText(currentResponse.join('\n').trim());
    }

    return result;
  }

  /**
   * Convert markdown to plain text (basic conversion)
   */
  markdownToText(md) {
    return md
      .replace(/\*\*(.+?)\*\*/g, '$1')  // Bold
      .replace(/\*(.+?)\*/g, '$1')       // Italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
      .replace(/`(.+?)`/g, '$1')          // Inline code
      .trim();
  }

  /**
   * Normalize key to valid format
   */
  normalizeKey(key) {
    return key
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')  // Remove special chars
      .replace(/\s+/g, '_')      // Spaces to underscores
      .replace(/-+/g, '_')       // Dashes to underscores
      .replace(/_+/g, '_')       // Multiple underscores to one
      .replace(/^_|_$/g, '');    // Trim underscores
  }

  /**
   * Validate parsed KB data
   */
  validate(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { valid: false, errors, warnings };
    }

    const entries = Object.entries(data).filter(([k]) => k !== '__meta');

    if (entries.length === 0) {
      warnings.push('No entries found in data');
    }

    for (const [key, value] of entries) {
      // Check key format
      if (!/^[a-z0-9_]+$/.test(key)) {
        warnings.push(`Key "${key}" should only contain lowercase letters, numbers, and underscores`);
      }

      // Check value
      if (!value) {
        errors.push(`Entry "${key}" has no value`);
      }

      // Check response exists for objects
      if (typeof value === 'object' && !value.response && Object.keys(value).length === 0) {
        warnings.push(`Entry "${key}" is empty object`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      entryCount: entries.length
    };
  }

  /**
   * Get supported formats info
   */
  getSupportedFormats() {
    return {
      formats: SUPPORTED_FORMATS,
      details: {
        json: {
          extension: '.json',
          description: 'JSON object or array',
          example: '{"horaires": {"response": "Ouvert 9h-18h"}}'
        },
        csv: {
          extension: '.csv',
          description: 'Comma-separated with header: key,response,[details]',
          example: 'key,response\nhoraires,"Ouvert 9h-18h"'
        },
        tsv: {
          extension: '.tsv',
          description: 'Tab-separated version of CSV',
          example: 'key\\tresponse\\nhoraires\\tOuvert 9h-18h'
        },
        xlsx: {
          extension: '.xlsx',
          description: 'Excel spreadsheet (first sheet, same format as CSV)',
          available: this.xlsxAvailable
        },
        txt: {
          extension: '.txt',
          description: 'Q&A format: "Q: key" followed by "A: response"',
          example: 'Q: Quels sont vos horaires?\nA: Nous sommes ouverts de 9h à 18h.'
        },
        md: {
          extension: '.md',
          description: 'Markdown with ## headers as keys',
          example: '## Horaires\nNous sommes ouverts de 9h à 18h.'
        }
      }
    };
  }
}

// Singleton
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new KBParser();
  }
  return instance;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
VocalIA KB Parser

Usage:
  node kb-parser.cjs [options] <file>

Options:
  --help              Show this help
  --formats           List supported formats
  --validate          Validate parsed data
  --output <file>     Write result to file

Examples:
  node kb-parser.cjs data.csv
  node kb-parser.cjs --validate faq.md
  node kb-parser.cjs --output kb.json data.xlsx
`);
    process.exit(0);
  }

  const parser = getInstance();

  if (args.includes('--formats')) {
    console.log('\n📋 Supported Formats:');
    const info = parser.getSupportedFormats();
    for (const [fmt, details] of Object.entries(info.details)) {
      console.log(`\n  ${fmt.toUpperCase()} (${details.extension})`);
      console.log(`    ${details.description}`);
      if (details.example) {
        console.log(`    Example: ${details.example.slice(0, 60)}...`);
      }
      if (details.available === false) {
        console.log(`    ⚠️ Not available (install xlsx package)`);
      }
    }
    process.exit(0);
  }

  // Get file argument
  const fileArg = args.find(a => !a.startsWith('--'));
  if (!fileArg) {
    console.error('Error: No file specified');
    process.exit(1);
  }

  if (!fs.existsSync(fileArg)) {
    console.error(`Error: File not found: ${fileArg}`);
    process.exit(1);
  }

  try {
    const result = parser.parseFile(fileArg);
    console.log('\n📊 Parsed KB:');
    console.log(JSON.stringify(result, null, 2));

    if (args.includes('--validate')) {
      const validation = parser.validate(result);
      console.log('\n✅ Validation:');
      console.log(`  Valid: ${validation.valid}`);
      console.log(`  Entries: ${validation.entryCount}`);
      if (validation.errors.length) {
        console.log(`  Errors: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length) {
        console.log(`  Warnings: ${validation.warnings.join(', ')}`);
      }
    }

    const outputIdx = args.indexOf('--output');
    if (outputIdx !== -1 && args[outputIdx + 1]) {
      const outputFile = args[outputIdx + 1];
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`\n✅ Written to: ${outputFile}`);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

module.exports = {
  KBParser,
  getInstance,
  SUPPORTED_FORMATS
};
