import { Database } from './db';
import { Account } from './auth';
import { WorkspaceData } from '../src/types';
import { notify, StoredDrive } from './workspace';
import { checkEligibility } from '../src/utils/placement';
import type { InterviewSlot } from '../src/types/recruitment';
export async function runReminders(db: Database) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    today = new Date().toISOString().slice(0, 10);
  await db.transaction(async () => {
    const drives = await db.list<StoredDrive>('drive');
    const slots = await db.list<InterviewSlot>('interview-slot');
    for (const account of await db.list<Account>('account')) {
      if (account.role !== 'student' || !account.approved) continue;
      const data = await db.get<WorkspaceData>('workspace', account.id);
      if (!data) continue;
      for (const drive of drives.filter(
        (d) =>
          d.campusId === account.campusId &&
          d.status === 'ACTIVE' &&
          d.deadline === tomorrow &&
          checkEligibility(data.student, d).passed,
      )) {
        if (!data.applications.some((a) => a.opportunityId === (drive.opportunityId || drive.id)))
          await notify(
            db,
            account,
            'Application deadline approaching',
            `${drive.company}: apply for ${drive.role} by ${drive.deadline}.`,
            'Opportunity',
            `deadline-${drive.id}-${account.id}-${today}`,
          );
      }
      for (const slot of slots.filter(
        (s) =>
          s.studentId === account.id &&
          s.date === tomorrow &&
          drives.some((d) => d.id === s.driveId && !['CANCELLED', 'COMPLETED'].includes(d.status)),
      ))
        await notify(
          db,
          account,
          'Interview tomorrow',
          `${slot.date} at ${slot.time} IST · ${slot.venue || slot.meetingLink}`,
          'Interview',
          `slot-reminder-${slot.id}-${today}`,
        );
      let expired = false;
      for (const offer of data.offers) {
        if (
          offer.deadline &&
          offer.deadline < today &&
          ['Offer Sent', 'Viewed', 'Received'].includes(offer.status)
        ) {
          const previous = offer.status;
          offer.status = 'Expired';
          expired = true;
          await db.put(
            'audit',
            `expired-${offer.id}`,
            {
              user_id: 'system',
              role: 'system',
              action: 'offer-expired',
              entity: 'offer',
              entity_id: offer.id,
              timestamp: new Date().toISOString(),
              old_value: previous,
              new_value: 'Expired',
            },
            account.campusId,
            account.id,
          );
          await notify(
            db,
            account,
            'Offer expired',
            `${offer.company}: the acceptance deadline passed.`,
            'Offer',
            `expired-${offer.id}`,
          );
        }
      }
      if (expired) await db.put('workspace', account.id, data, account.campusId, account.id);
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
