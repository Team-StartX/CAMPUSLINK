import { randomUUID } from 'node:crypto';
import { Database } from './db';
import { config } from './config';
export interface MailJob {
  id: string;
  recipient: string;
  subject: string;
  text: string;
  status: string;
  attempts: number;
  nextAt: number;
  createdAt: number;
  deliveryToken?: string;
}
export async function queueMail(
  db: Database,
  recipient: string,
  subject: string,
  text: string,
  dedupe?: string,
) {
  const id = dedupe || randomUUID();
  if (await db.get('mail', id)) return;
  await db.put('mail', id, {
    id,
    recipient,
    subject,
    text,
    status: 'pending',
    attempts: 0,
    nextAt: Date.now(),
    createdAt: Date.now(),
  } satisfies MailJob);
}
export async function deliverMail(db: Database) {
  if (config.email === 'outbox') return;
  const due = await db.query<{ id: string }>(
    "SELECT record_id AS id FROM mail_jobs WHERE status='pending' AND next_at <= $1 ORDER BY next_at,record_id LIMIT 20",
    [Date.now()],
  );
  for (const { id } of due) {
    // Claim briefly under the write lock. Network delivery must not block submissions.
    // An interrupted worker's lease expires so another instance can recover the job.
    const job = await db.transaction(async () => {
      const current = await db.get<MailJob>('mail', id);
      if (!current || current.status !== 'pending' || current.nextAt > Date.now()) return;
      if (current.attempts >= 6) {
        current.status = 'failed';
        await db.put('mail', id, current);
        return;
      }
      current.attempts++;
      current.deliveryToken = randomUUID();
      current.nextAt = Date.now() + 300000;
      await db.put('mail', id, current);
      return current;
    });
    if (!job) continue;
    try {
      if (!config.resendKey || !config.emailFrom) throw new Error('Email configuration missing');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': job.id,
        },
        body: JSON.stringify({
          from: config.emailFrom,
          to: [job.recipient],
          subject: job.subject,
          text: job.text,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Delivery failed');
      job.status = 'sent';
    } catch {
      job.nextAt = Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts);
      if (job.attempts >= 6) job.status = 'failed';
    }
    await db.transaction(async () => {
      const current = await db.get<MailJob>('mail', id);
      // A stale worker must not overwrite a newer claim after its lease expires.
      if (current?.deliveryToken !== job.deliveryToken) return;
      delete job.deliveryToken;
      await db.put('mail', id, job);
    });
  }
}
