/** Portable relational schema. JSON holds flexible attributes; keys and relationships are SQL columns. */
export interface TableSpec {
  table: string;
  primaryKey?: string;
  columns: Record<string, string>;
  constraints?: string[];
  indexes?: string[][];
}
const ref = (table: string, column = 'record_id', onDelete = 'NO ACTION') =>
  `REFERENCES ${table}(${column}) ON DELETE ${onDelete} DEFERRABLE INITIALLY DEFERRED`;
const account = `TEXT ${ref('accounts', 'id')}`;
const requiredAccount = `TEXT NOT NULL ${ref('accounts', 'id')}`;
const drive = `TEXT NOT NULL ${ref('drives')}`;
const sameCampus = (column: string, table: string, key = 'record_id') =>
  `FOREIGN KEY (${column},campus_id) REFERENCES ${table}(${key},campus_id) DEFERRABLE INITIALLY DEFERRED`;
const roundLink =
  'FOREIGN KEY (drive_id,round_id) REFERENCES recruitment_rounds(drive_id,round_id) DEFERRABLE INITIALLY DEFERRED';
const applicationLink =
  'FOREIGN KEY (application_id,student_id,drive_id) REFERENCES applications(record_id,student_id,drive_id) DEFERRABLE INITIALLY DEFERRED';
const owned = (table: string): TableSpec => ({ table, columns: {} });

export const tables: Record<string, TableSpec> = {
  campus: { table: 'campuses', columns: { name: 'TEXT NOT NULL', location: 'TEXT NOT NULL' } },
  account: {
    table: 'accounts',
    primaryKey: 'id',
    columns: {
      id: 'TEXT NOT NULL PRIMARY KEY',
      email: 'TEXT NOT NULL UNIQUE CHECK (email = lower(email))',
      role: "TEXT NOT NULL CHECK (role IN ('student','recruiter','campus'))",
      name: 'TEXT NOT NULL',
      password_hash: 'TEXT NOT NULL',
      approved: 'INTEGER NOT NULL CHECK (approved IN (0,1))',
      verified: 'INTEGER NOT NULL CHECK (verified IN (0,1))',
      created_at: 'TEXT NOT NULL',
    },
    constraints: ['UNIQUE(id,campus_id)'],
    indexes: [['role', 'campus_id']],
  },
  organization: { table: 'organizations', columns: { recruiter_id: `${requiredAccount} UNIQUE` } },
  'campus-recruiter': {
    table: 'campus_recruiters',
    columns: {
      recruiter_id: requiredAccount,
      status: "TEXT NOT NULL CHECK (status IN ('Pending','Accepted','Rejected'))",
    },
    constraints: ['CHECK(campus_id IS NOT NULL)', 'UNIQUE(campus_id,recruiter_id)'],
  },
  drive: {
    table: 'drives',
    columns: {
      recruiter_id: requiredAccount,
      opportunity_id: 'TEXT NOT NULL UNIQUE',
      company: 'TEXT NOT NULL',
      role: 'TEXT NOT NULL',
      status:
        "TEXT NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','SCHEDULING','AWAITING_RECRUITER_CONFIRMATION','CONFIRMED','ACTIVE','APPLICATIONS_CLOSED','IN_PROGRESS','COMPLETED','REJECTED','CANCELLED'))",
      vacancies: 'INTEGER NOT NULL CHECK(vacancies >= 0)',
      minimum_cgpa: 'REAL NOT NULL CHECK(minimum_cgpa BETWEEN 0 AND 10)',
    },
    constraints: ['UNIQUE(record_id,campus_id)'],
    indexes: [
      ['recruiter_id', 'status'],
      ['campus_id', 'status'],
    ],
  },
  'recruitment-round': {
    table: 'recruitment_rounds',
    columns: {
      drive_id: drive,
      round_id: 'TEXT NOT NULL',
      sort_order: 'INTEGER NOT NULL CHECK(sort_order >= 0)',
      name: 'TEXT NOT NULL',
      duration: 'INTEGER NOT NULL CHECK(duration > 0)',
    },
    constraints: ['UNIQUE(drive_id,round_id)', sameCampus('drive_id', 'drives')],
  },
  'drive-schedule': {
    table: 'drive_schedules',
    columns: {
      drive_id: `${drive} UNIQUE`,
      scheduled_date: 'TEXT NOT NULL',
      venue: 'TEXT NOT NULL',
    },
    constraints: [sameCampus('drive_id', 'drives')],
    indexes: [['scheduled_date', 'campus_id']],
  },
  workspace: {
    table: 'workspace_settings',
    columns: { account_id: `${requiredAccount} UNIQUE` },
    constraints: [sameCampus('account_id', 'accounts', 'id')],
  },
  application: {
    table: 'applications',
    columns: {
      student_id: requiredAccount,
      drive_id: drive,
      opportunity_id: 'TEXT NOT NULL',
      current_round_id: 'TEXT',
      resume_id: 'TEXT',
      stage: 'TEXT NOT NULL',
      applied_at: 'TEXT NOT NULL',
      sort_order: 'INTEGER NOT NULL DEFAULT 0',
    },
    constraints: [
      'CHECK(campus_id IS NOT NULL)',
      'UNIQUE(student_id,drive_id)',
      'UNIQUE(record_id,student_id,drive_id)',
      sameCampus('student_id', 'accounts', 'id'),
      sameCampus('drive_id', 'drives'),
      'FOREIGN KEY (drive_id,current_round_id) REFERENCES recruitment_rounds(drive_id,round_id) DEFERRABLE INITIALLY DEFERRED',
      'FOREIGN KEY (student_id,resume_id) REFERENCES documents(student_id,item_id) DEFERRABLE INITIALLY DEFERRED',
    ],
    indexes: [
      ['drive_id', 'stage'],
      ['student_id', 'sort_order'],
    ],
  },
  interest: {
    table: 'drive_interests',
    columns: {
      drive_id: drive,
      student_id: requiredAccount,
      interest: "TEXT NOT NULL CHECK(interest IN ('Interested','Not Interested'))",
    },
    constraints: [
      'CHECK(campus_id IS NOT NULL)',
      'UNIQUE(drive_id,student_id)',
      sameCampus('drive_id', 'drives'),
      sameCampus('student_id', 'accounts', 'id'),
    ],
  },
  'candidate-round': {
    table: 'candidate_results',
    columns: {
      drive_id: drive,
      round_id: 'TEXT NOT NULL',
      application_id: 'TEXT NOT NULL',
      student_id: requiredAccount,
      status:
        "TEXT NOT NULL CHECK(status IN ('Pending','Qualified','Rejected','Absent','Under Review'))",
      score: 'REAL CHECK(score >= 0)',
      published: 'INTEGER NOT NULL CHECK(published IN (0,1))',
    },
    constraints: [
      'UNIQUE(application_id,round_id)',
      roundLink,
      applicationLink,
      sameCampus('drive_id', 'drives'),
    ],
    indexes: [
      ['drive_id', 'round_id'],
      ['student_id', 'published'],
    ],
  },
  assignment: {
    table: 'assignments',
    columns: {
      drive_id: drive,
      round_id: 'TEXT NOT NULL',
      title: 'TEXT NOT NULL',
      maximum_marks: 'REAL NOT NULL CHECK(maximum_marks > 0)',
      deadline: 'TEXT NOT NULL',
    },
    constraints: [roundLink, sameCampus('drive_id', 'drives'), 'UNIQUE(record_id,drive_id)'],
  },
  'assignment-submission': {
    table: 'assignment_submissions',
    columns: {
      assignment_id: `TEXT NOT NULL ${ref('assignments')}`,
      drive_id: drive,
      application_id: 'TEXT NOT NULL',
      student_id: requiredAccount,
      document_id: 'TEXT',
      submitted_at: 'TEXT NOT NULL',
    },
    constraints: [
      'UNIQUE(assignment_id,student_id)',
      applicationLink,
      sameCampus('drive_id', 'drives'),
      'FOREIGN KEY(assignment_id,drive_id) REFERENCES assignments(record_id,drive_id) DEFERRABLE INITIALLY DEFERRED',
      'FOREIGN KEY(student_id,document_id) REFERENCES documents(student_id,item_id) DEFERRABLE INITIALLY DEFERRED',
    ],
  },
  'interview-slot': {
    table: 'interview_slots',
    columns: {
      drive_id: drive,
      round_id: 'TEXT NOT NULL',
      student_id: account,
      recruiter_id: requiredAccount,
      audience: "TEXT NOT NULL CHECK(audience IN ('student','round'))",
      scheduled_date: 'TEXT NOT NULL',
      scheduled_time: 'TEXT NOT NULL',
      duration: 'INTEGER NOT NULL CHECK(duration BETWEEN 5 AND 480)',
      venue: 'TEXT NOT NULL',
      room: 'TEXT NOT NULL',
      panel: 'TEXT NOT NULL',
    },
    constraints: [
      roundLink,
      sameCampus('drive_id', 'drives'),
      sameCampus('student_id', 'accounts', 'id'),
      "CHECK((audience = 'round' AND student_id IS NULL) OR (audience = 'student' AND student_id IS NOT NULL))",
    ],
    indexes: [
      ['scheduled_date', 'campus_id'],
      ['student_id', 'scheduled_date'],
      ['recruiter_id', 'scheduled_date'],
    ],
  },
  'admin-question': {
    table: 'questions',
    columns: {
      prompt: 'TEXT NOT NULL',
      topic: 'TEXT NOT NULL',
      answer: 'INTEGER NOT NULL CHECK(answer >= 0)',
    },
  },
  'admin-assessment': {
    table: 'assessments',
    columns: {
      name: 'TEXT NOT NULL',
      duration: 'INTEGER NOT NULL CHECK(duration > 0)',
      status: "TEXT NOT NULL CHECK(status IN ('draft','published','archived'))",
    },
  },
  'admin-contest': {
    table: 'contests',
    columns: {
      name: 'TEXT NOT NULL',
      duration: 'INTEGER NOT NULL CHECK(duration > 0)',
      status: "TEXT NOT NULL CHECK(status IN ('draft','published','archived'))",
    },
  },
  'campus-assessment': {
    table: 'campus_assessments',
    columns: {
      title: 'TEXT NOT NULL',
      duration: 'INTEGER NOT NULL CHECK(duration > 0)',
      maximum_marks: 'REAL NOT NULL CHECK(maximum_marks > 0)',
      passing_marks: 'REAL NOT NULL CHECK(passing_marks BETWEEN 0 AND maximum_marks)',
      starts_at: 'TEXT NOT NULL',
      ends_at: 'TEXT NOT NULL CHECK(ends_at > starts_at)',
    },
    constraints: ['CHECK(campus_id IS NOT NULL)', 'UNIQUE(record_id,campus_id)'],
  },
  'campus-assessment-session': {
    table: 'campus_assessment_sessions',
    columns: {
      assessment_id: `TEXT NOT NULL ${ref('campus_assessments')}`,
      student_id: requiredAccount,
      started_at: 'BIGINT NOT NULL',
    },
    constraints: [
      'UNIQUE(assessment_id,student_id)',
      sameCampus('assessment_id', 'campus_assessments'),
      sameCampus('student_id', 'accounts', 'id'),
    ],
  },
  'campus-assessment-attempt': {
    table: 'campus_assessment_attempts',
    columns: {
      assessment_id: `TEXT NOT NULL ${ref('campus_assessments')}`,
      student_id: requiredAccount,
      score: 'REAL NOT NULL CHECK(score >= 0)',
      submitted_at: 'TEXT NOT NULL',
    },
    constraints: [
      'UNIQUE(assessment_id,student_id)',
      sameCampus('assessment_id', 'campus_assessments'),
      sameCampus('student_id', 'accounts', 'id'),
    ],
  },
  'assessment-session': {
    table: 'assessment_sessions',
    columns: {
      student_id: requiredAccount,
      assessment_id: 'TEXT NOT NULL',
      started_at: 'BIGINT NOT NULL',
      submitted: 'INTEGER NOT NULL CHECK(submitted IN (0,1))',
    },
    constraints: [
      'FOREIGN KEY(student_id,assessment_id) REFERENCES student_activities(student_id,activity_id) DEFERRABLE INITIALLY DEFERRED',
    ],
    indexes: [['student_id', 'assessment_id']],
  },
  session: {
    table: 'sessions',
    columns: {
      user_id: `TEXT NOT NULL ${ref('accounts', 'id', 'CASCADE')}`,
      expires_at: 'BIGINT NOT NULL',
    },
    indexes: [['user_id'], ['expires_at']],
  },
  token: {
    table: 'password_reset_tokens',
    columns: {
      user_id: `TEXT NOT NULL ${ref('accounts', 'id', 'CASCADE')}`,
      expires_at: 'BIGINT NOT NULL',
    },
    indexes: [['user_id'], ['expires_at']],
  },
  notification: {
    table: 'notifications',
    columns: {
      user_id: requiredAccount,
      title: 'TEXT NOT NULL',
      is_read: 'INTEGER NOT NULL CHECK(is_read IN (0,1))',
    },
    indexes: [['user_id', 'is_read']],
  },
  template: {
    table: 'interview_templates',
    columns: { recruiter_id: requiredAccount, name: 'TEXT NOT NULL' },
  },
  audit: {
    table: 'audit_logs',
    columns: {
      actor_id: `TEXT ${ref('accounts', 'id', 'SET NULL')}`,
      action: 'TEXT NOT NULL',
      occurred_at: 'TEXT',
    },
    indexes: [['campus_id', 'occurred_at']],
  },
  mail: {
    table: 'mail_jobs',
    columns: {
      recipient: 'TEXT NOT NULL',
      status: "TEXT NOT NULL CHECK(status IN ('pending','sent','failed'))",
      attempts: 'INTEGER NOT NULL CHECK(attempts >= 0)',
      next_at: 'BIGINT NOT NULL',
    },
    indexes: [['status', 'next_at']],
  },
  'storage-gc': { table: 'storage_cleanup_jobs', columns: { storage_key: 'TEXT NOT NULL' } },
  photo: owned('account_photos'),
  practice: owned('interview_practice'),
  feedback: owned('interview_feedback'),
  'communication-practice': owned('communication_practice'),
  oauth: owned('oauth_flows'),
};

const child = (
  table: string,
  columns: Record<string, string>,
  constraints: string[] = [],
): TableSpec => ({
  table,
  columns: {
    student_id: requiredAccount,
    item_id: 'TEXT NOT NULL',
    sort_order: 'INTEGER NOT NULL CHECK(sort_order >= 0)',
    ...columns,
  },
  constraints: [
    'UNIQUE(student_id,item_id)',
    sameCampus('student_id', 'accounts', 'id'),
    ...constraints,
  ],
  indexes: [['student_id', 'sort_order']],
});
export const workspaceTables = {
  student: {
    table: 'student_profiles',
    columns: {
      account_id: `${requiredAccount} UNIQUE`,
      cgpa: 'REAL NOT NULL CHECK(cgpa BETWEEN 0 AND 10)',
      active_backlogs: 'INTEGER NOT NULL CHECK(active_backlogs >= 0)',
      course: 'TEXT NOT NULL',
      branch: 'TEXT NOT NULL',
      graduation_year: 'TEXT NOT NULL',
    },
    constraints: [sameCampus('account_id', 'accounts', 'id')],
  } satisfies TableSpec,
  skills: child(
    'student_skills',
    {
      name: 'TEXT NOT NULL',
      normalized_name: 'TEXT NOT NULL',
      level: 'TEXT NOT NULL',
      verified: 'INTEGER NOT NULL CHECK(verified IN (0,1))',
    },
    ['UNIQUE(student_id,normalized_name)'],
  ),
  projects: child('student_projects', { title: 'TEXT NOT NULL' }),
  documents: child('documents', {
    name: 'TEXT NOT NULL',
    document_type: 'TEXT NOT NULL',
    status: 'TEXT NOT NULL',
    storage_key: 'TEXT',
  }),
  offers: child(
    'offers',
    {
      application_id: `TEXT ${ref('applications')}`,
      company: 'TEXT NOT NULL',
      role: 'TEXT NOT NULL',
      status: 'TEXT NOT NULL',
      recruiter_id: account,
    },
    [
      'FOREIGN KEY(application_id,student_id) REFERENCES applications(record_id,student_id) DEFERRABLE INITIALLY DEFERRED',
    ],
  ),
  interviews: child('student_interviews', {
    company: 'TEXT NOT NULL',
    status: 'TEXT NOT NULL',
    scheduled_date: 'TEXT NOT NULL',
    recruiter_id: account,
  }),
  history: child(
    'assessment_attempts',
    {
      assessment_id: 'TEXT NOT NULL',
      score: 'REAL NOT NULL CHECK(score BETWEEN 0 AND 100)',
      points: 'INTEGER NOT NULL CHECK(points >= 0)',
      submitted_at: 'TEXT NOT NULL',
    },
    [
      'FOREIGN KEY(student_id,assessment_id) REFERENCES student_activities(student_id,activity_id) DEFERRABLE INITIALLY DEFERRED',
    ],
  ),
};
// Additional candidate key used by offers that may predate a drive-aware application.
tables.application.constraints!.push('UNIQUE(record_id,student_id)');
export const campusRequiredKinds = [
  'drive',
  'recruitment-round',
  'drive-schedule',
  'candidate-round',
  'assignment',
  'assignment-submission',
  'interview-slot',
  'campus-assessment-session',
  'campus-assessment-attempt',
] as const;
for (const kind of campusRequiredKinds) {
  (tables[kind].constraints ||= []).push('CHECK(campus_id IS NOT NULL)');
}

export const migrationId = '002-relational-entities';
export const legacyGuardId = '003-legacy-write-guard';
export const alignmentId = '004-stable-account-key-and-campus-checks';
export function legacyWriteGuard(postgres: boolean): string[] {
  const message =
    'Legacy records are read-only. Restart the backend with the relational storage version.';
  if (postgres)
    return [
      `CREATE OR REPLACE FUNCTION campuslink_reject_legacy_writes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '${message}'; END; $$`,
      'CREATE TRIGGER records_legacy_read_only BEFORE INSERT OR UPDATE OR DELETE ON records FOR EACH STATEMENT EXECUTE FUNCTION campuslink_reject_legacy_writes()',
    ];
  return ['INSERT', 'UPDATE', 'DELETE'].map(
    (operation) =>
      `CREATE TRIGGER records_legacy_read_only_${operation.toLowerCase()} BEFORE ${operation} ON records BEGIN SELECT RAISE(ABORT, '${message}'); END`,
  );
}
export const allTables: TableSpec[] = [...Object.values(tables), ...Object.values(workspaceTables)];
export function relationalSchema(postgres: boolean): string {
  const validJson = postgres ? 'value::jsonb IS NOT NULL' : 'json_valid(value)';
  // PostgreSQL needs referenced tables to exist first. SQLite permits forward references.
  const foreignKeys: string[] = [];
  const deferReferences = (table: string, definitions: string[]) =>
    definitions.flatMap((definition) => {
      if (!postgres) return [definition];
      if (definition.startsWith('FOREIGN KEY')) {
        foreignKeys.push(
          `ALTER TABLE ${table} ADD CONSTRAINT ${table}_fk_${foreignKeys.length} ${definition}`,
        );
        return [];
      }
      const inline = definition.match(/ REFERENCES [\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
      if (!inline) return [definition];
      const column = definition.split(' ')[0];
      foreignKeys.push(
        `ALTER TABLE ${table} ADD CONSTRAINT ${table}_fk_${foreignKeys.length} FOREIGN KEY(${column})${inline[0]}`,
      );
      return [definition.replace(inline[0], '')];
    });
  const statements = allTables.flatMap((spec) => {
    const columns = deferReferences(spec.table, [
      spec.primaryKey ? 'record_id TEXT NOT NULL UNIQUE' : 'record_id TEXT PRIMARY KEY',
      `value TEXT NOT NULL CHECK(${validJson})`,
      `campus_id TEXT ${ref('campuses')}`,
      `owner_id TEXT ${ref('accounts', 'id', 'SET NULL')}`,
      ...Object.entries(spec.columns).map(([name, ddl]) => `${name} ${ddl}`),
      ...(spec.constraints || []),
    ]);
    return [
      `CREATE TABLE IF NOT EXISTS ${spec.table} (${columns.join(',\n')})`,
      `CREATE INDEX IF NOT EXISTS ${spec.table}_scope ON ${spec.table}(campus_id,owner_id)`,
      ...(spec.indexes || []).map(
        (keys, i) =>
          `CREATE INDEX IF NOT EXISTS ${spec.table}_lookup_${i} ON ${spec.table}(${keys.join(',')})`,
      ),
    ];
  });
  const linkTable = (name: string, columns: string[]) =>
    `CREATE TABLE IF NOT EXISTS ${name} (${deferReferences(name, columns).join(',')})`;
  statements.push(
    linkTable('student_activities', [
      `student_id TEXT NOT NULL ${ref('accounts', 'id')}`,
      'activity_id TEXT NOT NULL',
      'name TEXT NOT NULL',
      'activity_type TEXT NOT NULL',
      `value TEXT NOT NULL CHECK(${validJson})`,
      'PRIMARY KEY(student_id,activity_id)',
    ]),
    linkTable('assessment_questions', [
      `assessment_id TEXT NOT NULL ${ref('assessments')}`,
      `question_id TEXT NOT NULL ${ref('questions')}`,
      'sort_order INTEGER NOT NULL CHECK(sort_order >= 0)',
      'PRIMARY KEY(assessment_id,question_id)',
      'UNIQUE(assessment_id,sort_order)',
    ]),
    linkTable('template_campuses', [
      `template_id TEXT NOT NULL ${ref('interview_templates')}`,
      `campus_id TEXT NOT NULL ${ref('campuses')}`,
      'PRIMARY KEY(template_id,campus_id)',
    ]),
  );
  statements.push(...foreignKeys);
  if (postgres) {
    for (const table of [
      ...allTables.map((t) => t.table),
      'student_activities',
      'assessment_questions',
      'template_campuses',
    ])
      statements.push(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  }
  return statements.join(';\n') + ';';
}
