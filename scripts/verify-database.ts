import assert from 'node:assert/strict';
import { Database } from '../server/db';
import { Authentication } from '../server/auth';
import { config } from '../server/config';
import { alignmentId, allTables, legacyGuardId, migrationId } from '../server/schema';
import type { WorkspaceData } from '../src/types';
import type { StoredDrive } from '../server/workspace';

async function main() {
  const local = process.argv.includes('--local') || !config.database;
  const db = local ? new Database('', config.localDatabase) : new Database();
  try {
    const markers = await db.query<{ id: string }>('SELECT id FROM migrations');
    for (const id of [migrationId, legacyGuardId, alignmentId])
      assert.ok(
        markers.some((m) => m.id === id),
        `Missing migration ${id}`,
      );
    const counts = await db.query<{ table_name: string; count: number | string }>(
      [
        ...allTables.map((spec) => spec.table),
        'student_activities',
        'assessment_questions',
        'template_campuses',
        'records',
      ]
        .map((table) => `SELECT '${table}' AS table_name,count(*) AS count FROM ${table}`)
        .join(' UNION ALL '),
    );
    const primaryKey = local
      ? (await db.query<{ name: string; pk: number }>('PRAGMA table_info(accounts)'))
          .filter((c) => c.pk)
          .map((c) => c.name)
      : (
          await db.query<{ column_name: string }>(
            "SELECT k.column_name FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k ON k.constraint_name=t.constraint_name AND k.constraint_schema=t.constraint_schema WHERE t.table_schema=current_schema() AND t.table_name='accounts' AND t.constraint_type='PRIMARY KEY' ORDER BY k.ordinal_position",
          )
        ).map((c) => c.column_name);
    assert.deepEqual(primaryKey, ['id'], 'Account primary key must be its stable account ID');
    if (local) assert.deepEqual(await db.query('PRAGMA foreign_key_check'), []);
    const invalid = await db.query<{ count: number | string }>(
      `SELECT count(*) AS count FROM applications a LEFT JOIN accounts s ON s.id=a.student_id LEFT JOIN drives d ON d.record_id=a.drive_id
       WHERE s.id IS NULL OR d.record_id IS NULL OR a.campus_id IS NULL OR s.campus_id IS NULL OR d.campus_id IS NULL OR s.campus_id<>a.campus_id OR d.campus_id<>a.campus_id`,
    );
    assert.equal(
      Number(invalid[0].count),
      0,
      'Application relationships must match their student, drive and campus',
    );
    const workspaces = await db.list<WorkspaceData>('workspace');
    const drives = await db.list<StoredDrive>('drive');
    for (const workspace of workspaces)
      assert.ok(
        workspace.student &&
          Array.isArray(workspace.documents) &&
          Array.isArray(workspace.applications),
      );
    for (const drive of drives) assert.ok(drive.id && drive.recruiterId);
    const user = (await db.query<{ id: string }>('SELECT id FROM accounts ORDER BY id LIMIT 1'))[0];
    if (user) assert.equal((await new Authentication(db).byId(user.id))?.id, user.id);
    console.log(
      JSON.stringify(
        {
          database: local ? 'SQLite' : 'PostgreSQL',
          migrations: markers.map((m) => m.id),
          rows: Object.fromEntries(counts.map((c) => [c.table_name, Number(c.count)])),
          dashboardReads: 'passed',
          accountLookup: 'passed',
          applicationRelationships: 'passed',
        },
        null,
        2,
      ),
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
