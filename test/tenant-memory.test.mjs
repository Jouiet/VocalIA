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
import TenantMemory from '../core/tenant-memory.cjs';

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

    test('integrates with HybridRAG', async () => {
        const { memory, tmpDir, rag } = createTestEnv();
        const tenantId = 'test_tenant_rag';

        await memory.promoteFact(tenantId, { type: 'note', value: 'RAG test', confidence: 1 });

        // Check mock RAG
        const index = rag.indices.get(tenantId);
        assert.ok(index);
        assert.strictEqual(index.length, 1);
        assert.ok(index[0].content.includes('RAG test'));
        assert.strictEqual(index[0].metadata.source, 'tenant_memory');

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

});
