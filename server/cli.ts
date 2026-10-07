import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Database } from './db';
import { Authentication, Account } from './auth';
import { config } from './config';
import { train, OutcomeRow } from './ml';
import { MailJob } from './mail';
async function main() {
  const [command, arg] = process.argv.slice(2);
  const db = new Database();
  await db.migrate();
  const auth = new Authentication(db);
  try {
    if (command === 'migrate') console.log('Database schema is ready.');
    else if (command === 'grant-admin' || command === 'revoke-admin') {
      const account = arg ? await auth.find(arg) : undefined;
      if (!account) throw new Error('Provide an existing account email.');
      const grant = command === 'grant-admin';
      if (grant && account.onboardingComplete === false)
        throw new Error('Complete this account’s dashboard profile before granting admin access.');
      account.isAdmin = grant;
      if (grant) account.approved = true;
      await auth.save(account);
      await db.put('audit', randomUUID(), {
        event: grant ? 'operator-admin-granted' : 'operator-admin-revoked',
        targetId: account.id,
        time: new Date().toISOString(),
      });
      console.log(
        grant
          ? 'Administrator access granted. Verify the account email, then open /admin/dashboard.'
          : 'Administrator access revoked.',
      );
    } else if (command === 'approve-user') {
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
    } else if (command === 'train-model') {
      if (!arg)
        throw new Error('Provide a JSON file with consented, anonymized historical outcome rows.');
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
      const rows: OutcomeRow[] = z
        .array(row)
        .min(60)
        .parse(JSON.parse(fs.readFileSync(arg, 'utf8')));
      const provenance = 'historical';
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
        'Commands: migrate | approve-user EMAIL | grant-admin EMAIL | revoke-admin EMAIL | outbox | train-model FILE.json',
      );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
