import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { Database } from '../server/db';
import { Authentication, type Account } from '../server/auth';
import { emptyWorkspace, type StoredDrive } from '../server/workspace';
import { defaultDrive } from '../src/services/drive.defaults';
import {
  alignmentId,
  allTables,
  campusRequiredKinds,
  migrationId,
  relationalSchema,
  tables,
} from '../server/schema';
import type { WorkspaceData } from '../src/types';
import { config } from '../server/config';

const folder = fs.mkdtempSync(path.resolve('tmp/database-schema-'));
const account = (id: string, role: Account['role'], campusId = 'campus'): Account => ({
  id,
  role,
  campusId,
  email: `${id}@example.test`,
  name: id,
  organization: 'Test',
  passwordHash: '',
  approved: true,
  verified: true,
  createdAt: new Date().toISOString(),
});
const student = account('student', 'student');
const second = account('second', 'student');
const outsider = account('outsider', 'student', 'other');
const recruiter = account('recruiter', 'recruiter', '');
const drive: StoredDrive = {
  ...defaultDrive({
    id: 'drive',
    campusId: 'campus',
    company: 'Test',
    status: 'ACTIVE',
    rounds: [
      { id: 'round', name: 'Interview', duration: 30, capacity: 10, requirements: '', cleared: 0 },
    ],
  }),
  recruiterId: recruiter.id,
};
const profile = (actor = student): WorkspaceData => {
  const value = emptyWorkspace(actor, 'Test campus');
  value.student.skills = [{ id: 'skill', name: 'SQL', level: 'Intermediate', verified: true }];
  value.student.projects = ['Placement portal'];
  value.documents = [
    { id: 'resume', name: 'Resume.pdf', type: 'Resume', status: 'Pending', size: '1 KB' },
  ];
  return value;
};
const application = {
  id: 'app',
  studentId: student.id,
  driveId: drive.id,
  opportunityId: drive.id,
  currentRoundId: 'round',
  resumeId: 'resume',
  stage: 'Applied',
  date: '2026-10-09',
};
const result = {
  id: 'result',
  driveId: drive.id,
  roundId: 'round',
  applicationId: 'app',
  studentId: student.id,
  status: 'Pending',
  published: false,
  feedback: '',
};
const legacyDdl = `CREATE TABLE records(id TEXT NOT NULL,kind TEXT NOT NULL,campus_id TEXT NOT NULL DEFAULT '',owner_id TEXT NOT NULL DEFAULT '',value TEXT NOT NULL,PRIMARY KEY(kind,id));`;
type Legacy = [string, string, unknown, string?, string?];
function olderSchema(postgres: boolean) {
  let sql = relationalSchema(postgres)
    .replace('record_id TEXT NOT NULL UNIQUE,', 'record_id TEXT PRIMARY KEY,')
    .replace('id TEXT NOT NULL PRIMARY KEY', 'id TEXT NOT NULL UNIQUE');
  for (const kind of campusRequiredKinds) {
    const table = tables[kind].table;
    sql = sql.replace(
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\);`),
      (statement) => statement.replaceAll('CHECK(campus_id IS NOT NULL)', 'CHECK(1=1)'),
    );
  }
  return sql;
}
function legacyFile(name: string, rows: Legacy[]) {
  const file = path.join(folder, name);
  const db = new DatabaseSync(file);
  db.exec(legacyDdl);
  for (const [kind, id, value, campus = '', owner = ''] of rows)
    db.prepare('INSERT INTO records(kind,id,value,campus_id,owner_id) VALUES(?,?,?,?,?)').run(
      kind,
      id,
      JSON.stringify(value),
      campus,
      owner,
    );
  db.close();
  return file;
}
let postgres = false;
async function rejectWrite(db: Database, operation: () => Promise<unknown>) {
  await assert.rejects(operation);
  if (!postgres) assert.deepEqual(await db.query('PRAGMA foreign_key_check'), []);
}
async function constraints(db = new Database('', ':memory:'), close = true) {
  try {
    await db.migrate();
    if (!postgres)
      assert.equal(
        (await db.query<{ foreign_keys: number }>('PRAGMA foreign_keys'))[0].foreign_keys,
        1,
      );
    const names = (
      await db.query<{ name: string }>(
        postgres
          ? 'SELECT tablename AS name FROM pg_tables WHERE schemaname=current_schema()'
          : "SELECT name FROM sqlite_master WHERE type='table'",
      )
    ).map((row) => row.name);
    for (const table of allTables) assert.ok(names.includes(table.table));
    for (const id of ['campus', 'other'])
      await db.put('campus', id, { id, name: id, location: '' });
    for (const actor of [student, second, outsider, recruiter])
      await db.put('account', actor.email, actor, actor.campusId, actor.id);
    await db.put('drive', drive.id, drive, 'campus', recruiter.id);
    await db.put('workspace', student.id, profile(), 'campus', student.id);
    await db.put('workspace', second.id, profile(second), 'campus', second.id);
    await db.put('workspace', outsider.id, profile(outsider), 'other', outsider.id);
    assert.equal(
      Number(
        (await db.query<{ count: number }>('SELECT count(*) AS count FROM documents'))[0].count,
      ),
      3,
      'Document IDs are scoped per student',
    );
    await db.put('application', application.id, application, 'campus', student.id);
    await db.put('candidate-round', result.id, result, 'campus', student.id);
    assert.equal((await new Authentication(db).byId(student.id))?.email, student.email);
    assert.equal((await db.list('account', 'other')).length, 1);
    assert.equal(
      (await db.get<WorkspaceData>('workspace', student.id))!.applications[0].id,
      application.id,
      'Independent applications hydrate the dashboard',
    );
    await rejectWrite(db, () =>
      db.put(
        'account',
        'ghost@example.test',
        { ...account('ghost', 'student'), campusId: 'missing' },
        'missing',
        'ghost',
      ),
    );
    await rejectWrite(db, () =>
      db.put('application', 'duplicate', { ...application, id: 'duplicate' }, 'campus', student.id),
    );
    await rejectWrite(db, () =>
      db.put(
        'application',
        'cross-campus',
        { ...application, id: 'cross-campus', studentId: outsider.id },
        'campus',
        outsider.id,
      ),
    );
    await rejectWrite(db, () =>
      db.put(
        'application',
        'missing-round',
        { ...application, id: 'missing-round', studentId: second.id, currentRoundId: 'missing' },
        'campus',
        second.id,
      ),
    );
    await rejectWrite(db, () =>
      db.put(
        'application',
        'missing-resume',
        { ...application, id: 'missing-resume', studentId: second.id, resumeId: 'missing' },
        'campus',
        second.id,
      ),
    );
    await rejectWrite(db, () =>
      db.put(
        'candidate-round',
        'wrong-student',
        { ...result, id: 'wrong-student', studentId: second.id },
        'campus',
        second.id,
      ),
    );
    await rejectWrite(db, () =>
      db.put(
        'candidate-round',
        'wrong-score',
        { ...result, id: 'wrong-score', score: -1 },
        'campus',
        student.id,
      ),
    );
    await rejectWrite(db, () => db.remove('drive', drive.id));
    await rejectWrite(db, () => db.remove('account', student.email));
    const invalid = (await db.get<WorkspaceData>('workspace', student.id))!;
    invalid.student.cgpa = 11;
    await rejectWrite(db, () => db.put('workspace', student.id, invalid, 'campus', student.id));
    assert.equal(
      (await db.get<WorkspaceData>('workspace', student.id))!.student.cgpa,
      0,
      'Invalid aggregate updates roll back',
    );
    const changed = (await db.get<WorkspaceData>('workspace', student.id))!;
    changed.applications[0].stage = 'Selected';
    changed.offers.push({
      id: 'offer',
      applicationId: application.id,
      company: 'Test',
      role: 'Engineer',
      ctc: '6 LPA',
      date: '2026-10-09',
      joining: '2027-01-01',
      status: 'Offer Sent',
    });
    await db.put('workspace', student.id, changed, 'campus', student.id);
    assert.equal(
      (await db.get<{ stage: string }>('application', application.id))!.stage,
      'Selected',
      'One application source serves both APIs',
    );
    const joins = await db.query<{ student_id: string }>(
      'SELECT a.student_id FROM offers o JOIN applications a ON o.application_id=a.record_id JOIN drives d ON a.drive_id=d.record_id JOIN accounts u ON a.student_id=u.id WHERE d.record_id=$1',
      [drive.id],
    );
    assert.deepEqual(
      joins.map((r) => r.student_id),
      [student.id],
    );
    await db.put('admin-question', 'question', {
      prompt: 'SQL?',
      topic: 'SQL',
      options: ['Yes', 'No'],
      answer: 0,
    });
    await db.put('admin-assessment', 'assessment', {
      name: 'SQL',
      duration: 10,
      status: 'published',
      questionIds: ['question'],
    });
    await rejectWrite(db, () =>
      db.put('admin-assessment', 'broken-assessment', {
        name: 'SQL',
        duration: 10,
        status: 'published',
        questionIds: ['missing'],
      }),
    );
    assert.deepEqual(
      (await db.get<{ questionIds: string[] }>('admin-assessment', 'assessment'))!.questionIds,
      ['question'],
    );
    await db.put(
      'campus-assessment',
      'campus-test',
      {
        title: 'Campus test',
        duration: 10,
        maximumMarks: 10,
        passingMarks: 5,
        start: '2026-10-09T09:00:00Z',
        end: '2026-10-09T10:00:00Z',
      },
      'campus',
      recruiter.id,
    );
    await db.put(
      'campus-assessment-session',
      `campus-test:${student.id}`,
      { started: Date.now() },
      'campus',
      student.id,
    );
    await db.put(
      'campus-assessment-attempt',
      'campus-attempt',
      { assessmentId: 'campus-test', studentId: student.id, score: 8, date: '2026-10-09' },
      'campus',
      student.id,
    );
    await rejectWrite(db, () =>
      db.put(
        'campus-assessment-attempt',
        'cross-attempt',
        { assessmentId: 'campus-test', studentId: outsider.id, score: 8, date: '2026-10-09' },
        'campus',
        outsider.id,
      ),
    );
    await db.put(
      'assignment',
      'assignment',
      {
        driveId: drive.id,
        roundId: 'round',
        title: 'Task',
        maximumMarks: 100,
        deadline: '2026-11-01',
      },
      'campus',
      recruiter.id,
    );
    await db.put(
      'assignment-submission',
      'submission',
      {
        assignmentId: 'assignment',
        applicationId: application.id,
        studentId: student.id,
        documentId: 'resume',
        submittedAt: '2026-10-09',
      },
      'campus',
      student.id,
    );
    await rejectWrite(db, () =>
      db.put(
        'assignment-submission',
        'bad-submission',
        {
          assignmentId: 'assignment',
          applicationId: application.id,
          studentId: second.id,
          submittedAt: '2026-10-09',
        },
        'campus',
        second.id,
      ),
    );
    await db.migrate();
    assert.equal(
      Number(
        (
          await db.query<{ count: number }>(
            'SELECT count(*) AS count FROM migrations WHERE id=$1',
            [migrationId],
          )
        )[0].count,
      ),
      1,
    );
    assert.equal(
      Number((await db.query<{ count: number }>('SELECT count(*) AS count FROM records'))[0].count),
      0,
      'No live writes go to the legacy table',
    );
    await assert.rejects(
      () => db.query("INSERT INTO records(kind,id,value) VALUES('account','old-backend','{}')"),
      /read-only/,
    );
    // PostgreSQL uses the same tables, adding forward-referencing foreign keys after all CREATEs.
    const pg = relationalSchema(true);
    assert.ok(pg.includes('ALTER TABLE applications ADD CONSTRAINT'));
    assert.ok(
      pg.indexOf('CREATE TABLE IF NOT EXISTS documents') <
        pg.indexOf('ALTER TABLE applications ADD CONSTRAINT'),
    );
    console.log(
      'PASS: relational joins, tenant isolation, uniqueness, foreign keys, score checks, aggregate rollback, and live storage routing.',
    );
  } finally {
    if (close) await db.close();
  }
}
async function postgresChecks() {
  if (!config.database) throw new Error('PostgreSQL checks require a configured DATABASE_URL.');
  const schema = `campuslink_schema_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^campuslink_schema_test_[a-f0-9]{32}$/.test(schema))
    throw new Error('Invalid test schema name.');
  const admin = new Database();
  try {
    console.log('Checking PostgreSQL in an isolated schema with synthetic fixtures.');
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(config.database);
    url.searchParams.set(
      'options',
      `${url.searchParams.get('options') || ''} -c search_path=${schema}`.trim(),
    );
    const db = new Database(url.toString());
    try {
      assert.equal(
        (await db.query<{ name: string }>('SELECT current_schema() AS name'))[0].name,
        schema,
        'PostgreSQL tests must remain in their isolated schema',
      );
      postgres = true;
      if (!process.argv.includes('--postgres-backfill-only')) await constraints(db, false);
      // Verify the actual PostgreSQL backfill, not just creation of empty tables.
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.query(`CREATE SCHEMA ${schema}`);
      const migrationDb = new Database(url.toString());
      try {
        assert.equal(
          (await migrationDb.query<{ name: string }>('SELECT current_schema() AS name'))[0].name,
          schema,
        );
        console.log('Checking PostgreSQL legacy backfill and repeat migration.');
        await migrationDb.query(legacyDdl);
        // Simulate the earlier table definitions. The migration adds foreign keys and aligns the key/checks.
        await migrationDb.query(
          olderSchema(true)
            .split(';')
            .filter((statement) => !statement.trim().includes(' ADD CONSTRAINT '))
            .join(';'),
        );
        const workspace = profile();
        workspace.applications.push({ ...application, stage: 'Selected' });
        const rows: Legacy[] = [
          ['campus', 'campus', { id: 'campus', name: 'Test campus', location: '' }],
          ['account', student.email, student, 'campus', student.id],
          ['account', recruiter.email, recruiter, '', recruiter.id],
          ['drive', drive.id, drive, 'campus', recruiter.id],
          ['workspace', student.id, workspace, 'campus', student.id],
          ['application', application.id, application, 'campus', student.id],
          ['candidate-round', result.id, result, 'campus', student.id],
        ];
        for (const [kind, id, value, campus = '', owner = ''] of rows)
          await migrationDb.query(
            'INSERT INTO records(kind,id,value,campus_id,owner_id) VALUES($1,$2,$3,$4,$5)',
            [kind, id, JSON.stringify(value), campus, owner],
          );
        await migrationDb.migrate();
        const key = await migrationDb.query<{ column_name: string }>(
          "SELECT k.column_name FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k ON k.constraint_name=t.constraint_name AND k.constraint_schema=t.constraint_schema WHERE t.table_schema=current_schema() AND t.table_name='accounts' AND t.constraint_type='PRIMARY KEY'",
        );
        assert.deepEqual(
          key.map((row) => row.column_name),
          ['id'],
        );
        assert.equal(
          (await migrationDb.get<{ stage: string }>('application', 'app'))!.stage,
          'Selected',
        );
        assert.equal(
          Number(
            (await migrationDb.query<{ count: string }>('SELECT count(*) AS count FROM records'))[0]
              .count,
          ),
          rows.length,
        );
        await migrationDb.migrate();
        console.log(
          'PASS: PostgreSQL schema execution, deferred foreign keys, transaction rollback, legacy backfill, and repeat migration.',
        );
      } finally {
        await migrationDb.close();
      }
    } finally {
      await db.close();
      postgres = false;
    }
  } finally {
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.close();
    }
  }
}
async function sqliteAlignment() {
  const file = legacyFile('older-relational.sqlite', []);
  const raw = new DatabaseSync(file);
  raw.exec(olderSchema(false));
  raw.exec(
    `CREATE TABLE migrations(id TEXT PRIMARY KEY); INSERT INTO migrations(id) VALUES('${migrationId}');`,
  );
  raw.close();
  const db = new Database('', file);
  try {
    await db.put('campus', 'campus', { id: 'campus', name: 'Test campus', location: '' });
    for (const actor of [student, recruiter])
      await db.put('account', actor.email, actor, actor.campusId, actor.id);
    await db.put('drive', drive.id, drive, 'campus', recruiter.id);
    await db.put('workspace', student.id, profile(), 'campus', student.id);
    const before = await db.get<WorkspaceData>('workspace', student.id);
    await db.migrate();
    const columns = await db.query<{ name: string; pk: number }>('PRAGMA table_info(accounts)');
    assert.deepEqual(
      columns.filter((column) => column.pk).map((column) => column.name),
      ['id'],
    );
    assert.deepEqual(
      await db.get('workspace', student.id),
      before,
      'Account key repair preserves profile/child rows',
    );
    assert.equal(
      (await db.query<{ owner_id: string }>('SELECT owner_id FROM documents'))[0].owner_id,
      student.id,
    );
    await rejectWrite(db, () =>
      db.put(
        'drive',
        'missing-campus',
        { ...drive, id: 'missing-campus', campusId: '' },
        '',
        recruiter.id,
      ),
    );
    assert.equal(
      (await db.query('SELECT id FROM migrations WHERE id=$1', [alignmentId])).length,
      1,
    );
    await db.migrate();
    console.log(
      'PASS: alignment of earlier SQLite account keys and campus checks without losing child data.',
    );
  } finally {
    await db.close();
  }
}
async function migrations() {
  const workspace = profile();
  workspace.applications.push({ ...application, stage: 'Selected' });
  workspace.history.push({
    id: 'historic',
    assessmentId: 'retired',
    name: 'Retired practice',
    type: 'Technical',
    score: 80,
    points: 0,
    date: '2026-10-09',
    seconds: 100,
  });
  const rows: Legacy[] = [
    ['campus', 'campus', { id: 'campus', name: 'Test campus', location: '' }],
    ['account', student.email, student, 'campus', student.id],
    ['account', recruiter.email, recruiter, '', recruiter.id],
    ['drive', drive.id, drive, 'campus', recruiter.id],
    ['workspace', student.id, workspace, 'campus', student.id],
    ['application', application.id, application, 'campus', student.id],
    ['candidate-round', result.id, result, 'campus', student.id],
  ];
  const file = legacyFile('valid.sqlite', rows);
  const db = new Database('', file);
  try {
    await db.migrate();
    assert.equal(
      (await db.get<{ stage: string }>('application', 'app'))!.stage,
      'Selected',
      'Migration preserves the dashboard stage over a stale duplicate',
    );
    const after = (await db.get<WorkspaceData>('workspace', student.id))!;
    assert.deepEqual(after.student, workspace.student);
    assert.deepEqual(after.documents, workspace.documents);
    assert.deepEqual(after.history, workspace.history);
    assert.equal(
      (await db.query<{ count: number }>('SELECT count(*) AS count FROM records'))[0].count,
      rows.length,
    );
    const before = JSON.stringify(after);
    await db.migrate();
    assert.equal(
      JSON.stringify(await db.get('workspace', student.id)),
      before,
      'A repeat migration does not reset progress',
    );
    assert.ok(
      fs
        .readdirSync(path.join(folder, 'backups'))
        .some((name) => name.startsWith('valid.sqlite.pre-relational-')),
    );
    assert.deepEqual(await db.query('PRAGMA foreign_key_check'), []);
  } finally {
    await db.close();
  }
  for (const [name, invalid] of [
    ['unknown', [['unknown-kind', 'unknown', {}]]],
    [
      'orphan',
      [['account', student.email, { ...student, campusId: 'missing' }, 'missing', student.id]],
    ],
  ] as [string, Legacy[]][]) {
    const bad = new Database('', legacyFile(`${name}.sqlite`, invalid));
    try {
      await assert.rejects(() => bad.migrate());
      assert.equal(
        (await bad.query<{ count: number }>('SELECT count(*) AS count FROM records'))[0].count,
        invalid.length,
      );
      assert.deepEqual(await bad.query('SELECT id FROM migrations WHERE id=$1', [migrationId]), []);
      assert.deepEqual(
        await bad.query("SELECT name FROM sqlite_master WHERE name='accounts'"),
        [],
        'DDL and data both roll back',
      );
    } finally {
      await bad.close();
    }
  }
  console.log(
    'PASS: legacy migration, backups, historical snapshots, stale duplicate reconciliation, reruns, and failure rollback.',
  );
}
async function localCopy() {
  const source = path.resolve('server/data/campuslink.sqlite');
  const file = path.join(folder, 'local-copy.sqlite');
  const snapshot = new DatabaseSync(source, { readOnly: true });
  snapshot.prepare('VACUUM INTO ?').run(file);
  snapshot.close();
  const db = new Database('', file);
  try {
    await db.migrate();
    assert.deepEqual(await db.query('PRAGMA foreign_key_check'), []);
    console.log('PASS: migration of a consistent copy of the existing local database.');
  } finally {
    await db.close();
  }
}
async function main() {
  try {
    await constraints();
    await migrations();
    await sqliteAlignment();
    if (process.argv.includes('--local-copy')) await localCopy();
    if (process.argv.includes('--postgres') || process.argv.includes('--postgres-backfill-only'))
      await postgresChecks();
  } finally {
    // Only this run's generated directory, resolved below the workspace tmp directory.
    const root = path.resolve('tmp') + path.sep;
    if (!folder.startsWith(root)) throw new Error('Unsafe test cleanup path.');
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
