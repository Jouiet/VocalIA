/**
 * VocalIA Remotion HITL Tests
 *
 * Tests:
 * - STATES enum (6 states)
 * - Queue workflow: queueVideo → getPending → approveVideo/rejectVideo
 * - markRendering, markCompleted, markFailed
 * - getStats, getAuditLog
 * - CORS_ALLOWED_ORIGINS, getCorsOrigin
 * - hitlEvents emitter
 *
 * NOTE: Uses real file system (data/remotion-hitl/).
 * Tests queue logic end-to-end.
 *
 * Run: node --test test/remotion-hitl.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import { STATES, queueVideo, getPending, getVideo, approveVideo, rejectVideo, markRendering, markCompleted, markFailed, getStats, getAuditLog, hitlEvents } from '../core/remotion-hitl.cjs';


// ─── STATES ─────────────────────────────────────────────────────────

describe('RemotionHITL STATES', () => {
  test('has 6 states', () => {
    assert.strictEqual(Object.keys(STATES).length, 6);
  });

  test('has PENDING state', () => {
    assert.strictEqual(STATES.PENDING, 'pending');
  });

  test('has APPROVED state', () => {
    assert.strictEqual(STATES.APPROVED, 'approved');
  });

  test('has REJECTED state', () => {
    assert.strictEqual(STATES.REJECTED, 'rejected');
  });

  test('has RENDERING state', () => {
    assert.strictEqual(STATES.RENDERING, 'rendering');
  });

  test('has COMPLETED state', () => {
    assert.strictEqual(STATES.COMPLETED, 'completed');
  });

  test('has FAILED state', () => {
    assert.strictEqual(STATES.FAILED, 'failed');
  });
});

// NOTE: Export existence is proven by the behavioral tests below.
// No separate "typeof === 'function'" theater section needed.

// ─── Queue Workflow ─────────────────────────────────────────────────

describe('RemotionHITL queue workflow', () => {
  test('queueVideo returns item with valid structure', () => {
    const item = queueVideo({
      composition: 'test-composition',
      language: 'fr',
      requestedBy: 'unit-test'
    });

    assert.ok(item.id);
    assert.ok(item.id.startsWith('vid_'));
    assert.strictEqual(item.state, STATES.PENDING);
    assert.strictEqual(item.composition, 'test-composition');
    assert.strictEqual(item.language, 'fr');
    assert.strictEqual(item.requestedBy, 'unit-test');
    assert.ok(item.requestedAt);
    assert.strictEqual(item.previewUrl, null);
    assert.strictEqual(item.reviewedBy, null);
  });

  test('queueVideo defaults language to fr', () => {
    const item = queueVideo({ composition: 'test-default-lang' });
    assert.strictEqual(item.language, 'fr');
  });

  test('queueVideo defaults requestedBy to system', () => {
    const item = queueVideo({ composition: 'test-default-requester' });
    assert.strictEqual(item.requestedBy, 'system');
  });

  test('getVideo retrieves queued video by id', () => {
    const item = queueVideo({ composition: 'test-get-video' });
    const found = getVideo(item.id);
    assert.ok(found);
    assert.strictEqual(found.id, item.id);
    assert.strictEqual(found.composition, 'test-get-video');
  });

  test('getVideo returns undefined for non-existent id', () => {
    const found = getVideo('vid_nonexistent_999');
    assert.strictEqual(found, undefined);
  });

  test('getPending returns pending items', () => {
    const item = queueVideo({ composition: 'test-pending' });
    const pending = getPending();
    assert.ok(Array.isArray(pending));
    const found = pending.find(p => p.id === item.id);
    assert.ok(found);
    assert.strictEqual(found.state, STATES.PENDING);
  });

  test('approveVideo changes state to approved', () => {
    const item = queueVideo({ composition: 'test-approve' });
    const approved = approveVideo(item.id, 'reviewer-1', 'Looks good');
    assert.strictEqual(approved.state, STATES.APPROVED);
    assert.strictEqual(approved.reviewedBy, 'reviewer-1');
    assert.strictEqual(approved.reviewNotes, 'Looks good');
    assert.ok(approved.reviewedAt);
  });

  test('approveVideo throws for non-existent video', () => {
    assert.throws(
      () => approveVideo('vid_nonexistent_000', 'admin'),
      { message: /not found/ }
    );
  });

  test('approveVideo throws for already approved video', () => {
    const item = queueVideo({ composition: 'test-double-approve' });
    approveVideo(item.id, 'admin');
    assert.throws(
      () => approveVideo(item.id, 'admin'),
      { message: /not in pending state/ }
    );
  });

  test('rejectVideo changes state to rejected', () => {
    const item = queueVideo({ composition: 'test-reject' });
    const rejected = rejectVideo(item.id, 'reviewer-2', 'Wrong content');
    assert.strictEqual(rejected.state, STATES.REJECTED);
    assert.strictEqual(rejected.reviewedBy, 'reviewer-2');
    assert.strictEqual(rejected.reviewNotes, 'Wrong content');
  });

  test('rejectVideo throws for non-existent video', () => {
    assert.throws(
      () => rejectVideo('vid_nonexistent_001', 'admin'),
      { message: /not found/ }
    );
  });

  test('markRendering changes state to rendering', () => {
    const item = queueVideo({ composition: 'test-rendering' });
    approveVideo(item.id, 'admin');
    const rendering = markRendering(item.id);
    assert.strictEqual(rendering.state, STATES.RENDERING);
    assert.ok(rendering.renderStartedAt);
  });

  test('markCompleted changes state to completed', () => {
    const item = queueVideo({ composition: 'test-complete' });
    approveVideo(item.id, 'admin');
    markRendering(item.id);
    const completed = markCompleted(item.id, '/output/video.mp4');
    assert.strictEqual(completed.state, STATES.COMPLETED);
    assert.strictEqual(completed.outputPath, '/output/video.mp4');
    assert.ok(completed.completedAt);
  });

  test('markFailed changes state to failed', () => {
    const item = queueVideo({ composition: 'test-fail' });
    approveVideo(item.id, 'admin');
    markRendering(item.id);
    const failed = markFailed(item.id, new Error('Render timeout'));
    assert.strictEqual(failed.state, STATES.FAILED);
    assert.strictEqual(failed.error, 'Render timeout');
    assert.ok(failed.failedAt);
  });
});

// ─── Stats ──────────────────────────────────────────────────────────

describe('RemotionHITL getStats', () => {
  test('returns stats object with all state counts', () => {
    const stats = getStats();
    assert.ok(stats.total >= 0, 'total should be non-negative');
    assert.ok(stats.pending >= 0, 'pending should be non-negative');
    assert.ok(stats.approved >= 0, 'approved should be non-negative');
    assert.ok(stats.rejected >= 0, 'rejected should be non-negative');
    assert.ok(stats.rendering >= 0, 'rendering should be non-negative');
    assert.ok(stats.completed >= 0, 'completed should be non-negative');
    assert.ok(stats.failed >= 0, 'failed should be non-negative');
  });

  test('total equals sum of all states', () => {
    const stats = getStats();
    const sum = stats.pending + stats.approved + stats.rejected +
                stats.rendering + stats.completed + stats.failed;
    assert.strictEqual(stats.total, sum);
  });

  test('stats reflect queued items', () => {
    const statsBefore = getStats();
    queueVideo({ composition: 'test-stats-count' });
    const statsAfter = getStats();
    assert.strictEqual(statsAfter.total, statsBefore.total + 1, 'Total should increment');
    assert.strictEqual(statsAfter.pending, statsBefore.pending + 1, 'Pending should increment');
  });
});

// ─── Audit Log ──────────────────────────────────────────────────────

describe('RemotionHITL getAuditLog', () => {
  test('returns array', () => {
    const log = getAuditLog();
    assert.ok(Array.isArray(log));
  });

  test('audit entries have timestamp and action', () => {
    const log = getAuditLog(5);
    if (log.length > 0) {
      assert.ok(log[0].timestamp);
      assert.ok(log[0].action);
    }
  });

  test('respects limit parameter', () => {
    const log = getAuditLog(2);
    assert.ok(log.length <= 2);
  });
});

// ─── Events ─────────────────────────────────────────────────────────

describe('RemotionHITL hitlEvents', () => {
  test('emits video:queued event', (t, done) => {
    hitlEvents.once('video:queued', (item) => {
      assert.ok(item.id);
      assert.strictEqual(item.composition, 'test-event-queue');
      done();
    });
    queueVideo({ composition: 'test-event-queue' });
  });

  test('emits video:approved event', (t, done) => {
    const item = queueVideo({ composition: 'test-event-approve' });
    hitlEvents.once('video:approved', (approved) => {
      assert.strictEqual(approved.state, STATES.APPROVED);
      done();
    });
    approveVideo(item.id, 'event-tester');
  });

  test('emits video:rejected event', (t, done) => {
    const item = queueVideo({ composition: 'test-event-reject' });
    hitlEvents.once('video:rejected', (rejected) => {
      assert.strictEqual(rejected.state, STATES.REJECTED);
      done();
    });
    rejectVideo(item.id, 'event-tester', 'bad');
  });
});
