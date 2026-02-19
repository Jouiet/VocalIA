/**
 * ProactiveScheduler Tests (file-based, no Redis)
 *
 * Tests:
 * - Schedule delayed task
 * - Execute task and emit event
 *
 * Run: node --test test/proactive-scheduler.test.mjs
 */

import { test, describe, after, mock } from 'node:test';
import assert from 'node:assert';
import Scheduler from '../core/proactive-scheduler.cjs';
import AgencyEventBus from '../core/AgencyEventBus.cjs';

describe('ProactiveScheduler', () => {

    after(() => {
        Scheduler.close();
    });

    test('isReady is always true (no Redis)', () => {
        assert.strictEqual(Scheduler.isReady, true);
    });

    test('schedules and executes a task', async () => {
        const publishSpy = mock.method(AgencyEventBus, 'publish', () => {});

        // Schedule immediate task (delay: 0 => delayed but executeAt = now)
        const result = await Scheduler.scheduleTask('test_action', { data: 42 });
        assert.strictEqual(result.success, true);
        assert.ok(result.jobId);

        // Verify event was published (immediate tasks execute right away)
        const call = publishSpy.mock.calls.find(c =>
            c.arguments[0] === 'scheduler.task_executed' &&
            c.arguments[1].taskType === 'test_action'
        );
        assert.ok(call, 'Should publish scheduler.task_executed');
        assert.strictEqual(call.arguments[1].payload.data, 42);

        publishSpy.mock.restore();
    });

});
