import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Database } from './db';
import { Authentication, Account, hashPassword } from './auth';
import { config } from './config';
import { emptyWorkspace, StoredDrive } from './workspace';
import { defaultDrive } from '../src/mocks/placement';
import { initialData } from '../src/mocks/data';
import { train, OutcomeRow, features } from './ml';
import { MailJob } from './mail';
async function main() {
  const [command, arg] = process.argv.slice(2);
  const db = new Database();
  await db.migrate();
  const auth = new Authentication(db);
  try {
    if (command === 'rotate-demo-passwords') {
      if (config.production || config.database)
        throw new Error('Demo rotation is restricted to local SQLite.');
      const accounts = (await db.list<Account>('account')).filter((a) =>
        a.email.endsWith('@campuslink.demo'),
      );
      const password = randomBytes(18).toString('base64url');
      await db.transaction(async () => {
        for (const a of accounts) {
          a.passwordHash = hashPassword(password);
          await auth.save(a);
          for (const row of await db.query<{ id: string }>(
            "SELECT id FROM records WHERE kind='session' AND owner_id=$1",
            [a.id],
          ))
            await db.remove('session', row.id);
        }
      });
      fs.mkdirSync('server/data', { recursive: true });
      fs.writeFileSync(
        'server/data/demo-access.txt',
        accounts.map((a) => `${a.role}: ${a.email}\nPassword: ${password}\n`).join('\n'),
        { mode: 0o600 },
      );
      console.log('Demo passwords rotated and existing demo sessions revoked.');
    } else if (command === 'migrate') console.log('Database schema is ready.');
    else if (command === 'approve-user') {
      const account = arg ? await auth.find(arg) : undefined;
      if (!account) throw new Error('Provide an existing account email.');
      account.approved = true;
      await auth.save(account);
      await db.put(
        'audit',
        randomUUID(),
        { event: 'operator-approval', targetId: account.id, time: new Date().toISOString() },
        account.campusId,
      );
      console.log('Account approved. Email verification remains required in production.');
    } else if (command === 'outbox') {
      const output = 'server/data/outbox.json';
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(await db.list<MailJob>('mail'), null, 2));
      console.log(
        `Local email preview saved to ${output}. It contains private verification/reset links; do not share it.`,
      );
    } else if (command === 'seed-local') {
      if (config.production || config.database)
        throw new Error('Demo seeding is restricted to local SQLite development.');
      const campusId = 'demo-campus';
      await db.put(
        'campus',
        campusId,
        {
          id: campusId,
          name: 'Demo Institute of Technology',
          location: 'Bhubaneswar',
          studentPool: 6,
          courses: ['B.Tech'],
          branches: ['CSE', 'IT', 'ECE'],
        },
        campusId,
      );
      const password = randomBytes(18).toString('base64url'),
        credentials: string[] = [];
      const definitions = [
        ['student', 'Diptiprav Dash', 'student@campuslink.demo'],
        ['student', 'Sonalika Nayak', 'sonalika@campuslink.demo'],
        ['student', 'Sachin Dash', 'sachin@campuslink.demo'],
        ['student', 'Rishikanta Sahoo', 'rishikanta@campuslink.demo'],
        ['student', 'Ayushman Nayak', 'ayushman@campuslink.demo'],
        ['student', 'Biswojit Sahoo', 'biswojit@campuslink.demo'],
        ['recruiter', 'Sonalika Nayak', 'recruiter@campuslink.demo'],
        ['campus', 'Campus Placement Team', 'campus@campuslink.demo'],
      ] as const;
      let recruiter: Account | undefined;
      await db.transaction(async () => {
        for (let i = 0; i < definitions.length; i++) {
          const [role, name, email] = definitions[i];
          let account = await auth.find(email);
          if (!account) {
            account = await auth.create(
              {
                name,
                email,
                role,
                password,
                campusId,
                organization:
                  role === 'recruiter' ? 'CampusLink Demo Labs' : 'Demo Institute of Technology',
              },
              true,
            );
            account.verified = true;
            await auth.save(account);
            credentials.push(`${role}: ${email}\nPassword: ${password}\n`);
          }
          if (role === 'recruiter') recruiter = account;
          if (role === 'student' && !(await db.get('workspace', account.id))) {
            const data = emptyWorkspace(account, 'Demo Institute of Technology');
            data.student = {
              ...structuredClone(initialData.student),
              id: account.id,
              name,
              email,
              campus: 'Demo Institute of Technology',
              cgpa: 7.5 + i * 0.3,
              photo: undefined,
            };
            data.history = structuredClone(initialData.history);
            data.student.xp = data.history.reduce((s, h) => s + h.points, 0);
            await db.put('workspace', account.id, data, campusId, account.id);
          }
        }
        const date = (days: number) =>
          new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        for (let i = 0; i < 3; i++) {
          const id = `demo-drive-${i + 1}`;
          if (await db.get('drive', id)) continue;
          const drive: StoredDrive = {
            ...defaultDrive({
              id,
              campusId,
              campus: 'Demo Institute of Technology',
              company: 'CampusLink Demo Labs',
              role: ['Frontend Engineer', 'Backend Engineer', 'Data Analyst'][i],
              skills: ['React, JavaScript', 'Node.js, SQL', 'Python, SQL'][i],
              status: 'ACTIVE',
              deadline: date(20 + i),
              preferredDates: [date(30 + i)],
              graduationYear: '2027',
              cgpa: 7,
              courses: 'B.Tech',
              branches: 'CSE, IT',
              allowedBacklogs: 0,
            }),
            recruiterId: recruiter!.id,
          };
          drive.schedule = {
            date: date(30 + i),
            reporting: '08:30',
            talk: '09:00',
            assessment: '10:00',
            interviews: '12:00',
            end: '17:00',
            venue: `Hall ${i + 1}`,
            lab: `Lab ${i + 1}`,
            rooms: `Room ${i + 1}`,
            systems: 100,
          };
          drive.audit = [
            {
              status: 'CONFIRMED',
              note: 'Schedule finalized by campus.',
              date: new Date().toISOString(),
            },
            {
              status: 'ACTIVE',
              note: 'Synthetic demonstration fixture.',
              date: new Date().toISOString(),
            },
          ];
          await db.put('drive', id, drive, campusId, recruiter!.id);
        }
      });
      if (credentials.length) {
        fs.mkdirSync('server/data', { recursive: true });
        fs.writeFileSync('server/data/demo-access.txt', credentials.join('\n'), { mode: 0o600 });
      }
      console.log(
        'Local synthetic dataset ready: six students and three campus drives. New demo credentials are in server/data/demo-access.txt.',
      );
    } else if (command === 'train-demo' || command === 'train-model') {
      let rows: OutcomeRow[], provenance: 'synthetic' | 'historical';
      if (command === 'train-demo') {
        let state = 12345;
        const rand = () => {
          state = (state * 16807) % 2147483647;
          return state / 2147483647;
        };
        rows = [];
        for (let i = 0; i < 900; i++) {
          const values = features.map(() => Math.round(rand() * 100)),
            latent =
              -4 + values.reduce((s, v, j) => s + (v / 100) * [1.8, 0.9, 1.2, 1, 1.2, 1.6][j], 0);
          rows.push({
            cohort: String(2023 + Math.floor(i / 300)),
            ...Object.fromEntries(features.map((f, j) => [f, values[j]])),
            placed: rand() < 1 / (1 + Math.exp(-latent)) ? 1 : 0,
          } as OutcomeRow);
        }
        provenance = 'synthetic';
      } else {
        if (!arg)
          throw new Error(
            'Provide a JSON file with consented, anonymized historical outcome rows.',
          );
        const row = z
          .object({
            cohort: z.string().min(1),
            verifiedSkills: z.number().min(0).max(100),
            academics: z.number().min(0).max(100),
            projects: z.number().min(0).max(100),
            aptitude: z.number().min(0).max(100),
            communication: z.number().min(0).max(100),
            interview: z.number().min(0).max(100),
            placed: z.union([z.literal(0), z.literal(1)]),
          })
          .strict();
        rows = z
          .array(row)
          .min(60)
          .parse(JSON.parse(fs.readFileSync(arg, 'utf8')));
        provenance = 'historical';
      }
      const model = train(rows, provenance);
      fs.mkdirSync(path.dirname(config.modelPath), { recursive: true });
      fs.writeFileSync(config.modelPath, JSON.stringify(model, null, 2));
      console.log(
        JSON.stringify(
          {
            model: config.modelPath,
            provenance,
            metrics: model.metrics,
            heldOutCohorts: model.testCohorts,
          },
          null,
          2,
        ),
      );
    } else
      throw new Error(
        'Commands: migrate | seed-local | approve-user EMAIL | outbox | train-demo | train-model FILE.json',
      );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
