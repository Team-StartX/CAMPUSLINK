import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startWorker, workerErrorDetails } from '../server/workers';

test('worker diagnostics retain useful codes without exposing private error text', () => {
  const details = workerErrorDetails({ code: '28P01', message: 'secret database password' });
  assert.equal(details.code, '28P01');
  assert.match(details.reason, /authentication/);
  assert.ok(!JSON.stringify(details).includes('secret'));
  assert.equal(workerErrorDetails({ cause: { code: 'ENOTFOUND' } }).code, 'ENOTFOUND');
  assert.equal(workerErrorDetails({ code: 'invalid private data' }).code, undefined);
});

test('workers retry failures, recover, stop and remain independent without overlapping', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const errors = t.mock.method(console, 'error', () => {});
  const recovered = t.mock.method(console, 'info', () => {});
  let calls = 0;
  let slowCalls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stopSlow = startWorker(
    'Slow',
    async () => {
      slowCalls++;
      await pending;
    },
    10,
  );
  const stopFast = startWorker(
    'Fast',
    async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('private'), { code: 'ECONNRESET' });
    },
    10,
  );
  const advance = async (ms: number) => {
    t.mock.timers.tick(ms);
    await Promise.resolve();
    await Promise.resolve();
  };
  try {
    await advance(10);
    assert.equal(calls, 1);
    assert.equal(errors.mock.callCount(), 1);
    await advance(10);
    assert.equal(calls, 1, 'failed worker backs off');
    await advance(10);
    assert.equal(calls, 2, 'healthy worker proceeds while the slow worker is pending');
    assert.equal(recovered.mock.callCount(), 1);
    await advance(10);
    assert.equal(calls, 3, 'normal interval restored after recovery');
    assert.equal(slowCalls, 1, 'pending worker never overlaps itself');
    stopFast();
    stopSlow();
    release();
    await advance(100);
    assert.equal(calls, 3);
    assert.equal(slowCalls, 1);
  } finally {
    stopFast();
    stopSlow();
    release();
  }
});
