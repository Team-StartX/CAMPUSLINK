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
  // A DB transaction prevents two worker instances delivering the same queued job.
  await db.transaction(async () => {
    for (const job of (await db.list<MailJob>('mail'))
      .filter((j) => j.status === 'pending' && j.nextAt <= Date.now())
      .slice(0, 20)) {
      if (config.email === 'outbox') continue;
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
        job.attempts++;
        job.nextAt = Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts);
        if (job.attempts >= 6) job.status = 'failed';
      }
      await db.put('mail', job.id, job);
    }
  });
}
