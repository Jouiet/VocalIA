/**
 * Video Services — Integration Tests
 * VocalIA — Session 250.208b
 *
 * Tests HITL queue integration for 3 video services:
 *   - kling-service.cjs: queueAdVideo (HITL entry creation)
 *   - veo-service.cjs: queueAdVideo (HITL entry creation)
 *   - remotion-service.cjs: queueForApproval, processApproved (validation)
 *
 * NOT tested (requires external deps):
 *   - renderComposition, renderAll, etc. (Remotion not installed)
 *   - generateApproved, getTaskStatus (Python bridges + API keys)
 *   - _downloadVideo (GCS access)
 *
 * Uses real HITL queue (data/remotion-hitl/).
 *
 * Run: node --test test/video-services.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const kling = require('../core/kling-service.cjs');
const veo = require('../core/veo-service.cjs');
const { queueForApproval, processApproved, COMPOSITIONS } = require('../core/remotion-service.cjs');
const hitl = require('../core/remotion-hitl.cjs');

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Kling Service — queueAdVideo
// ═══════════════════════════════════════════════════════════════════════════════

describe('KlingService.queueAdVideo()', () => {
  it('queues video with defaults', async () => {
    const item = await kling.queueAdVideo('A woman using VocalIA voice assistant');
    assert.ok(item.id.startsWith('vid_'), `Expected vid_ prefix, got ${item.id}`);
    assert.equal(item.type, 'kling_video');
    assert.equal(item.composition, 'KlingAd');
    assert.equal(item.language, 'fr');
    assert.equal(item.requestedBy, 'admin');
    assert.equal(item.state, 'pending');
  });

  it('propagates custom language and requestedBy', async () => {
    const item = await kling.queueAdVideo('Test prompt', {
      language: 'en',
      requestedBy: 'test-user'
    });
    assert.equal(item.language, 'en');
    assert.equal(item.requestedBy, 'test-user');
  });

  it('propagates props (prompt, duration, aspectRatio, mode, negativePrompt)', async () => {
    const item = await kling.queueAdVideo('Cinematic shot', {
      duration: 10,
      aspectRatio: '9:16',
      mode: 'standard',
      negativePrompt: 'blurry'
    });
    assert.equal(item.props.prompt, 'Cinematic shot');
    assert.equal(item.props.duration, 10);
    assert.equal(item.props.aspectRatio, '9:16');
    assert.equal(item.props.mode, 'standard');
    assert.equal(item.props.negativePrompt, 'blurry');
    assert.equal(item.props.reference, 'VocalIA_Ads_2026');
  });

  it('returns item retrievable via hitl.getVideo', async () => {
    const item = await kling.queueAdVideo('Retrieve test');
    const found = hitl.getVideo(item.id);
    assert.ok(found, 'Should find queued video');
    assert.equal(found.id, item.id);
    assert.equal(found.type, 'kling_video');
  });

  it('defaults duration=5, aspectRatio=16:9, mode=pro', async () => {
    const item = await kling.queueAdVideo('Defaults test');
    assert.equal(item.props.duration, 5);
    assert.equal(item.props.aspectRatio, '16:9');
    assert.equal(item.props.mode, 'pro');
    assert.equal(item.props.negativePrompt, '');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Veo Service — queueAdVideo
// ═══════════════════════════════════════════════════════════════════════════════

describe('VeoService.queueAdVideo()', () => {
  it('queues video with defaults', async () => {
    const item = await veo.queueAdVideo('A business owner talking to VocalIA');
    assert.ok(item.id.startsWith('vid_'), `Expected vid_ prefix, got ${item.id}`);
    assert.equal(item.type, 'veo_video');
    assert.equal(item.composition, 'VeoAd');
    assert.equal(item.language, 'fr');
    assert.equal(item.requestedBy, 'admin');
    assert.equal(item.state, 'pending');
  });

  it('propagates custom options', async () => {
    const item = await veo.queueAdVideo('Test prompt', {
      language: 'ar',
      requestedBy: 'qa-bot',
      aspectRatio: '9:16',
      resolution: '720p',
      duration: 4,
      generateAudio: false,
      negativePrompt: 'text overlay'
    });
    assert.equal(item.language, 'ar');
    assert.equal(item.requestedBy, 'qa-bot');
    assert.equal(item.props.aspectRatio, '9:16');
    assert.equal(item.props.resolution, '720p');
    assert.equal(item.props.duration, 4);
    assert.equal(item.props.generateAudio, false);
    assert.equal(item.props.negativePrompt, 'text overlay');
    assert.equal(item.props.reference, 'VocalIA_Veo31_Ads');
  });

  it('defaults resolution=1080p, duration=8, generateAudio=true', async () => {
    const item = await veo.queueAdVideo('Defaults test');
    assert.equal(item.props.resolution, '1080p');
    assert.equal(item.props.duration, 8);
    assert.equal(item.props.generateAudio, true);
    assert.equal(item.props.aspectRatio, '16:9');
    assert.equal(item.props.negativePrompt, '');
  });

  it('returns item retrievable via hitl.getVideo', async () => {
    const item = await veo.queueAdVideo('Retrieve test veo');
    const found = hitl.getVideo(item.id);
    assert.ok(found, 'Should find queued video');
    assert.equal(found.id, item.id);
    assert.equal(found.type, 'veo_video');
  });

  it('prompt stored in props', async () => {
    const item = await veo.queueAdVideo('VocalIA transforms customer service');
    assert.equal(item.props.prompt, 'VocalIA transforms customer service');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Remotion Service — queueForApproval
// ═══════════════════════════════════════════════════════════════════════════════

describe('RemotionService.queueForApproval()', () => {
  it('queues valid composition (demo)', async () => {
    const item = await queueForApproval('demo');
    assert.ok(item.id.startsWith('vid_'));
    assert.equal(item.composition, 'demo');
    assert.equal(item.language, 'fr');
    assert.equal(item.requestedBy, 'admin');
    assert.equal(item.state, 'pending');
  });

  it('throws for unknown composition', async () => {
    await assert.rejects(
      () => queueForApproval('nonexistent_composition_xyz'),
      { message: /Unknown composition: nonexistent_composition_xyz/ }
    );
  });

  it('propagates language option', async () => {
    const item = await queueForApproval('features', { language: 'ar' });
    assert.equal(item.language, 'ar');
  });

  it('propagates props', async () => {
    const item = await queueForApproval('testimonial', { props: { client: 'ACME' } });
    assert.deepEqual(item.props, { client: 'ACME' });
  });

  it('propagates requestedBy', async () => {
    const item = await queueForApproval('demo', { requestedBy: 'ci-pipeline' });
    assert.equal(item.requestedBy, 'ci-pipeline');
  });

  it('works with all standard compositions', async () => {
    for (const key of Object.keys(COMPOSITIONS)) {
      const item = await queueForApproval(key);
      assert.ok(item.id, `queueForApproval('${key}') should return item with id`);
      assert.equal(item.composition, key);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Remotion Service — processApproved (validation only)
// ═══════════════════════════════════════════════════════════════════════════════

describe('RemotionService.processApproved() — validation', () => {
  it('throws for nonexistent videoId', async () => {
    await assert.rejects(
      () => processApproved('vid_nonexistent_999'),
      { message: /not found/ }
    );
  });

  it('throws for non-approved video (pending state)', async () => {
    const item = await queueForApproval('demo');
    // Item is in 'pending' state, not 'approved'
    await assert.rejects(
      () => processApproved(item.id),
      { message: /not approved/ }
    );
  });

  it('throws for rejected video', async () => {
    const item = await queueForApproval('demo');
    hitl.rejectVideo(item.id, 'test-reviewer', 'test reason');
    await assert.rejects(
      () => processApproved(item.id),
      { message: /not approved/ }
    );
  });
});
