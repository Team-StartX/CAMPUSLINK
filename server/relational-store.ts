import type { Database, RecordRow } from './db';
import { tables, workspaceTables, type TableSpec } from './schema';

type ObjectValue = Record<string, any>;
type SqlValue = string | number | null;
interface StoredRow {
  record_id: string;
  value: string;
  campus_id: string | null;
  owner_id: string | null;
}
const nullable = (value: unknown): string | null =>
  typeof value === 'string' && value.length ? value : null;
const itemKey = (student: string, id: string) => JSON.stringify([student, id]);
const object = (value: unknown): ObjectValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an entity object.');
  return value as ObjectValue;
};

/** Keeps the public service contracts while storing each entity and relationship independently. */
export class RelationalStore {
  constructor(private db: Database) {}
  private spec(kind: string) {
    const spec = Object.hasOwn(tables, kind) ? tables[kind] : undefined;
    if (!spec) throw new Error(`Unknown database entity kind: ${kind}`);
    return spec;
  }
  private async rows(spec: TableSpec, campus?: string, owner?: string) {
    const values: SqlValue[] = [];
    const filters: string[] = [];
    for (const [column, scope] of [
      ['campus_id', campus],
      ['owner_id', owner],
    ] as const) {
      if (scope === undefined) continue;
      if (!scope) filters.push(`${column} IS NULL`);
      else {
        values.push(scope);
        filters.push(`${column}=$${values.length}`);
      }
    }
    return this.db.query<StoredRow>(
      `SELECT * FROM ${spec.table}${filters.length ? ` WHERE ${filters.join(' AND ')}` : ''} ORDER BY record_id`,
      values,
    );
  }
  async get<T>(kind: string, id: string): Promise<T | undefined> {
    const rows = await this.db.query<StoredRow>(
      `SELECT * FROM ${this.spec(kind).table} WHERE record_id=$1`,
      [id],
    );
    return rows[0] ? ((await this.decodeMany(kind, rows))[0] as T) : undefined;
  }
  async list<T>(kind: string, campus?: string, owner?: string): Promise<T[]> {
    const rows = await this.rows(this.spec(kind), campus, owner);
    return (await this.decodeMany(kind, rows)) as T[];
  }
  private async grouped(
    table: string,
    parentColumn: string,
    ids: string[],
    order = 'record_id',
    field = 'value',
  ) {
    const groups = new Map<string, any[]>();
    // Bound parameter counts for large campus cohorts on both database engines.
    for (let offset = 0; offset < ids.length; offset += 400) {
      const batch = ids.slice(offset, offset + 400);
      const rows = await this.db.query<{ parent: string; item: string }>(
        `SELECT ${parentColumn} AS parent,${field} AS item FROM ${table} WHERE ${parentColumn} IN (${batch.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY ${parentColumn},${order}`,
        batch,
      );
      for (const row of rows) {
        const entries = groups.get(row.parent) || [];
        entries.push(field === 'value' ? JSON.parse(row.item) : row.item);
        groups.set(row.parent, entries);
      }
    }
    return groups;
  }
  private async decodeMany(kind: string, rows: StoredRow[]) {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.record_id);
    const values = rows.map((row) => JSON.parse(row.value));
    if (kind === 'workspace') {
      const keys = ['skills', 'projects', 'documents', 'offers', 'interviews', 'history'] as const;
      const [profiles, applications, ...collections] = await Promise.all([
        this.grouped('student_profiles', 'account_id', ids),
        this.grouped('applications', 'student_id', ids, 'sort_order,record_id'),
        ...keys.map((key) =>
          this.grouped(workspaceTables[key].table, 'student_id', ids, 'sort_order,record_id'),
        ),
      ]);
      for (const [index, value] of values.entries()) {
        const id = ids[index];
        value.student = profiles.get(id)?.[0];
        if (!value.student) throw new Error('Workspace is missing its profile.');
        for (const [i, key] of keys.entries()) {
          const entries = collections[i].get(id) || [];
          if (key === 'skills') value.student.skills = entries;
          else if (key === 'projects') value.student.projects = entries.map((p) => p.title);
          else value[key] = entries;
        }
        value.applications = applications.get(id) || [];
      }
    } else if (kind === 'drive') {
      const [rounds, schedules] = await Promise.all([
        this.grouped('recruitment_rounds', 'drive_id', ids, 'sort_order,record_id'),
        this.grouped('drive_schedules', 'drive_id', ids),
      ]);
      for (const [index, value] of values.entries()) {
        const id = ids[index];
        if (value.hasRounds)
          value.rounds = (rounds.get(id) || []).map((r) => {
            const { driveId, roundId, order, recruiterId, ...round } = r;
            return { ...round, id: roundId };
          });
        delete value.hasRounds;
        const schedule = schedules.get(id)?.[0];
        if (schedule) {
          const { driveId, status, ...fields } = schedule;
          value.schedule = fields;
        }
      }
    } else if (kind === 'admin-assessment') {
      const questions = await this.grouped(
        'assessment_questions',
        'assessment_id',
        ids,
        'sort_order',
        'question_id',
      );
      for (const [index, value] of values.entries())
        value.questionIds = questions.get(ids[index]) || [];
    } else if (kind === 'template') {
      const campuses = await this.grouped(
        'template_campuses',
        'template_id',
        ids,
        'campus_id',
        'campus_id',
      );
      for (const [index, value] of values.entries())
        value.campusIds = campuses.get(ids[index]) || [];
    }
    return values;
  }
  private async upsert(
    spec: TableSpec,
    id: string,
    value: unknown,
    campus: string | null,
    owner: string | null,
    fields: Record<string, SqlValue>,
  ) {
    const columns = ['record_id', 'value', 'campus_id', 'owner_id', ...Object.keys(fields)];
    const values = [id, JSON.stringify(value), campus, owner, ...Object.values(fields)];
    await this.db.query(
      `INSERT INTO ${spec.table}(${columns.join(',')}) VALUES(${values.map((_, i) => `$${i + 1}`).join(',')})
      ON CONFLICT(record_id) DO UPDATE SET ${columns
        .slice(1)
        .map((key) => `${key}=excluded.${key}`)
        .join(',')}`,
      values,
    );
  }
  async put(kind: string, id: string, input: unknown, campus = '', owner = '') {
    this.spec(kind);
    const value = structuredClone(input);
    const v = Array.isArray(value) ? {} : object(value);
    if (campus && v.campusId && campus !== v.campusId)
      throw new Error('Entity campus does not match its scope.');
    let scope = nullable(campus || v.campusId);
    let accountOwner = nullable(owner);
    const fields: Record<string, SqlValue> = {};
    switch (kind) {
      case 'campus':
        scope = nullable(campus);
        Object.assign(fields, { name: v.name, location: v.location ?? '' });
        break;
      case 'account':
        if (id !== v.email || v.email !== v.email?.trim().toLowerCase())
          throw new Error('Account key must be its normalized email.');
        accountOwner = v.id;
        Object.assign(fields, {
          id: v.id,
          email: v.email,
          role: v.role,
          name: v.name,
          password_hash: v.passwordHash,
          approved: +!!v.approved,
          verified: +!!v.verified,
          created_at: v.createdAt,
        });
        break;
      case 'workspace':
        if (id !== owner || (v.student.id && v.student.id !== id))
          throw new Error('Workspace must belong to its account.');
        fields.account_id = id;
        await this.writeWorkspace(id, v, scope);
        break;
      case 'organization':
        fields.recruiter_id = owner || id;
        accountOwner = nullable(owner || id);
        break;
      case 'campus-recruiter':
        Object.assign(fields, { recruiter_id: v.recruiterId, status: v.status });
        break;
      case 'drive': {
        if (owner && owner !== v.recruiterId) throw new Error('Drive owner must be its recruiter.');
        accountOwner = v.recruiterId;
        Object.assign(fields, {
          recruiter_id: v.recruiterId,
          opportunity_id: v.opportunityId || id,
          company: v.company,
          role: v.role,
          status: v.status,
          vacancies: v.vacancies,
          minimum_cgpa: v.cgpa,
        });
        const rounds = v.rounds;
        const schedule = v.schedule;
        v.hasRounds = Array.isArray(rounds);
        delete v.rounds;
        delete v.schedule;
        await this.upsert(this.spec(kind), id, v, scope, accountOwner, fields);
        const keep: string[] = [];
        for (const [order, round] of (rounds || []).entries()) {
          const roundId = `${id}:${round.id}`;
          keep.push(roundId);
          await this.put(
            'recruitment-round',
            roundId,
            {
              ...round,
              id: roundId,
              roundId: round.id,
              driveId: id,
              order,
              recruiterId: v.recruiterId,
            },
            scope || '',
            accountOwner || '',
          );
        }
        await this.prune('recruitment_rounds', 'drive_id', id, keep);
        if (schedule)
          await this.put(
            'drive-schedule',
            id,
            { ...schedule, driveId: id, status: v.status },
            scope || '',
            accountOwner || '',
          );
        else await this.db.query('DELETE FROM drive_schedules WHERE drive_id=$1', [id]);
        return;
      }
      case 'recruitment-round':
        Object.assign(fields, {
          drive_id: v.driveId,
          round_id: v.roundId,
          sort_order: v.order,
          name: v.name,
          duration: v.duration,
        });
        break;
      case 'drive-schedule':
        Object.assign(fields, {
          drive_id: v.driveId,
          scheduled_date: v.date,
          venue: v.venue ?? '',
        });
        break;
      case 'application': {
        const studentId = v.studentId || owner;
        const driveRows = await this.db.query<{
          record_id: string;
          campus_id: string | null;
          opportunity_id: string;
        }>(
          v.driveId
            ? 'SELECT record_id,campus_id,opportunity_id FROM drives WHERE record_id=$1'
            : 'SELECT record_id,campus_id,opportunity_id FROM drives WHERE opportunity_id=$1',
          [v.driveId || v.opportunityId],
        );
        const drive = driveRows[0];
        if (
          !drive ||
          (scope && drive.campus_id !== scope) ||
          (v.opportunityId && drive.opportunity_id !== v.opportunityId)
        )
          throw new Error('Application must reference a drive in its campus.');
        if (owner && owner !== studentId) throw new Error('Application owner must be its student.');
        scope = drive.campus_id;
        accountOwner = studentId;
        const previous = await this.db.query<{
          sort_order: number;
          student_id: string;
          drive_id: string;
        }>('SELECT sort_order,student_id,drive_id FROM applications WHERE record_id=$1', [id]);
        if (
          previous[0] &&
          (previous[0].student_id !== studentId || previous[0].drive_id !== drive.record_id)
        )
          throw new Error('Application student and drive cannot be changed.');
        Object.assign(fields, {
          student_id: studentId,
          drive_id: drive.record_id,
          opportunity_id: drive.opportunity_id,
          current_round_id: nullable(v.currentRoundId),
          resume_id: nullable(v.resumeId),
          stage: v.stage,
          applied_at: v.date,
          sort_order: v.sortOrder ?? previous[0]?.sort_order ?? 0,
        });
        v.driveId = drive.record_id;
        v.studentId = studentId;
        delete v.sortOrder;
        break;
      }
      case 'interest':
        Object.assign(fields, { drive_id: v.driveId, student_id: v.studentId, interest: v.value });
        break;
      case 'candidate-round':
        Object.assign(fields, {
          drive_id: v.driveId,
          round_id: v.roundId,
          application_id: v.applicationId,
          student_id: v.studentId,
          status: v.status,
          score: v.score ?? null,
          published: +!!v.published,
        });
        break;
      case 'assignment':
        Object.assign(fields, {
          drive_id: v.driveId,
          round_id: v.roundId,
          title: v.title,
          maximum_marks: v.maximumMarks,
          deadline: v.deadline,
        });
        break;
      case 'assignment-submission': {
        const assignment = await this.db.query<{ drive_id: string }>(
          'SELECT drive_id FROM assignments WHERE record_id=$1',
          [v.assignmentId],
        );
        if (!assignment[0]) throw new Error('Submission assignment does not exist.');
        Object.assign(fields, {
          assignment_id: v.assignmentId,
          drive_id: assignment[0].drive_id,
          application_id: v.applicationId,
          student_id: v.studentId,
          document_id: nullable(v.documentId),
          submitted_at: v.submittedAt,
        });
        break;
      }
      case 'interview-slot':
        Object.assign(fields, {
          drive_id: v.driveId,
          round_id: v.roundId,
          student_id: v.audience === 'round' ? null : v.studentId,
          recruiter_id: v.recruiterId,
          audience: v.audience || 'student',
          scheduled_date: v.date,
          scheduled_time: v.time,
          duration: v.duration,
          venue: v.venue ?? '',
          room: v.room ?? '',
          panel: v.panel,
        });
        break;
      case 'admin-question':
        Object.assign(fields, { prompt: v.prompt, topic: v.topic, answer: v.answer });
        break;
      case 'admin-assessment':
        Object.assign(fields, { name: v.name, duration: v.duration, status: v.status });
        await this.db.query('DELETE FROM assessment_questions WHERE assessment_id=$1', [id]);
        for (const [order, questionId] of (v.questionIds || []).entries())
          await this.db.query(
            'INSERT INTO assessment_questions(assessment_id,question_id,sort_order) VALUES($1,$2,$3)',
            [id, questionId, order],
          );
        delete v.questionIds;
        break;
      case 'admin-contest':
        Object.assign(fields, { name: v.name, duration: v.duration, status: v.status });
        break;
      case 'campus-assessment':
        Object.assign(fields, {
          title: v.title,
          duration: v.duration,
          maximum_marks: v.maximumMarks,
          passing_marks: v.passingMarks,
          starts_at: v.start,
          ends_at: v.end,
        });
        break;
      case 'campus-assessment-session':
        Object.assign(fields, {
          assessment_id: id.slice(0, -(owner.length + 1)),
          student_id: owner,
          started_at: v.started,
        });
        break;
      case 'campus-assessment-attempt':
        Object.assign(fields, {
          assessment_id: v.assessmentId,
          student_id: v.studentId,
          score: v.score,
          submitted_at: v.date,
        });
        break;
      case 'assessment-session':
        Object.assign(fields, {
          student_id: owner,
          assessment_id: v.assessmentId,
          started_at: v.started,
          submitted: +!!v.submitted,
        });
        break;
      case 'session':
      case 'token':
        Object.assign(fields, { user_id: v.userId, expires_at: v.expires });
        break;
      case 'notification':
        Object.assign(fields, { user_id: owner, title: v.title, is_read: +!!v.read });
        break;
      case 'template':
        Object.assign(fields, { recruiter_id: v.recruiterId || owner, name: v.name });
        await this.db.query('DELETE FROM template_campuses WHERE template_id=$1', [id]);
        for (const campusId of v.campusIds || [])
          await this.db.query(
            'INSERT INTO template_campuses(template_id,campus_id) VALUES($1,$2)',
            [id, campusId],
          );
        delete v.campusIds;
        break;
      case 'audit':
        Object.assign(fields, {
          actor_id: v.role === 'system' ? null : nullable(v.actorId || v.user_id || owner),
          action: v.action || v.event || 'workspace-updated',
          occurred_at: v.timestamp || v.time || null,
        });
        break;
      case 'mail':
        Object.assign(fields, {
          recipient: v.recipient,
          status: v.status,
          attempts: v.attempts,
          next_at: v.nextAt,
        });
        break;
      case 'storage-gc':
        fields.storage_key = v.key;
        break;
    }
    for (const [key, field] of Object.entries(fields)) {
      if (field === undefined) throw new Error(`Missing required database field ${kind}.${key}.`);
    }
    await this.upsert(this.spec(kind), id, value, scope, accountOwner, fields);
  }
  private async prune(table: string, column: string, id: string, keep: string[]) {
    const rows = await this.db.query<{ record_id: string }>(
      `SELECT record_id FROM ${table} WHERE ${column}=$1`,
      [id],
    );
    const ids = new Set(keep);
    for (const row of rows)
      if (!ids.has(row.record_id))
        await this.db.query(`DELETE FROM ${table} WHERE record_id=$1`, [row.record_id]);
  }
  private async writeWorkspace(id: string, value: ObjectValue, campus: string | null) {
    const student = object(value.student);
    const profile = { ...student };
    delete profile.skills;
    delete profile.projects;
    await this.upsert(workspaceTables.student, id, profile, campus, id, {
      account_id: id,
      cgpa: student.cgpa,
      active_backlogs: student.activeBacklogs ?? 0,
      course: student.course ?? '',
      branch: student.branch ?? '',
      graduation_year: student.year ?? '',
    });
    for (const [key, spec] of Object.entries(workspaceTables)) {
      if (key === 'student') continue;
      const entries: ObjectValue[] =
        key === 'skills'
          ? student.skills || []
          : key === 'projects'
            ? (student.projects || []).map((title: string, index: number) => ({
                id: String(index),
                title,
              }))
            : value[key] || [];
      const keep: string[] = [];
      for (const [order, entry] of entries.entries()) {
        const rowId = itemKey(id, entry.id);
        keep.push(rowId);
        const fields: Record<string, SqlValue> = {
          student_id: id,
          item_id: entry.id,
          sort_order: order,
        };
        switch (key) {
          case 'skills':
            Object.assign(fields, {
              name: entry.name,
              normalized_name: entry.name.trim().toLowerCase(),
              level: entry.level,
              verified: +!!entry.verified,
            });
            break;
          case 'projects':
            fields.title = entry.title;
            break;
          case 'documents':
            Object.assign(fields, {
              name: entry.name,
              document_type: entry.type,
              status: entry.status,
              storage_key: nullable(entry.storageKey),
            });
            break;
          case 'offers':
            Object.assign(fields, {
              application_id: nullable(entry.applicationId),
              company: entry.company,
              role: entry.role,
              status: entry.status,
              recruiter_id: nullable(entry.recruiterId),
            });
            break;
          case 'interviews':
            Object.assign(fields, {
              company: entry.company,
              status: entry.status,
              scheduled_date: entry.date,
              recruiter_id: nullable(entry.recruiterId),
            });
            break;
          case 'history':
            // Historical practice can outlive its catalog item. Keep its actual snapshot, never invent questions.
            await this.activity(id, { id: entry.assessmentId, name: entry.name, type: entry.type });
            Object.assign(fields, {
              assessment_id: entry.assessmentId,
              score: entry.score,
              points: entry.points,
              submitted_at: entry.date,
            });
            break;
        }
        await this.upsert(spec, rowId, entry, campus, id, fields);
      }
      await this.prune(spec.table, 'student_id', id, keep);
      if (key !== 'skills' && key !== 'projects') delete value[key];
    }
    const applications = value.applications || [];
    const applicationIds: string[] = [];
    for (const [order, application] of applications.entries()) {
      applicationIds.push(application.id);
      await this.put(
        'application',
        application.id,
        { ...application, studentId: id, sortOrder: order },
        campus || '',
        id,
      );
    }
    await this.prune('applications', 'student_id', id, applicationIds);
    for (const item of [...(value.assessments || []), ...(value.contests || [])])
      await this.activity(id, item);
    delete value.student;
    delete value.applications;
  }
  private async activity(student: string, entry: ObjectValue) {
    await this.db.query(
      `INSERT INTO student_activities(student_id,activity_id,name,activity_type,value) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(student_id,activity_id) DO NOTHING`,
      [student, entry.id, entry.name || '', entry.type || '', JSON.stringify(entry)],
    );
  }
  async remove(kind: string, id: string) {
    if (kind === 'workspace') {
      for (const spec of Object.values(workspaceTables))
        await this.db.query(
          `DELETE FROM ${spec.table} WHERE ${spec.table === 'student_profiles' ? 'account_id' : 'student_id'}=$1`,
          [id],
        );
      await this.db.query('DELETE FROM applications WHERE student_id=$1', [id]);
      await this.db.query('DELETE FROM student_activities WHERE student_id=$1', [id]);
    }
    if (kind === 'drive') {
      await this.db.query('DELETE FROM drive_schedules WHERE drive_id=$1', [id]);
      await this.db.query('DELETE FROM recruitment_rounds WHERE drive_id=$1', [id]);
    }
    if (kind === 'admin-assessment')
      await this.db.query('DELETE FROM assessment_questions WHERE assessment_id=$1', [id]);
    if (kind === 'template')
      await this.db.query('DELETE FROM template_campuses WHERE template_id=$1', [id]);
    await this.db.query(`DELETE FROM ${this.spec(kind).table} WHERE record_id=$1`, [id]);
  }
  async migrateLegacy(rows: RecordRow[], progress?: (message: string) => void) {
    // Validate the whole legacy kind set before copying any data.
    for (const row of rows) this.spec(row.kind);
    const priority = [
      'campus',
      'account',
      'drive',
      'workspace',
      'admin-question',
      'admin-assessment',
      'admin-contest',
      'campus-assessment',
      'application',
      'assignment',
    ];
    const rank = (kind: string) =>
      priority.includes(kind) ? priority.indexOf(kind) : priority.length;
    let completed = 0;
    for (const row of [...rows].sort((a, b) => rank(a.kind) - rank(b.kind))) {
      try {
        const value = JSON.parse(row.value);
        if (row.kind === 'application') {
          const canonical = await this.get<ObjectValue>('application', row.id);
          if (canonical) {
            if (canonical.studentId !== value.studentId || canonical.driveId !== value.driveId)
              throw new Error('Conflicting application relationships.');
            // Workspace was the source used by dashboards; avoid restoring a stale duplicate stage.
            Object.assign(value, canonical);
          }
        }
        await this.put(row.kind, row.id, value, row.campus_id, row.owner_id);
        completed++;
        if (completed % 10 === 0)
          progress?.(`Copied ${completed} of ${rows.length} legacy records.`);
      } catch (error) {
        throw new Error(
          `Relational migration failed for ${row.kind}; legacy records were preserved.`,
          { cause: error },
        );
      }
    }
  }
}
