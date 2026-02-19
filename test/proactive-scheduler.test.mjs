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

    test('_parseCron returns correct initialDelay for daily cron (M2)', () => {
        const result = Scheduler._parseCron('0 4 * * *');
        // initialDelayMs should be > 0 (sometime in the future) and < 24h
        assert.ok(result.initialDelayMs > 0, 'initialDelay should be positive');
        assert.ok(result.initialDelayMs <= 24 * 3600000, 'initialDelay should be <= 24h');
        assert.strictEqual(result.intervalMs, 24 * 3600000, 'daily interval should be 24h');
    });

    test('_parseCron returns 1h interval for hourly cron (M2)', () => {
        const result = Scheduler._parseCron('0 * * * *');
        assert.strictEqual(result.intervalMs, 3600000, 'hourly interval should be 1h');
    });

    test('_parseCron returns 7d interval for weekly cron (M2)', () => {
        const result = Scheduler._parseCron('0 9 * * 1');
        assert.strictEqual(result.intervalMs, 7 * 24 * 3600000, 'weekly interval should be 7d');
    });

});
