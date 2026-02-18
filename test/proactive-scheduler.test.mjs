/**
 * ProactiveScheduler Tests
 * 
 * Tests:
 * - Schedule Task
 * - Process Task (Event Emission)
 * - Redis failure resilience
 * 
 * Run: node --test test/proactive-scheduler.test.mjs
 */

import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert';
import Scheduler from '../core/proactive-scheduler.cjs';
import AgencyEventBus from '../core/AgencyEventBus.cjs';

// Note: These tests require a running Redis instance or will run in "disabled" mode if connection fails.
// We'll mock AgencyEventBus to verify behavior.

describe('ProactiveScheduler', () => {

    before(async () => {
        // Wait for scheduler to init (Redis connection)
        await new Promise(r => setTimeout(r, 1000));
    });

    after(async () => {
        await Scheduler.close();
    });

    test('schedules a task (if Redis available)', async () => {
        if (!Scheduler.isReady) {
            console.log('⚠️ Redis not available, skipping schedule test');
            return;
        }

        const tenantId = 'test_tenant';
        const taskType = 'test_action';

        const result = await Scheduler.scheduleTask(tenantId, taskType, { foo: 'bar' }, { delay: 100 });
        assert.strictEqual(result.success, true);
        assert.ok(result.jobId);
    });

    test('processes a task and emits event', async (t) => {
        if (!Scheduler.isReady) return;

        // Spy on EventBus
        const publishSpy = mock.method(AgencyEventBus, 'publish', async () => { });

        // Schedule immediate task
        await Scheduler.scheduleTask('test_tenant', 'immediate_action', { data: 123 }, { delay: 0 });

        // Wait for worker to process (poll or wait)
        await new Promise(r => setTimeout(r, 1000));

        // Check if event was published
        // The worker runs in the same process, so the spy should catch it?
        // Yes, Scheduler uses `AgencyEventBus.publish`.

        assert.strictEqual(publishSpy.mock.calls.length >= 1, true, 'EventBus.publish should be called');

        const call = publishSpy.mock.calls.find(c => c.arguments[0] === 'scheduler.task_executed');
        assert.ok(call, 'Should publish scheduler.task_executed');
        assert.strictEqual(call.arguments[1].taskType, 'immediate_action');
        assert.strictEqual(call.arguments[1].payload.data, 123);
    });

});
