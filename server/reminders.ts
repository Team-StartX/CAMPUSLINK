import { Database } from './db';
import { Account } from './auth';
import { DemoData } from '../src/types';
import { notify } from './workspace';
export async function runReminders(db: Database) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    today = new Date().toISOString().slice(0, 10);
  await db.transaction(async () => {
    for (const account of await db.list<Account>('account')) {
      if (account.role !== 'student' || !account.approved) continue;
      const data = await db.get<DemoData>('workspace', account.id);
      if (!data) continue;
      for (const interview of data.interviews)
        if (interview.date === tomorrow && interview.status === 'Scheduled')
          await notify(
            db,
            account,
            'Interview tomorrow',
            `${interview.company}: ${interview.date} at ${interview.time}. Venue: ${interview.mode}. Bring your ID and resume.`,
            'Interview',
            `reminder-${interview.id}-${today}`,
          );
      for (const offer of data.offers)
        if (
          ['Received', 'Deferred'].includes(offer.status) &&
          offer.joining <= tomorrow &&
          data.documents.some((d) => d.status !== 'Verified')
        )
          await notify(
            db,
            account,
            'Placement documents need attention',
            'Review pending documents before joining.',
            'Document',
            `documents-${offer.id}-${today}`,
          );
    }
  });
}
