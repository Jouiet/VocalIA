#!/usr/bin/env node
/**
 * EMPIRICAL TEST: SOTA Sync Pipeline
 * 
 * Verifies that TenantMemory.syncKBEntry actually:
 * 1. Accepts a KB entry
 * 2. Generates an embedding (or handles missing API key gracefully) 
 * 3. Stores it in SimpleVectorStore (SQLite)
 * 4. Can be retrieved from SimpleVectorStore
 * 
 * Also tests:
 * 5. TenantMemory.deleteKBEntry removes from SQLite
 * 6. TenantMemory.getInstance() returns a singleton
 */

const path = require('path');
const fs = require('fs');

// Test results tracker
let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

function skip(testName, reason) {
    console.log(`  ⏭️  SKIP: ${testName} — ${reason}`);
    skipped++;
}

(async () => {
    console.log('\n═══════════════════════════════════════');
    console.log('  SOTA SYNC PIPELINE — EMPIRICAL TEST');
    console.log('═══════════════════════════════════════\n');

    // ─── Test 1: Module Loading ───
    console.log('1. Module Loading');
    let TenantMemory, SimpleVectorStore, EmbeddingService;
    try {
        TenantMemory = require('../core/tenant-memory.cjs');
        assert(typeof TenantMemory === 'function', 'TenantMemory loads as constructor');
    } catch (e) {
        console.log(`  ❌ FAIL: TenantMemory load failed: ${e.message}`);
        failed++;
        process.exit(1);
    }

    try {
        SimpleVectorStore = require('../core/memory/SimpleVectorStore.cjs');
        assert(typeof SimpleVectorStore === 'function', 'SimpleVectorStore loads as constructor');
    } catch (e) {
        console.log(`  ❌ FAIL: SimpleVectorStore load failed: ${e.message}`);
        failed++;
        process.exit(1);
    }

    try {
        EmbeddingService = require('../core/knowledge-embedding-service.cjs');
        assert(typeof EmbeddingService === 'object', 'EmbeddingService loads as singleton');
    } catch (e) {
        console.log(`  ❌ FAIL: EmbeddingService load failed: ${e.message}`);
        failed++;
        process.exit(1);
    }

    // ─── Test 2: Singleton Pattern ───
    console.log('\n2. Singleton Pattern');
    assert(typeof TenantMemory.getInstance === 'function', 'TenantMemory.getInstance exists');

    const instance1 = TenantMemory.getInstance();
    const instance2 = TenantMemory.getInstance();
    assert(instance1 === instance2, 'getInstance returns same instance');
    assert(instance1 instanceof TenantMemory, 'Instance is TenantMemory type');

    // ─── Test 3: Method Existence ───
    console.log('\n3. Method Existence');
    assert(typeof instance1.syncKBEntry === 'function', 'syncKBEntry method exists');
    assert(typeof instance1.deleteKBEntry === 'function', 'deleteKBEntry method exists');
    assert(typeof instance1.promoteFact === 'function', 'promoteFact method exists');
    assert(typeof instance1.getFacts === 'function', 'getFacts method exists');
    assert(typeof instance1.searchFacts === 'function', 'searchFacts method exists');
    assert(typeof instance1.purgeTenantMemory === 'function', 'purgeTenantMemory method exists');
    assert(typeof instance1.getStats === 'function', 'getStats method exists');

    // ─── Test 4: SimpleVectorStore Direct ───
    console.log('\n4. SimpleVectorStore Direct (SQLite)');
    const testTenantId = '__test_sota_sync__';
    const store = new SimpleVectorStore(testTenantId);
    assert(store !== null, 'Store created for test tenant');

    // Test upsert with a fake vector (768 dimensions like Gemini)
    const fakeVector = new Float32Array(768);
    for (let i = 0; i < 768; i++) fakeVector[i] = Math.random() - 0.5;

    store.upsert('test_key_1', 'This is a test KB entry about pricing', {
        source: 'knowledge_base',
        type: 'kb_entry',
        language: 'fr'
    }, fakeVector);
    assert(true, 'Upsert with vector completed without error');

    // Verify retrieval
    const retrieved = store.get('test_key_1');
    assert(retrieved !== null, 'Retrieved entry is not null');
    assert(retrieved.text === 'This is a test KB entry about pricing', 'Retrieved text matches');
    assert(retrieved.metadata.source === 'knowledge_base', 'Retrieved metadata.source matches');

    // Test search
    const searchResults = await store.search(fakeVector, 5);
    assert(Array.isArray(searchResults), 'Search returns array');
    assert(searchResults.length > 0, 'Search returns at least 1 result');
    assert(searchResults[0].id === 'test_key_1', 'Search top result matches inserted key');
    assert(searchResults[0].score > 0.99, `Search score is high (${searchResults[0].score.toFixed(4)})`);

    // Test delete
    store.delete('test_key_1');
    const deletedEntry = store.get('test_key_1');
    assert(deletedEntry === null || deletedEntry === undefined, 'Deleted entry is gone');

    // Close and cleanup
    store.close();

    // ─── Test 5: TenantMemory.syncKBEntry (Full Pipeline) ───
    console.log('\n5. TenantMemory.syncKBEntry (Full Pipeline)');

    const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    console.log(`   API Key present: ${hasApiKey}`);

    if (hasApiKey) {
        const syncResult = await instance1.syncKBEntry(testTenantId, 'test_pricing', {
            response: 'Notre tarif standard est de 299 MAD/mois.'
        }, 'fr');
        assert(syncResult === true, 'syncKBEntry returned true');

        // Verify it's in the vector store
        const verifyStore = new SimpleVectorStore(testTenantId);
        const verifyEntry = verifyStore.get('kb_fr_test_pricing');
        assert(verifyEntry !== null, 'Entry found in SQLite after syncKBEntry');
        if (verifyEntry) {
            assert(verifyEntry.text.includes('299 MAD'), 'Stored text contains expected content');
        }

        // Test delete
        const deleteResult = await instance1.deleteKBEntry(testTenantId, 'test_pricing', 'fr');
        assert(deleteResult === true, 'deleteKBEntry returned true');

        const afterDelete = verifyStore.get('kb_fr_test_pricing');
        assert(afterDelete === null || afterDelete === undefined, 'Entry removed from SQLite after deleteKBEntry');

        verifyStore.close();
    } else {
        skip('syncKBEntry full pipeline', 'GEMINI_API_KEY not set');
        skip('Verify SQLite after sync', 'GEMINI_API_KEY not set');
        skip('deleteKBEntry pipeline', 'GEMINI_API_KEY not set');
        skip('Verify SQLite after delete', 'GEMINI_API_KEY not set');
    }

    // ─── Test 6: db-api.cjs Import Check ───
    console.log('\n6. db-api.cjs Integration Verification');
    const dbApiSource = fs.readFileSync(path.join(__dirname, '../core/db-api.cjs'), 'utf8');

    // Verify TenantMemory is imported
    assert(dbApiSource.includes("require('./tenant-memory.cjs')"), 'db-api.cjs imports TenantMemory');

    // Verify syncKBEntry is called in POST KB endpoint
    assert(dbApiSource.includes('TenantMemory.getInstance().syncKBEntry'), 'db-api.cjs calls syncKBEntry on KB create');

    // Verify deleteKBEntry is called in DELETE KB endpoint  
    assert(dbApiSource.includes('TenantMemory.getInstance().deleteKBEntry'), 'db-api.cjs calls deleteKBEntry on KB delete');

    // Verify KnowledgeIngestion replaced KBCrawler
    assert(dbApiSource.includes("require('./ingestion/KnowledgeIngestion.cjs')"), 'db-api.cjs uses KnowledgeIngestion');
    assert(!dbApiSource.includes("require('./kb-crawler.cjs')"), 'db-api.cjs no longer uses KBCrawler (legacy removed)');

    // ─── Test 7: HybridRAG loads cleanly ───
    console.log('\n7. HybridRAG Module Integrity');
    try {
        const HybridRAG = require('../core/hybrid-rag.cjs');
        assert(typeof HybridRAG.HybridRAG === 'function' || typeof HybridRAG === 'function', 'HybridRAG loads without error');
    } catch (e) {
        console.log(`  ❌ FAIL: HybridRAG load failed: ${e.message}`);
        failed++;
    }

    // ─── Cleanup Test SQLite ───
    console.log('\n8. Cleanup');
    const testDbPath = path.join(__dirname, '../data/memory', testTenantId);
    try {
        if (fs.existsSync(testDbPath)) {
            fs.rmSync(testDbPath, { recursive: true, force: true });
            console.log('  🧹 Test data cleaned up');
        }
    } catch (e) {
        console.log(`  ⚠️ Cleanup warning: ${e.message}`);
    }

    // ─── Summary ───
    console.log('\n═══════════════════════════════════════');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log('═══════════════════════════════════════\n');

    if (failed > 0) {
        console.log('❌ TEST SUITE FAILED');
        process.exit(1);
    } else {
        console.log('✅ TEST SUITE PASSED');
        process.exit(0);
    }
})().catch(e => {
    console.error('FATAL ERROR:', e);
    process.exit(1);
});
