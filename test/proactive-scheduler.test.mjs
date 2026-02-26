/**
 * ProactiveScheduler Tests (file-based, no Redis)
 *
 * Tests: ALL exported methods behavioral (boundary mock: AgencyEventBus only)
 * - scheduleTask (immediate, delayed, cron paths)
 * - cancelTask
 * - _processDelayedTasks
 * - _parseCron
 * - close
 *
 * Run: node --test test/proactive-scheduler.test.mjs
 * @session 250.241
 */

import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import Scheduler from '../core/proactive-scheduler.cjs';
import AgencyEventBus from '../core/AgencyEventBus.cjs';

// Use isolated test tasks file to avoid polluting production data
const TEST_SCHEDULER_DIR = path.join(process.cwd(), 'data', 'scheduler');
const TEST_TASKS_FILE = path.join(TEST_SCHEDULER_DIR, 'tasks.jsonl');

describe('ProactiveScheduler', () => {

    after(() => {
        Scheduler.close();
    });

    test('isReady is always true (no Redis)', () => {
        assert.strictEqual(Scheduler.isReady, true);
    });

    test('schedules and executes an immediate task', async () => {
        const publishSpy = mock.method(AgencyEventBus, 'publish', () => {});

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

    test('scheduleTask with delay writes to JSONL file', async () => {
        // Clear tasks file before test
        if (fs.existsSync(TEST_TASKS_FILE)) {
            fs.writeFileSync(TEST_TASKS_FILE, '');
        }

        const result = await Scheduler.scheduleTask('delayed_test', { msg: 'hello' }, {
            delay: 3600000, // 1h in future
            jobId: 'test_delayed_job'
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.jobId, 'test_delayed_job');

        // Verify task was persisted to JSONL
        const content = fs.readFileSync(TEST_TASKS_FILE, 'utf8');
        assert.ok(content.includes('test_delayed_job'), 'Job should be persisted to tasks.jsonl');
        assert.ok(content.includes('delayed_test'), 'Task type should be in file');
        assert.ok(content.includes('"status":"pending"'), 'Status should be pending');
    });

    test('scheduleTask with repeat.cron returns success and jobId', async () => {
        const result = await Scheduler.scheduleTask('cron_test', { action: 'enrich' }, {
            repeat: { cron: '0 4 * * *' },
            jobId: 'test_cron_job'
        });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.jobId, 'test_cron_job');

        // Verify it was registered in cronIntervals
        assert.ok(Scheduler.cronIntervals.has('test_cron_job'));

        // Cleanup
        Scheduler.cancelTask('test_cron_job');
    });

    test('scheduleTask with repeat.cron returns already_scheduled for duplicate jobId', async () => {
        // Schedule first
        await Scheduler.scheduleTask('cron_dup', {}, {
            repeat: { cron: '0 * * * *' },
            jobId: 'test_dup_cron'
        });

        // Schedule duplicate
        const result = await Scheduler.scheduleTask('cron_dup', {}, {
            repeat: { cron: '0 * * * *' },
            jobId: 'test_dup_cron'
        });
        assert.strictEqual(result.note, 'already_scheduled');

        // Cleanup
        Scheduler.cancelTask('test_dup_cron');
    });

    test('cancelTask cancels a cron job and returns true', async () => {
        await Scheduler.scheduleTask('cancel_test', {}, {
            repeat: { cron: '0 3 * * *' },
            jobId: 'test_cancel_cron'
        });
        assert.ok(Scheduler.cronIntervals.has('test_cancel_cron'));

        const cancelled = Scheduler.cancelTask('test_cancel_cron');
        assert.strictEqual(cancelled, true);
        assert.ok(!Scheduler.cronIntervals.has('test_cancel_cron'));
    });

    test('cancelTask returns false for unknown jobId', () => {
        const cancelled = Scheduler.cancelTask('__nonexistent_job_id__');
        assert.strictEqual(cancelled, false);
    });

    test('_processDelayedTasks executes tasks whose executeAt has passed', async () => {
        const publishSpy = mock.method(AgencyEventBus, 'publish', () => {});

        // Write a task that is already due
        const pastTask = {
            jobId: 'test_past_due',
            taskType: 'past_due_action',
            payload: { x: 1 },
            executeAt: new Date(Date.now() - 60000).toISOString(), // 1 min ago
            scheduledAt: new Date().toISOString(),
            status: 'pending'
        };
        fs.writeFileSync(TEST_TASKS_FILE, JSON.stringify(pastTask) + '\n');

        await Scheduler._processDelayedTasks();

        // Verify the task was executed
        const call = publishSpy.mock.calls.find(c =>
            c.arguments[0] === 'scheduler.task_executed' &&
            c.arguments[1].taskType === 'past_due_action'
        );
        assert.ok(call, 'Past-due task should have been executed');

        // Verify the task was removed from file (no remaining pending tasks)
        const remaining = fs.readFileSync(TEST_TASKS_FILE, 'utf8').trim();
        assert.ok(!remaining.includes('test_past_due'), 'Executed task should be removed from file');

        publishSpy.mock.restore();
    });

    test('_processDelayedTasks keeps future tasks in file', async () => {
        const futureTask = {
            jobId: 'test_future',
            taskType: 'future_action',
            payload: { y: 2 },
            executeAt: new Date(Date.now() + 3600000).toISOString(), // 1h from now
            scheduledAt: new Date().toISOString(),
            status: 'pending'
        };
        fs.writeFileSync(TEST_TASKS_FILE, JSON.stringify(futureTask) + '\n');

        await Scheduler._processDelayedTasks();

        const remaining = fs.readFileSync(TEST_TASKS_FILE, 'utf8').trim();
        assert.ok(remaining.includes('test_future'), 'Future task should remain in file');
    });

    test('_processDelayedTasks handles corrupt lines gracefully', async () => {
        fs.writeFileSync(TEST_TASKS_FILE, 'NOT VALID JSON\n');

        // Should not throw
        await Scheduler._processDelayedTasks();

        // File should be cleaned (corrupt line skipped)
        const remaining = fs.readFileSync(TEST_TASKS_FILE, 'utf8').trim();
        assert.strictEqual(remaining, '');
    });

    test('_parseCron returns correct initialDelay for daily cron', () => {
        const result = Scheduler._parseCron('0 4 * * *');
        assert.ok(result.initialDelayMs > 0, 'initialDelay should be positive');
        assert.ok(result.initialDelayMs <= 24 * 3600000, 'initialDelay should be <= 24h');
        assert.strictEqual(result.intervalMs, 24 * 3600000, 'daily interval should be 24h');
    });

    test('_parseCron returns 1h interval for hourly cron', () => {
        const result = Scheduler._parseCron('0 * * * *');
        assert.strictEqual(result.intervalMs, 3600000, 'hourly interval should be 1h');
    });

    test('_parseCron returns 7d interval for weekly cron', () => {
        const result = Scheduler._parseCron('0 9 * * 1');
        assert.strictEqual(result.intervalMs, 7 * 24 * 3600000, 'weekly interval should be 7d');
    });

    test('_parseCron fallback for invalid expr', () => {
        const result = Scheduler._parseCron('bad');
        assert.strictEqual(result.intervalMs, 24 * 3600000, 'should default to 24h');
    });

    test('close() stops check timer and clears cron intervals', async () => {
        // Create a fresh scheduler-like state to test close behavior
        // (We test close on the singleton in after(), but verify state here)
        await Scheduler.scheduleTask('close_test', {}, {
            repeat: { cron: '0 2 * * *' },
            jobId: 'test_close_cron'
        });
        assert.ok(Scheduler.cronIntervals.has('test_close_cron'));

        Scheduler.close();
        assert.strictEqual(Scheduler.cronIntervals.size, 0);
        assert.strictEqual(Scheduler.isReady, false);
    });
});
