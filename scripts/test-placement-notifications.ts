import assert from 'node:assert/strict';
import { Database } from '../server/db';
import type { Account } from '../server/auth';
import {
  emptyWorkspace,
  notifyPlacementStudents,
  runWorkspace,
  type StoredDrive,
} from '../server/workspace';
import { dispatch } from '../server/services';
import { defaultDrive } from '../src/services/drive.defaults';
import type { Notification, WorkspaceData } from '../src/types';

async function main() {
  const db = new Database('', ':memory:');
  const account = (id: string, campusId = 'college', approved = true): Account => ({
    id,
    name: id,
    email: `${id}@example.test`,
    role: 'student',
    campusId,
    organization: campusId,
    approved,
    verified: true,
    passwordHash: '',
    createdAt: new Date().toISOString(),
  });
  const students = [
    account('eligible'),
    account('ineligible'),
    account('unapproved', 'college', false),
    account('other', 'other-college'),
  ];
  const recruiter = { ...account('recruiter'), role: 'recruiter' as const };
  const drive: StoredDrive = {
    ...defaultDrive({
      id: 'placement',
      company: 'Employer',
      role: 'Frontend Developer',
      campusId: 'college',
      campus: 'College',
      courses: 'B.Tech',
      branches: 'CSE',
      graduationYear: '2027',
      cgpa: 7,
      requireSkills: true,
      skills: 'React',
      status: 'ACTIVE',
      workflowVersion: 2,
      deadline: '2026-10-25',
      schedule: {
        date: '2026-11-01',
        reporting: '09:00',
        talk: '09:30',
        assessment: '10:00',
        interviews: '13:00',
        end: '17:00',
        venue: 'Placement Hall',
        lab: '',
        rooms: '',
        systems: 10,
      },
      audit: ['SCHEDULING', 'CONFIRMED', 'ACTIVE'].map((status) => ({
        status: status as 'ACTIVE' | 'CONFIRMED' | 'SCHEDULING',
        note: 'Fixture',
        date: new Date().toISOString(),
      })),
    }),
    recruiterId: recruiter.id,
  };
  try {
    await db.migrate();
    for (const [id, name] of [
      ['college', 'College'],
      ['other-college', 'Other College'],
    ])
      await db.put(
        'campus',
        id,
        { id, name, location: '', courses: ['B.Tech'], branches: ['CSE'], studentPool: 0 },
        id,
      );
    for (const a of [...students, recruiter]) {
      await db.put('account', a.email, a, a.campusId, a.id);
      const profile = emptyWorkspace(a, a.campusId === 'college' ? 'College' : 'Other College');
      Object.assign(profile.student, {
        course: 'B.Tech',
        branch: 'CSE',
        year: '2027',
        cgpa: a.id === 'ineligible' ? 6.3 : 8.5,
        skills:
          a.id === 'ineligible'
            ? []
            : [{ id: `${a.id}-react`, name: 'React', level: 'Advanced', verified: false }],
      });
      await db.put('workspace', a.id, profile, a.campusId, a.id);
    }
    await db.put('drive', drive.id, drive, drive.campusId, recruiter.id);
    await db.transaction(() => notifyPlacementStudents(db, { ...drive, status: 'DRAFT' }));
    assert.equal(
      (await db.list('notification')).length,
      0,
      'Unpublished drives must not notify students.',
    );
    await db.transaction(() => notifyPlacementStudents(db, drive));
    await db.transaction(() => notifyPlacementStudents(db, drive));
    assert.equal(
      (await db.list('notification')).length,
      2,
      'Notify approved students once, scoped to their college.',
    );
    const eligible = await db.list<Notification>('notification', 'college', 'eligible');
    const ineligible = await db.list<Notification>('notification', 'college', 'ineligible');
    assert.match(eligible[0].title, /Eligible for placement/);
    assert.match(eligible[0].body, /2026-11-01, reporting at 09:00; venue: Placement Hall/);
    assert.match(eligible[0].body, /Apply before 2026-10-25/);
    assert.match(ineligible[0].title, /Not eligible for placement/);
    assert.match(ineligible[0].body, /Missing skills: React/);
    assert.match(ineligible[0].body, /Minimum 7; your CGPA 6.3/);
    assert.equal(ineligible[0].href, '/student/opportunities/placement');
    const workspace = (await runWorkspace(db, students[1], undefined, () =>
      dispatch('studentService', 'getDashboard', []),
    )) as WorkspaceData;
    assert.ok(
      workspace.opportunities.some((o) => o.id === drive.id),
      'Ineligible students can open the placement and its reasons.',
    );
    assert.equal(workspace.notifications.length, 1);
    console.log(
      'Placement notifications passed: eligible and ineligible reasons, schedule, college scope, approval, visibility and deduplication.',
    );
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
