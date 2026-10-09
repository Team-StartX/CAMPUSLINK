import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Database } from '../server/db';
import { config } from '../server/config';
import { deliverMail, queueMail, type MailJob } from '../server/mail';

test('email delivery releases the write lock, prevents concurrent sends and retries safely', async (t) => {
  const db = new Database('', ':memory:');
  const original = {
    email: config.email,
    resendKey: config.resendKey,
    emailFrom: config.emailFrom,
  };
  Object.assign(config, { email: 'resend', resendKey: 'test-key', emailFrom: 'test@example.test' });
  let release!: () => void;
  let started!: () => void;
  const sending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<Response>((resolve) => {
    release = () => resolve(new Response('{}'));
  });
  const requests = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal((options?.headers as Record<string, string>)['Idempotency-Key'], 'first');
    started();
    return pending;
  });
  try {
    await db.migrate();
    await queueMail(db, 'student@example.test', 'Test', 'Test', 'first');
    const delivery = deliverMail(db);
    await sending;
    await deliverMail(db);
    assert.equal(requests.mock.callCount(), 1, 'another worker skips the leased job');
    // A separate write must complete before the network request is allowed to finish.
    await queueMail(db, 'other@example.test', 'Other', 'Other', 'second');
    await db.remove('mail', 'second');
    release();
    await delivery;
    const sent = (await db.get<MailJob>('mail', 'first'))!;
    assert.equal(sent.status, 'sent');
    assert.equal(sent.deliveryToken, undefined);

    await queueMail(db, 'student@example.test', 'Retry', 'Retry', 'retry');
    requests.mock.mockImplementation(async () => new Response('{}', { status: 503 }));
    await deliverMail(db);
    const failed = (await db.get<MailJob>('mail', 'retry'))!;
    assert.equal(failed.status, 'pending');
    assert.equal(failed.attempts, 1);
    assert.ok(failed.nextAt > Date.now());
    failed.nextAt = 0;
    failed.deliveryToken = 'interrupted-worker';
    await db.put('mail', 'retry', failed);
    requests.mock.mockImplementation(async (_url, options) => {
      assert.equal((options?.headers as Record<string, string>)['Idempotency-Key'], 'retry');
      return new Response('{}');
    });
    await deliverMail(db);
    const retried = (await db.get<MailJob>('mail', 'retry'))!;
    assert.equal(retried.status, 'sent');
    assert.equal(retried.attempts, 2);
    assert.equal(retried.deliveryToken, undefined);
  } finally {
    release?.();
    Object.assign(config, original);
    await db.close();
  }
});
