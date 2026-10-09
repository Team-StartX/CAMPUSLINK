import { DatabaseSync } from 'node:sqlite';
import { Pool, PoolClient } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './config';
import {
  alignmentId,
  campusRequiredKinds,
  legacyGuardId,
  legacyWriteGuard,
  migrationId,
  relationalSchema,
  tables,
} from './schema';
import { RelationalStore } from './relational-store';

export interface RecordRow {
  id: string;
  kind: string;
  campus_id: string;
  owner_id: string;
  value: string;
}
const migration = `
CREATE TABLE IF NOT EXISTS records (
 id TEXT NOT NULL, kind TEXT NOT NULL, campus_id TEXT NOT NULL DEFAULT '',
 owner_id TEXT NOT NULL DEFAULT '', value TEXT NOT NULL,
 PRIMARY KEY(kind,id)
);
CREATE INDEX IF NOT EXISTS records_scope ON records(kind,campus_id,owner_id);
CREATE TABLE IF NOT EXISTS locks (id TEXT PRIMARY KEY);
INSERT INTO locks(id) VALUES ('placement') ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY);
INSERT INTO migrations(id) VALUES ('001-scoped-records') ON CONFLICT(id) DO NOTHING;
`;
export class Database {
  private sqlite?: DatabaseSync;
  private pool?: Pool;
  private context = new AsyncLocalStorage<PoolClient | true>();
  private clientQueues = new WeakMap<PoolClient, Promise<void>>();
  private queue: Promise<unknown> = Promise.resolve();
  private store = new RelationalStore(this);
  private sqlitePath: string;
  constructor(url = config.database, sqlitePath = config.localDatabase) {
    this.sqlitePath = sqlitePath;
    if (url) {
      let connectionString = url;
      let ssl: { ca: string; rejectUnauthorized: true } | undefined;
      if (config.databaseCaPath) {
        const parsed = new URL(url);
        for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey'])
          parsed.searchParams.delete(key);
        connectionString = parsed.toString();
        ssl = {
          ca: fs.readFileSync(path.resolve(config.databaseCaPath), 'utf8'),
          rejectUnauthorized: true,
        };
      }
      this.pool = new Pool({
        connectionString,
        ssl,
        max: 4,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 8000,
      });
      // Idle connections can be closed by the hosted database or network. pg removes
      // that client; handling the event keeps the API alive for the next connection.
      this.pool.on('error', () => {
        console.error('Database connection interrupted. The next request will reconnect.');
      });
    } else {
      if (sqlitePath !== ':memory:') fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
      this.sqlite = new DatabaseSync(sqlitePath);
      this.sqlite.exec(
        'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;',
      );
    }
  }
  async migrate(progress?: (message: string) => void) {
    if (this.pool) {
      const statements =
        migration +
        '\nALTER TABLE records ENABLE ROW LEVEL SECURITY; ALTER TABLE locks ENABLE ROW LEVEL SECURITY; ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;';
      // Each idempotent statement commits separately, releasing its table locks.
      // Holding all migration locks can deadlock with a running placement transaction.
      for (const statement of statements
        .split(';')
        .map((sql) => sql.trim())
        .filter(Boolean))
        await this.pool.query(statement);
    } else this.sqlite!.exec(migration);
    if ((await this.query('SELECT id FROM migrations WHERE id=$1', [migrationId])).length) {
      await this.protectLegacyRecords(progress);
      await this.alignSchema(progress);
      return;
    }
    // Preserve a consistent SQLite snapshot, including committed WAL pages, before the first conversion.
    if (
      this.sqlite &&
      this.sqlitePath !== ':memory:' &&
      (await this.query('SELECT id FROM records LIMIT 1')).length
    ) {
      const folder = path.join(path.dirname(this.sqlitePath), 'backups');
      fs.mkdirSync(folder, { recursive: true });
      const backup = path.resolve(
        folder,
        `${path.basename(this.sqlitePath)}.pre-relational-${Date.now()}.sqlite`,
      );
      this.sqlite.prepare('VACUUM INTO ?').run(backup);
    }
    await this.transaction(async () => {
      // Another API instance may have completed the migration while we acquired the placement lock.
      if ((await this.query('SELECT id FROM migrations WHERE id=$1', [migrationId])).length) {
        await this.protectLegacyRecords(progress);
        await this.alignSchema(progress);
        return;
      }
      // Hold legacy writers until the copy and write guard commit together.
      if (this.pool) await this.query('LOCK TABLE records IN SHARE ROW EXCLUSIVE MODE');
      progress?.('Preparing relational tables and constraints.');
      const ddl = relationalSchema(!!this.pool);
      if (this.sqlite) this.sqlite.exec(ddl);
      else await this.query(ddl);
      const legacy = await this.query<RecordRow>('SELECT * FROM records ORDER BY kind,id');
      progress?.(`Migrating ${legacy.length} legacy records; the originals remain preserved.`);
      await this.store.migrateLegacy(legacy, progress);
      if (this.sqlite && this.sqlite.prepare('PRAGMA foreign_key_check').all().length)
        throw new Error(
          'Relational migration found invalid references; legacy records were preserved.',
        );
      await this.query('INSERT INTO migrations(id) VALUES($1)', [migrationId]);
      await this.protectLegacyRecords(progress);
      await this.alignSchema(progress);
      progress?.('Relational data copied and validated; committing migration.');
    });
  }
  private async alignSchema(progress?: (message: string) => void) {
    if ((await this.query('SELECT id FROM migrations WHERE id=$1', [alignmentId])).length) return;
    if (this.pool) {
      await this.transaction(async () => {
        if ((await this.query('SELECT id FROM migrations WHERE id=$1', [alignmentId])).length)
          return;
        // A first-time backfill can leave deferred FK trigger events on accounts.
        // Validate them before changing its primary key, then restore deferred mode.
        await this.query('SET CONSTRAINTS ALL IMMEDIATE');
        const keys = await this.query<{ name: string; type: string; columns: string }>(
          `SELECT t.constraint_name AS name,t.constraint_type AS type,string_agg(k.column_name,',' ORDER BY k.ordinal_position) AS columns
           FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k ON k.constraint_name=t.constraint_name AND k.constraint_schema=t.constraint_schema
           WHERE t.table_schema=current_schema() AND t.table_name='accounts' AND t.constraint_type IN ('PRIMARY KEY','UNIQUE') GROUP BY t.constraint_name,t.constraint_type`,
        );
        const primary = keys.find((key) => key.type === 'PRIMARY KEY');
        if (primary?.columns !== 'id') {
          if (!keys.some((key) => key.type === 'UNIQUE' && key.columns === 'record_id'))
            await this.query(
              'ALTER TABLE accounts ADD CONSTRAINT accounts_record_id_unique UNIQUE(record_id)',
            );
          if (primary)
            await this.query(
              `ALTER TABLE accounts DROP CONSTRAINT "${primary.name.replaceAll('"', '""')}"`,
            );
          await this.query('ALTER TABLE accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY(id)');
        }
        const checks = await this.query<{ table_name: string; definition: string }>(
          `SELECT r.relname AS table_name,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=current_schema() AND c.contype='c'`,
        );
        for (const kind of campusRequiredKinds) {
          const table = tables[kind].table;
          if (
            !checks.some(
              (check) =>
                check.table_name === table &&
                check.definition.replace(/\s/g, '').toLowerCase().includes('campus_idisnotnull'),
            )
          )
            await this.query(
              `ALTER TABLE ${table} ADD CONSTRAINT ${table}_campus_required CHECK(campus_id IS NOT NULL)`,
            );
        }
        await this.query('INSERT INTO migrations(id) VALUES($1)', [alignmentId]);
        await this.query('SET CONSTRAINTS ALL DEFERRED');
        progress?.('Stable account primary key and required campus constraints verified.');
      });
      return;
    }
    const repair = () => {
      if (this.sqlite!.prepare('SELECT id FROM migrations WHERE id=?').get(alignmentId)) return;
      const columns = this.sqlite!.prepare('PRAGMA table_info(accounts)').all() as {
        name: string;
        pk: number;
      }[];
      const rebuild =
        columns
          .filter((column) => column.pk)
          .map((column) => column.name)
          .join(',') !== 'id';
      if (rebuild && this.context.getStore())
        throw new Error(
          'An older SQLite account table must be repaired outside an existing transaction.',
        );
      const ownTransaction = !this.context.getStore();
      if (rebuild) this.sqlite!.exec('PRAGMA foreign_keys=OFF');
      if (ownTransaction) this.sqlite!.exec('BEGIN IMMEDIATE');
      try {
        if (rebuild) {
          const statements = relationalSchema(false)
            .split(';')
            .map((sql) => sql.trim());
          const create = statements.find((sql) =>
            sql.startsWith('CREATE TABLE IF NOT EXISTS accounts ('),
          )!;
          this.sqlite!.exec(
            create.replace(
              'CREATE TABLE IF NOT EXISTS accounts (',
              'CREATE TABLE accounts_replacement (',
            ),
          );
          const names = columns.map((column) => column.name).join(',');
          this.sqlite!.exec(
            `INSERT INTO accounts_replacement(${names}) SELECT ${names} FROM accounts`,
          );
          this.sqlite!.exec(
            'DROP TABLE accounts; ALTER TABLE accounts_replacement RENAME TO accounts;',
          );
          for (const index of statements.filter(
            (sql) => sql.startsWith('CREATE INDEX') && sql.includes(' ON accounts('),
          ))
            this.sqlite!.exec(index);
        }
        for (const kind of campusRequiredKinds) {
          const table = tables[kind].table;
          if (this.sqlite!.prepare(`SELECT 1 FROM ${table} WHERE campus_id IS NULL LIMIT 1`).get())
            throw new Error(`A campus is missing from ${table}; schema alignment was rolled back.`);
          const definition = this.sqlite!.prepare(
            "SELECT sql FROM sqlite_master WHERE name=? AND type='table'",
          ).get(table) as { sql: string };
          if (!definition.sql.replace(/\s/g, '').toLowerCase().includes('campus_idisnotnull')) {
            for (const operation of ['INSERT', 'UPDATE'])
              this.sqlite!.exec(
                `CREATE TRIGGER IF NOT EXISTS ${table}_campus_required_${operation.toLowerCase()} BEFORE ${operation} ON ${table} WHEN NEW.campus_id IS NULL BEGIN SELECT RAISE(ABORT, 'A campus is required.'); END;`,
              );
          }
        }
        if (this.sqlite!.prepare('PRAGMA foreign_key_check').all().length)
          throw new Error('Schema alignment found invalid foreign keys.');
        this.sqlite!.prepare('INSERT INTO migrations(id) VALUES(?)').run(alignmentId);
        if (ownTransaction) this.sqlite!.exec('COMMIT');
        progress?.('Stable account primary key and required campus constraints verified.');
      } catch (error) {
        if (ownTransaction) this.sqlite!.exec('ROLLBACK');
        throw error;
      } finally {
        if (rebuild) this.sqlite!.exec('PRAGMA foreign_keys=ON');
      }
    };
    if (this.context.getStore()) repair();
    else {
      const run = this.queue.then(repair);
      this.queue = run.catch(() => undefined);
      await run;
    }
  }
  private async protectLegacyRecords(progress?: (message: string) => void) {
    if ((await this.query('SELECT id FROM migrations WHERE id=$1', [legacyGuardId])).length) return;
    await this.transaction(async () => {
      if ((await this.query('SELECT id FROM migrations WHERE id=$1', [legacyGuardId])).length)
        return;
      if (this.pool) await this.query('LOCK TABLE records IN SHARE ROW EXCLUSIVE MODE');
      for (const statement of legacyWriteGuard(!!this.pool)) await this.query(statement);
      await this.query('INSERT INTO migrations(id) VALUES($1)', [legacyGuardId]);
      progress?.('Legacy snapshot protected from writes by older backend versions.');
    });
  }
  async query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    if (this.pool) {
      const client = this.context.getStore();
      if (!client || client === true) {
        const result = await this.pool.query(sql, values);
        return Array.isArray(result) ? result.at(-1)?.rows || [] : result.rows;
      }
      // pg requires one active query per client. Batch callers may schedule independent
      // reads together, but a transaction must execute them serially on its connection.
      const previous = this.clientQueues.get(client) || Promise.resolve();
      const run = previous.then(() => client.query(sql, values));
      this.clientQueues.set(
        client,
        run.then(
          () => undefined,
          () => undefined,
        ),
      );
      const result = await run;
      return Array.isArray(result) ? result.at(-1)?.rows || [] : result.rows;
    }
    const statement = this.sqlite!.prepare(sql.replace(/\$\d+/g, '?'));
    const args = values as (string | number | null)[];
    return (
      /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)/i.test(sql)
        ? statement.all(...args)
        : (statement.run(...args), [])
    ) as T[];
  }
  async get<T>(kind: string, id: string): Promise<T | undefined> {
    const read = () => this.store.get<T>(kind, id);
    return this.isAggregate(kind) ? this.runTransaction(read, true) : read();
  }
  async list<T>(kind: string, campus?: string, owner?: string): Promise<T[]> {
    const read = () => this.store.list<T>(kind, campus, owner);
    return this.isAggregate(kind) ? this.runTransaction(read, true) : read();
  }
  async put(kind: string, id: string, value: unknown, campus = '', owner = '') {
    await this.transaction(() => this.store.put(kind, id, value, campus, owner));
  }
  async remove(kind: string, id: string) {
    await this.transaction(() => this.store.remove(kind, id));
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.runTransaction(fn, false);
  }
  private isAggregate(kind: string) {
    return ['workspace', 'drive', 'admin-assessment', 'template'].includes(kind);
  }
  private async runTransaction<T>(fn: () => Promise<T>, readOnly: boolean): Promise<T> {
    if (this.context.getStore()) return fn();
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
        // Serializes schedule reservations and read/modify/write workflows across API instances.
        if (!readOnly) await client.query("SELECT id FROM locks WHERE id='placement' FOR UPDATE");
        const result = await this.context.run(client, fn);
        await this.clientQueues.get(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        // Promise.all can reject before its other queued reads finish.
        await this.clientQueues.get(client);
        await client.query('ROLLBACK');
        throw error;
      } finally {
        this.clientQueues.delete(client);
        client.release();
      }
    }
    const run = this.queue.then(async () => {
      this.sqlite!.exec(readOnly ? 'BEGIN' : 'BEGIN IMMEDIATE');
      try {
        const result = await this.context.run(true, fn);
        this.sqlite!.exec('COMMIT');
        return result;
      } catch (error) {
        this.sqlite!.exec('ROLLBACK');
        throw error;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
  async close() {
    this.sqlite?.close();
    await this.pool?.end();
  }
}
