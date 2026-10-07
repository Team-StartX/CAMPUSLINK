import { WorkspaceData, Role } from '@/types';

export interface WorkspaceAction {
  id: string;
  title: string;
  detail: string;
  category: string;
  href: string;
  date?: string;
  priority: 'High' | 'Normal';
}

export function workspaceActions(
  data: WorkspaceData,
  role: Role,
  today: string,
): WorkspaceAction[] {
  const items: WorkspaceAction[] = [];
  const add = (item: WorkspaceAction) => items.push(item);
  if (role === 'student') {
    if ((data.student.profileCompletion ?? 0) < 100)
      add({
        id: 'profile',
        title: 'Complete your career profile',
        detail: `${data.student.profileCompletion ?? 0}% complete · Help recruiters understand your experience`,
        category: 'Preparation',
        href: '/student/profile',
        priority: 'Normal',
      });
    data.opportunities
      .filter(
        (o) => o.deadline >= today && !data.applications.some((a) => a.opportunityId === o.id),
      )
      .forEach((o) =>
        add({
          id: `opportunity-${o.id}`,
          title: `Apply to ${o.company}`,
          detail: o.role,
          category: 'Applications',
          href: `/student/opportunities/${o.id}`,
          date: o.deadline,
          priority: 'High',
        }),
      );
    data.student.skills
      .filter((s) => !s.verified)
      .forEach((s) =>
        add({
          id: `skill-${s.id}`,
          title: `Verify ${s.name}`,
          detail: 'Strengthen your profile with assessment evidence',
          category: 'Preparation',
          href: '/student/assessments',
          priority: 'Normal',
        }),
      );
    data.offers
      .filter((o) => ['Received', 'Deferred', 'Pending'].includes(o.status))
      .forEach((o) =>
        add({
          id: `offer-${o.id}`,
          title: `Review your ${o.company} offer`,
          detail: `${o.role} · ${o.ctc}`,
          category: 'Offers',
          href: '/student/offers',
          priority: 'High',
        }),
      );
  } else {
    const steps: Partial<Record<WorkspaceData['drives'][number]['status'], string>> =
      role === 'campus'
        ? {
            SUBMITTED: 'Review drive request',
            UNDER_REVIEW: 'Finish request review',
            SCHEDULING: 'Propose visit schedule',
            CONFIRMED: 'Finalize campus visit',
            ACTIVE: 'Track participation',
            IN_PROGRESS: 'Update placement outcomes',
          }
        : {
            DRAFT: 'Complete drive request',
            CHANGES_REQUESTED: 'Revise drive request',
            AWAITING_RECRUITER_CONFIRMATION: 'Confirm campus schedule',
            ACTIVE: 'Review applicants',
            IN_PROGRESS: 'Review selection progress',
          };
    data.drives.forEach((d) => {
      if (steps[d.status])
        add({
          id: `drive-${d.id}`,
          title: `${steps[d.status]} · ${d.company}`,
          detail: `${d.role} · ${d.campus || d.location}`,
          category: 'Drives',
          href: `/${role}/drives/${d.id}`,
          priority: ['ACTIVE', 'IN_PROGRESS'].includes(d.status) ? 'Normal' : 'High',
        });
    });
    if (role === 'campus') {
      const pending = data.documents.filter((d) =>
        ['Uploaded', 'Pending'].includes(d.status),
      ).length;
      if (pending)
        add({
          id: 'documents',
          title: 'Verify pending documents',
          detail: `${pending} documents awaiting review`,
          category: 'Documents',
          href: '/campus/documents',
          priority: 'High',
        });
    }
  }
  data.interviews
    .filter((i) => i.status === 'Scheduled' && i.date >= today)
    .forEach((i) =>
      add({
        id: `interview-${i.id}`,
        title: `${i.company} · ${i.round}`,
        detail: `${i.time} · ${i.mode} · ${i.role}`,
        category: 'Interviews',
        href: `/${role}/interviews/${i.id}`,
        date: i.date,
        priority: 'High',
      }),
    );
  return items.sort(
    (a, b) =>
      Number(b.priority === 'High') - Number(a.priority === 'High') ||
      (a.date || '9999').localeCompare(b.date || '9999') ||
      a.title.localeCompare(b.title),
  );
}

const escapeCalendar = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
export function actionCalendar(items: WorkspaceAction[], stamp = new Date()): string {
  const events = items
    .filter((i) => i.date && /^\d{4}-\d{2}-\d{2}$/.test(i.date))
    .map((i) => {
      const date = i.date!.replace(/-/g, '');
      const end = new Date(`${i.date}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      return [
        'BEGIN:VEVENT',
        `UID:${escapeCalendar(i.id)}@campuslink`,
        `DTSTAMP:${stamp
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '')}`,
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
        `SUMMARY:${escapeCalendar(i.title)}`,
        `DESCRIPTION:${escapeCalendar(i.detail)}`,
        'END:VEVENT',
      ].join('\r\n');
    });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusLink//Action Center//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
