import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { configurePersistence } from '../src/mocks/adapter';
import { initialData } from '../src/mocks/data';
import type { WorkspaceData, Drive, Student, Campus, InterviewTemplate } from '../src/types';
import { Database } from './db';
import { Account } from './auth';
import { requireCondition } from './errors';
import { queueMail } from './mail';
import { checkEligibility } from '../src/utils/placement';
import type { AdminAssessment, AdminContest } from '../src/types/admin';

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
  const accounts = await db.list<Account>('account');
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
  const campuses = await db.list<Campus>('campus');
  const own = target ? await db.get<WorkspaceData>('workspace', target.id) : undefined;
  const data = structuredClone(
    own || emptyWorkspace(target, campuses.find((c) => c.id === target?.campusId)?.name),
  );
  data.campuses = campuses;
  const assessments = await db.list<AdminAssessment>('admin-assessment');
  const contests = await db.list<AdminContest>('admin-contest');
  const campusWorkspaces = await db.list<WorkspaceData>('workspace', actor.campusId);
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
  data.drives = (await db.list<StoredDrive>('drive')).filter((d) =>
    actor.role === 'recruiter' ? d.recruiterId === actor.id : d.campusId === actor.campusId,
  );
  if (actor.role === 'student')
    data.drives = data.drives.filter((d) =>
      ['ACTIVE', 'IN_PROGRESS', 'COMPLETED'].includes(d.status),
    );
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
  data.notifications = await db.list('notification', undefined, actor.id);
  const templates = await db.list<InterviewTemplate & { recruiterId: string; campusIds: string[] }>(
    'template',
  );
  data.interviewTemplates = templates.filter((t) => {
    if (actor.role === 'recruiter') return t.recruiterId === actor.id;
    if (!t.campusIds?.includes(actor.campusId)) return false;
    if (actor.role === 'campus') return true;
    const owned = data.drives.filter((d) => (d as StoredDrive).recruiterId === t.recruiterId);
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
) {
  const id = dedupe || randomUUID();
  if (await db.get('notification', id)) return;
  await db.put(
    'notification',
    id,
    { id, title, body, type, read: false },
    account.campusId,
    account.id,
  );
  await queueMail(db, account.email, title, body, `notice-${id}`);
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
      if (drive.status === 'ACTIVE' && old?.status !== 'ACTIVE') {
        for (const a of await db.list<Account>('account', drive.campusId)) {
          if (a.role !== 'student') continue;
          const profile = await db.get<WorkspaceData>('workspace', a.id);
          if (profile && checkEligibility(profile.student, drive).passed)
            await notify(
              db,
              a,
              `${drive.company} campus drive is open`,
              `${drive.role}: apply before ${drive.deadline}.`,
              'Campus Drive',
              `active-${drive.id}-${a.id}`,
            );
        }
      }
    }
    for (const n of data.notifications) {
      if (before.notifications.some((p) => p.id === n.id))
        await db.put('notification', n.id, n, actor.campusId, actor.id);
      else await notify(db, target || actor, n.title, n.body, n.type, n.id);
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
  const result: Student[] = [];
  for (const a of allowed) {
    const data = await db.get<WorkspaceData>('workspace', a.id);
    const campus = await db.get<Campus>('campus', a.campusId);
    result.push((data || emptyWorkspace(a, campus?.name)).student);
  }
  return result;
}
