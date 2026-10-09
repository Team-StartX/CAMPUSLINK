import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { configurePersistence } from '../src/mocks/adapter';
import { initialData } from '../src/mocks/data';
import type { WorkspaceData, Drive, Student, Campus, InterviewTemplate } from '../src/types';
import { Database } from './db';
import { Account } from './auth';
import { requireCondition } from './errors';
import { queueMail } from './mail';
import { checkEligibility, placementNotice, studentVisible } from '../src/utils/placement';
import type { AdminAssessment, AdminContest } from '../src/types/admin';
import type { InterviewSlot, CandidateResult } from '../src/types/recruitment';

export type StoredDrive = Drive & { recruiterId: string };
export function emptyWorkspace(account?: Account, campusName = ''): WorkspaceData {
  return {
    student: {
      id: account?.id || '',
      name: account?.role === 'student' ? account.name : 'Select a student',
      email: account?.role === 'student' ? account.email : '',
      campus: campusName,
      course: '',
      branch: '',
      year: '',
      cgpa: 0,
      activeBacklogs: 0,
      bio: '',
      skills: [],
      projects: [],
      records: {},
      xp: 0,
    },
    campuses: [],
    opportunities: [],
    applications: [],
    assessments: structuredClone(initialData.assessments),
    history: [],
    contests: [],
    interviews: [],
    offers: [],
    drives: [],
    notifications: [],
    documents: [],
    learning: [],
    onboardingDismissed: false,
    shortlisted: [],
    interviewTemplates: [],
    pointsSummary: { assessments: 0, participation: 0 },
  };
}
interface Context {
  db: Database;
  actor: Account;
  target?: Account;
}
const context = new AsyncLocalStorage<Context>();
export const currentContext = () => {
  const c = context.getStore();
  if (!c) throw new Error('Missing request context');
  return c;
};

export async function candidates(db: Database, actor: Account) {
  const accounts = await db.list<Account>(
    'account',
    actor.role === 'campus' ? actor.campusId : undefined,
  );
  if (actor.role === 'campus')
    return accounts.filter(
      (a) => actor.campusId && a.role === 'student' && a.approved && a.campusId === actor.campusId,
    );
  if (actor.role === 'student') return accounts.filter((a) => a.id === actor.id && a.approved);
  const drives = await db.list<StoredDrive>('drive');
  const profiles = await db.list<WorkspaceData>('workspace');
  return accounts
    .filter((a) => a.role === 'student' && a.approved)
    .filter((a) => {
      if (actor.role === 'campus') return Boolean(actor.campusId) && a.campusId === actor.campusId;
      if (actor.role === 'student') return a.id === actor.id;
      const data = profiles.find((p) => p.student.id === a.id);
      return data?.applications.some((app) =>
        drives.some(
          (d) => d.recruiterId === actor.id && (d.opportunityId || d.id) === app.opportunityId,
        ),
      );
    });
}
export async function runWorkspace<T>(
  db: Database,
  actor: Account,
  targetId: string | undefined,
  fn: () => Promise<T>,
) {
  let target: Account | undefined;
  if (actor.role === 'student') {
    requireCondition(
      !targetId || targetId === actor.id,
      403,
      'You can only access your own profile.',
    );
    target = actor;
  } else {
    const allowed = await candidates(db, actor);
    target = targetId ? allowed.find((a) => a.id === targetId) : allowed[0];
    requireCondition(
      !targetId || target,
      403,
      'This student is outside your authorized candidate pool.',
    );
  }
  return context.run({ db, actor, target }, fn);
}
export async function readWorkspace(): Promise<WorkspaceData> {
  const { db, actor, target } = currentContext();
  const [
    campuses,
    own,
    assessments,
    contests,
    campusWorkspaces,
    storedDrives,
    roundResults,
    slots,
    notifications,
    templates,
  ] = await Promise.all([
    db.list<Campus>('campus'),
    target ? db.get<WorkspaceData>('workspace', target.id) : Promise.resolve(undefined),
    db.list<AdminAssessment>('admin-assessment'),
    db.list<AdminContest>('admin-contest'),
    db.list<WorkspaceData>('workspace', actor.campusId),
    db.list<StoredDrive>('drive', actor.role === 'recruiter' ? undefined : actor.campusId),
    db.list<CandidateResult>(
      'candidate-round',
      target?.campusId || actor.campusId,
      target?.id || actor.id,
    ),
    db.list<InterviewSlot>('interview-slot', target?.campusId || actor.campusId),
    db.list<WorkspaceData['notifications'][number]>('notification', undefined, actor.id),
    db.list<InterviewTemplate & { recruiterId: string; campusIds: string[] }>('template'),
  ]);
  const data = structuredClone(
    own || emptyWorkspace(target, campuses.find((c) => c.id === target?.campusId)?.name),
  );
  data.campuses = campuses;
  const visible = (row: { status: string; campusId: string }) =>
    row.status === 'published' && (!row.campusId || row.campusId === actor.campusId);
  data.assessments = [
    ...data.assessments.filter((a) => !assessments.some((row) => row.id === a.id)),
    ...assessments
      .filter(visible)
      .map(({ id, name, type, duration, skill, color, questionIds }) => ({
        id,
        name,
        type,
        duration,
        skill,
        color,
        questionCount: questionIds.length,
      })),
  ];
  data.contests = [
    ...contests.filter(visible).map(({ id, name, type, duration, points, difficulty, prompt }) => {
      const progress = own?.contests.find((c) => c.id === id);
      return {
        id,
        name,
        type,
        duration,
        points,
        difficulty,
        prompt,
        participants: campusWorkspaces.filter((workspace) =>
          workspace.contests.some((contest) => contest.id === id && contest.joined),
        ).length,
        joined: !!progress?.joined,
        completed: !!progress?.completed,
      };
    }),
  ];
  data.drives = storedDrives.filter((d) =>
    actor.role === 'recruiter' ? d.recruiterId === actor.id : d.campusId === actor.campusId,
  );
  if (actor.role === 'student')
    data.drives = data.drives.filter(studentVisible).map((d) => {
      const publicDrive = { ...d } as Partial<StoredDrive>;
      delete publicDrive.recruiterId;
      return publicDrive as Drive;
    });
  if (actor.role === 'recruiter') {
    const owned = new Set(data.drives.map((d) => d.opportunityId || d.id));
    data.applications = data.applications.filter((a) => owned.has(a.opportunityId));
    data.offers = data.offers.filter(
      (o) => (o as typeof o & { recruiterId?: string }).recruiterId === actor.id,
    );
    data.interviews = data.interviews.filter(
      (i) => (i as typeof i & { recruiterId?: string }).recruiterId === actor.id,
    );
  }
  const visibleDriveIds = new Set(data.drives.map((d) => d.id));
  for (const slot of slots) {
    const drive = data.drives.find((d) => d.id === slot.driveId);
    if (!drive || !visibleDriveIds.has(slot.driveId)) continue;
    const studentId = target?.id || actor.id;
    if (slot.audience === 'round') {
      if (
        (target || actor.role === 'student') &&
        !roundResults.some(
          (r) =>
            r.driveId === slot.driveId && r.roundId === slot.roundId && r.studentId === studentId,
        )
      )
        continue;
    } else if (slot.studentId !== studentId) continue;
    data.interviews.push({
      id: slot.id,
      company: drive.company,
      role: drive.role,
      date: slot.date,
      time: slot.time,
      mode: slot.mode === 'Online' ? slot.meetingLink : `${slot.venue} · ${slot.room}`,
      round: drive.rounds?.find((r) => r.id === slot.roundId)?.name || 'Interview',
      status: roundResults.some((r) => r.roundId === slot.roundId && r.published)
        ? 'Completed'
        : 'Scheduled',
    });
  }
  data.offers = data.offers.map((o) =>
    o.deadline &&
    o.deadline < new Date().toISOString().slice(0, 10) &&
    ['Offer Sent', 'Viewed', 'Received'].includes(o.status)
      ? { ...o, status: 'Expired' }
      : o,
  );
  data.notifications = notifications;
  data.interviewTemplates = templates.filter((t) => {
    if (actor.role === 'recruiter') return t.recruiterId === actor.id;
    if (!t.campusIds?.includes(actor.campusId)) return false;
    if (actor.role === 'campus') return true;
    const owned = storedDrives.filter(
      (d) => visibleDriveIds.has(d.id) && d.recruiterId === t.recruiterId,
    );
    const applications = data.applications.filter((a) =>
      owned.some((d) => (d.opportunityId || d.id) === a.opportunityId),
    );
    return t.audience === 'All eligible students'
      ? owned.some((d) => checkEligibility(data.student, d).passed)
      : t.audience === 'Applicants'
        ? applications.length > 0
        : applications.some((a) => !['Applied', 'Eligibility', 'Rejected'].includes(a.stage));
  });
  data.pointsSummary = {
    assessments: data.history
      .filter(
        (h) =>
          h.type !== 'Interview' &&
          h.activity !== 'contest' &&
          !data.contests.some((c) => c.id === h.assessmentId),
      )
      .reduce((s, h) => s + h.points, 0),
    participation: data.history
      .filter(
        (h) =>
          h.type === 'Interview' ||
          h.activity === 'contest' ||
          data.contests.some((c) => c.id === h.assessmentId),
      )
      .reduce((s, h) => s + h.points, 0),
  };
  return data;
}
export async function notify(
  db: Database,
  account: Account,
  title: string,
  body: string,
  type: string,
  dedupe?: string,
  href?: string,
) {
  const id = dedupe || randomUUID();
  if (await db.get('notification', id)) return;
  await db.put(
    'notification',
    id,
    { id, title, body, type, read: false, ...(href ? { href } : {}) },
    account.campusId,
    account.id,
  );
  await queueMail(db, account.email, title, body, `notice-${id}`);
}
export async function notifyPlacementStudents(db: Database, drive: StoredDrive) {
  if (!studentVisible(drive)) return;
  for (const account of await db.list<Account>('account', drive.campusId)) {
    if (account.role !== 'student' || !account.approved) continue;
    const profile = await db.get<WorkspaceData>('workspace', account.id);
    const notice = placementNotice(
      profile?.student || emptyWorkspace(account, drive.campus).student,
      drive,
    );
    await notify(
      db,
      account,
      notice.title,
      notice.body,
      notice.type,
      `active-${drive.id}-${account.id}`,
      notice.href,
    );
  }
}

async function writeWorkspace(action: (data: WorkspaceData) => void) {
  const { db, actor, target } = currentContext();
  return db.transaction(async () => {
    const before = await readWorkspace();
    const data = structuredClone(before);
    action(data);
    if (target) {
      const stored =
        (await db.get<WorkspaceData>('workspace', target.id)) ||
        emptyWorkspace(target, data.student.campus);
      for (const key of [
        'student',
        'applications',
        'history',
        'contests',
        'interviews',
        'offers',
        'documents',
        'learning',
        'onboardingDismissed',
      ] as const) {
        if (JSON.stringify(data[key]) !== JSON.stringify(before[key])) {
          if (
            actor.role === 'recruiter' &&
            ['applications', 'interviews', 'offers'].includes(key)
          ) {
            const next = data[key] as { id: string }[],
              previous = before[key] as { id: string }[];
            const keep = (stored[key] as { id: string }[]).filter(
              (v) => !previous.some((p) => p.id === v.id),
            );
            (stored as unknown as Record<string, unknown>)[key] = [...keep, ...next];
          } else if (key === 'contests') {
            const hidden = stored.contests.filter(
              (c) => !before.contests.some((v) => v.id === c.id),
            );
            stored.contests = [...hidden, ...data.contests];
          } else (stored as unknown as Record<string, unknown>)[key] = data[key];
        }
      }
      for (const key of ['interviews', 'offers'] as const)
        for (const row of stored[key]) {
          if (!before[key].some((r) => r.id === row.id) && actor.role === 'recruiter')
            Object.assign(row, { recruiterId: actor.id });
        }
      stored.assessments = data.assessments;
      if (actor.role !== 'student') stored.shortlisted = data.shortlisted;
      await db.put('workspace', target.id, stored, target.campusId, target.id);
    }
    for (const drive of data.drives) {
      const old = before.drives.find((d) => d.id === drive.id);
      if (JSON.stringify(old) === JSON.stringify(drive)) continue;
      const stored = await db.get<StoredDrive>('drive', drive.id);
      requireCondition(actor.role !== 'student' || stored, 403, 'Students cannot create drives.');
      const next = { ...drive, recruiterId: stored?.recruiterId || actor.id };
      await db.put('drive', drive.id, next, drive.campusId, next.recruiterId);
      // Keep existing Drive projections compatible while exposing independently
      // addressable rounds and schedule relationships in the scoped record store.
      for (const [order, round] of (drive.rounds || []).entries())
        await db.put(
          'recruitment-round',
          `${drive.id}:${round.id}`,
          {
            ...round,
            id: `${drive.id}:${round.id}`,
            roundId: round.id,
            driveId: drive.id,
            order,
            recruiterId: next.recruiterId,
          },
          drive.campusId,
          next.recruiterId,
        );
      for (const row of await db.list<{ id: string; driveId: string }>(
        'recruitment-round',
        drive.campusId,
      ))
        if (
          row.driveId === drive.id &&
          !drive.rounds?.some((r) => `${drive.id}:${r.id}` === row.id)
        )
          await db.remove('recruitment-round', row.id);
      if (drive.schedule)
        await db.put(
          'drive-schedule',
          drive.id,
          { ...drive.schedule, driveId: drive.id, status: drive.status },
          drive.campusId,
          next.recruiterId,
        );
      const eventId = randomUUID();
      await db.put(
        'audit',
        eventId,
        {
          id: eventId,
          user_id: actor.id,
          role: actor.role,
          action: 'drive-updated',
          entity: 'drive',
          entity_id: drive.id,
          timestamp: new Date().toISOString(),
          old_value: old,
          new_value: next,
        },
        drive.campusId,
        actor.id,
      );
      const recipients = (await db.list<Account>('account')).filter(
        (a) =>
          a.id !== actor.id &&
          (a.id === next.recruiterId || (a.role === 'campus' && a.campusId === drive.campusId)),
      );
      for (const recipient of recipients)
        await notify(
          db,
          recipient,
          `${drive.company}: ${drive.status.toLowerCase().replaceAll('_', ' ')}`,
          drive.reviewNote || `${drive.role} updated. Review the drive details.`,
          'Drive',
          undefined,
          `/${recipient.role}/drives/${encodeURIComponent(drive.id)}`,
        );
      if (
        (old?.schedule && JSON.stringify(old.schedule) !== JSON.stringify(drive.schedule)) ||
        (old?.status === 'ACTIVE' && ['SCHEDULING', 'CANCELLED'].includes(drive.status))
      ) {
        for (const student of await db.list<Account>('account', drive.campusId)) {
          if (student.role !== 'student') continue;
          const profile = await db.get<WorkspaceData>('workspace', student.id);
          if (
            !profile?.applications.some(
              (a) => a.opportunityId === (drive.opportunityId || drive.id),
            )
          )
            continue;
          await notify(
            db,
            student,
            drive.status === 'CANCELLED' ? 'Drive cancelled' : 'Schedule changed',
            `${drive.company}: ${drive.reviewNote || 'The campus is coordinating a revised schedule.'}`,
            'Drive',
          );
        }
      }
      if (drive.status === 'ACTIVE' && old?.status !== 'ACTIVE') {
        await notifyPlacementStudents(db, next);
      }
    }
    for (const n of data.notifications) {
      if (before.notifications.some((p) => p.id === n.id))
        await db.put('notification', n.id, n, actor.campusId, actor.id);
      else await notify(db, target || actor, n.title, n.body, n.type, n.id, n.href);
    }
    for (const t of data.interviewTemplates || [])
      if (!before.interviewTemplates?.some((p) => p.id === t.id))
        await db.put(
          'template',
          t.id,
          {
            ...t,
            recruiterId: actor.id,
            campusIds: [...new Set(data.drives.map((d) => d.campusId).filter(Boolean))],
          },
          actor.campusId,
          actor.id,
        );
    await db.put(
      'audit',
      randomUUID(),
      {
        actorId: actor.id,
        targetId: target?.id,
        time: new Date().toISOString(),
        event: 'workspace-mutation',
      },
      actor.campusId,
      actor.id,
    );
    return readWorkspace();
  });
}
configurePersistence({ read: readWorkspace, update: writeWorkspace });
export async function studentProfiles(db: Database, actor: Account): Promise<Student[]> {
  const allowed = await candidates(db, actor);
  const [profiles, campuses] = await Promise.all([
    db.list<WorkspaceData>('workspace', actor.role === 'campus' ? actor.campusId : undefined),
    db.list<Campus>('campus'),
  ]);
  const result: Student[] = [];
  for (const a of allowed) {
    const data = profiles.find((profile) => profile.student.id === a.id);
    const campus = campuses.find((row) => row.id === a.campusId);
    result.push((data || emptyWorkspace(a, campus?.name)).student);
  }
  return result;
}
