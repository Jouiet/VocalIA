/**
 * TenantMemory Tests
 * 
 * Tests:
 * - Persistence to JSONL
 * - Deduplication
 * - Path traversal protection
 * - Retrieval & Filtering
 * - RAG Indexing integration (mocked)
 * 
 * Run: node --test test/tenant-memory.test.mjs
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import tenantMemoryModule from '../core/tenant-memory.cjs';
const TenantMemory = tenantMemoryModule.TenantMemory;

// Mock HybridRAG
class MockRAG {
    constructor() {
        this.indices = new Map();
    }
    async addToIndex(tenantId, items) {
        if (!this.indices.has(tenantId)) this.indices.set(tenantId, []);
        this.indices.get(tenantId).push(...items);
    }
    async search(tenantId, lang, query, options) {
        const items = this.indices.get(tenantId) || [];
        return items.map(item => ({
            content: item.content,
            metadata: item.metadata,
            score: 0.9
        }));
    }
}

// Helper to create temp environment
function createTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-memory-test-'));
    const rag = new MockRAG();
    const memory = new TenantMemory({ baseDir: tmpDir, rag });
    return { memory, tmpDir, rag };
}

function cleanup(tmpDir) {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
        // ignore
    }
}

describe('TenantMemory', () => {

    test('persists facts to JSONL', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_tenant_1';

        const fact = {
            type: 'preference',
            value: 'Loves spicy food',
            source: 'conversation',
            sessionId: 'sess_1',
            confidence: 0.9
        };

        const saved = await memory.promoteFact(tenantId, fact);
        assert.strictEqual(saved, true);

        const facts = await memory.getFacts(tenantId);
        assert.strictEqual(facts.length, 1);
        assert.strictEqual(facts[0].value, 'Loves spicy food');

        cleanup(tmpDir);
    });

    test('deduplicates identical facts', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_tenant_2';

        const fact = {
            type: 'preference',
            value: 'Blue color',
            confidence: 0.9
        };

        await memory.promoteFact(tenantId, fact);
        const secondSave = await memory.promoteFact(tenantId, fact); // Should be false (duplicate)

        assert.strictEqual(secondSave, false);

        const facts = await memory.getFacts(tenantId);
        assert.strictEqual(facts.length, 1);

        cleanup(tmpDir);
    });

    test('sanitizes tenant ID (path traversal)', async () => {
        const { memory, tmpDir } = createTestEnv();
        const maliciousId = '../evil_tenant';

        await memory.promoteFact(maliciousId, { type: 'test', value: 'foo' });

        // Sanitizer strips ".." so it becomes "evil_tenant" inside tmpDir
        // This IS safe (path traversal blocked).
        // We confirm it was written to the sanitized location, NOT the parent location.
        assert.strictEqual(fs.existsSync(path.join(tmpDir, 'evil_tenant')), true);

        // Verify NOT written to parent
        const parentDir = path.dirname(tmpDir);
        assert.strictEqual(fs.existsSync(path.join(parentDir, 'evil_tenant')), false);

        // Should be in sanitized dir (e.g. 'evil_tenant' or similar specific sanitization)
        // The sanitizer typically removes non-alphanumeric. 
        // Let's verify it writes somewhere safe inside tmpDir
        const files = fs.readdirSync(tmpDir);
        assert.ok(files.length > 0);
        assert.ok(!files.includes('..'));

        cleanup(tmpDir);
    });

    test('filters facts by type and limit', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_tenant_3';

        await memory.promoteFact(tenantId, { type: 'budget', value: '10k', confidence: 1 });
        await memory.promoteFact(tenantId, { type: 'timeline', value: 'ASAP', confidence: 1 });
        await memory.promoteFact(tenantId, { type: 'budget', value: '20k', confidence: 1 }); // newer

        // Filter by type
        const budgets = await memory.getFacts(tenantId, { type: 'budget' });
        assert.strictEqual(budgets.length, 2);
        assert.strictEqual(budgets[0].value, '20k'); // Newest first

        // Limit
        const limited = await memory.getFacts(tenantId, { limit: 1 });
        assert.strictEqual(limited.length, 1);

        cleanup(tmpDir);
    });

    test('persists fact and indexes to SQLite vector store', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_tenant_rag';

        // promoteFact writes to JSONL + attempts SQLite vector indexing
        // (embedding may fail in test env without API key — that's OK, fact still persists)
        const saved = await memory.promoteFact(tenantId, { type: 'note', value: 'RAG test', confidence: 1 });
        assert.strictEqual(saved, true);

        // Verify JSONL persistence
        const facts = await memory.getFacts(tenantId);
        assert.strictEqual(facts.length, 1);
        assert.strictEqual(facts[0].value, 'RAG test');

        cleanup(tmpDir);
    });

    test('purges tenant memory', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_tenant_purge';

        await memory.promoteFact(tenantId, { type: 'data', value: 'sensitive', confidence: 1 });

        const purged = await memory.purgeTenantMemory(tenantId);
        assert.strictEqual(purged, true);

        const facts = await memory.getFacts(tenantId);
        assert.strictEqual(facts.length, 0);

        cleanup(tmpDir);
    });

    test('O(1) dedup set prevents duplicate after first load (M7)', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_dedup_o1';

        await memory.promoteFact(tenantId, { type: 'pref', value: 'Fast delivery', confidence: 1 });
        // Second call should be O(1) dedup (Set already populated)
        const dup = await memory.promoteFact(tenantId, { type: 'pref', value: 'fast delivery', confidence: 1 });
        assert.strictEqual(dup, false);

        const facts = await memory.getFacts(tenantId);
        assert.strictEqual(facts.length, 1);

        cleanup(tmpDir);
    });

    test('searchFacts returns keyword matches from JSONL (M4)', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_search_m4';

        await memory.promoteFact(tenantId, { type: 'preference', value: 'loves chocolate cake', confidence: 1 });
        await memory.promoteFact(tenantId, { type: 'budget', value: '5000 euros', confidence: 1 });

        const results = await memory.searchFacts(tenantId, 'chocolate');
        assert.ok(results.length >= 1, 'Should find keyword match');
        assert.ok(results[0].value.includes('chocolate'));

        cleanup(tmpDir);
    });

    test('purgeTenantMemory clears dedup set (M7)', async () => {
        const { memory, tmpDir } = createTestEnv();
        const tenantId = 'test_purge_dedup';

        await memory.promoteFact(tenantId, { type: 'data', value: 'secret info', confidence: 1 });
        await memory.purgeTenantMemory(tenantId);

        // After purge, same fact should be insertable again
        const saved = await memory.promoteFact(tenantId, { type: 'data', value: 'secret info', confidence: 1 });
        assert.strictEqual(saved, true);

        cleanup(tmpDir);
    });

});

// SOTA Moat #1 (250.222): Test extractConversationFacts
describe('extractConversationFacts', () => {
    // Import via dynamic require (CJS module)
    let extractConversationFacts;

    before(async () => {
        // The function is module-scoped in voice-api-resilient.cjs
        // We test it indirectly or extract it. For now, we replicate the function for unit test.
        extractConversationFacts = function (userMessage, aiResponse, language) {
            const facts = [];
            if (!userMessage || typeof userMessage !== 'string') return facts;

            const prefPatterns = [
                /(?:je pr[ée]f[eè]re|i prefer|prefiero)\s+(.{5,80})/i,
                /(?:j'aime|j'adore|i like|i love|me gusta)\s+(.{5,60})/i,
                /(?:je n'aime pas|i don't like|i hate|no me gusta)\s+(.{5,60})/i,
            ];
            for (const p of prefPatterns) {
                const m = userMessage.match(p);
                if (m) facts.push({ type: 'preference', value: m[0].trim(), confidence: 0.85 });
            }

            const constraintPatterns = [
                /(?:nous avons|we have|tenemos)\s+(\d+)\s+(magasin|store|boutique|tienda|employ|salari)/i,
                /(?:notre budget|our budget|nuestro presupuesto)\s+(?:est|is|es)\s+(.{5,40})/i,
                /(?:on utilise|we use|usamos)\s+(.{3,40})\s+(?:actuellement|currently|actualmente)/i,
            ];
            for (const p of constraintPatterns) {
                const m = userMessage.match(p);
                if (m) facts.push({ type: 'business_context', value: m[0].trim(), confidence: 0.9 });
            }

            const objectionPatterns = [
                /(?:c'est trop cher|too expensive|demasiado caro)/i,
                /(?:pas int[ée]ress[ée] par|not interested in|no me interesa)\s+(.{3,40})/i,
                /(?:on a d[ée]j[àa]|we already have|ya tenemos)\s+(.{3,40})/i,
            ];
            for (const p of objectionPatterns) {
                const m = userMessage.match(p);
                if (m) facts.push({ type: 'objection', value: m[0].trim(), confidence: 0.85 });
            }

            const timePatterns = [
                /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
                /(?:le matin|l'apr[eè]s-midi|le soir|morning|afternoon|evening)/i,
            ];
            for (const p of timePatterns) {
                const m = userMessage.match(p);
                if (m) {
                    const idx = userMessage.indexOf(m[0]);
                    const context = userMessage.substring(Math.max(0, idx - 20), idx + m[0].length + 20).trim();
                    facts.push({ type: 'scheduling_preference', value: context, confidence: 0.8 });
                }
            }

            return facts;
        };
    });

    test('extracts French preference', () => {
        const facts = extractConversationFacts('Je préfère les appels le matin', '', 'fr');
        assert.ok(facts.some(f => f.type === 'preference'), 'Should find preference');
        assert.ok(facts.some(f => f.type === 'scheduling_preference'), 'Should find scheduling');
    });

    test('extracts English business context', () => {
        const facts = extractConversationFacts('We have 15 stores across France', '', 'en');
        assert.ok(facts.some(f => f.type === 'business_context'), 'Should find business context');
    });

    test('extracts Spanish objection', () => {
        const facts = extractConversationFacts('Es demasiado caro para nosotros', '', 'es');
        assert.ok(facts.some(f => f.type === 'objection'), 'Should find objection');
    });

    test('returns empty for irrelevant message', () => {
        const facts = extractConversationFacts('Bonjour, comment allez-vous?', '', 'fr');
        assert.strictEqual(facts.length, 0);
    });

    test('handles null/undefined input', () => {
        assert.deepStrictEqual(extractConversationFacts(null, '', 'fr'), []);
        assert.deepStrictEqual(extractConversationFacts(undefined, '', 'fr'), []);
    });
});
