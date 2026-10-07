import { DatabaseSync } from 'node:sqlite';
import { Pool, PoolClient } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './config';

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
  private queue: Promise<unknown> = Promise.resolve();
  constructor(url = config.database, sqlitePath = config.localDatabase) {
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
      this.pool = new Pool({ connectionString, ssl, max: 10, connectionTimeoutMillis: 15000 });
      // Idle connections can be closed by the hosted database or network. pg removes
      // that client; handling the event keeps the API alive for the next connection.
      this.pool.on('error', () => {
        console.error('Database connection interrupted. The next request will reconnect.');
      });
    } else {
      if (sqlitePath !== ':memory:') fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
      this.sqlite = new DatabaseSync(sqlitePath);
      this.sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    }
  }
  async migrate() {
    if (this.pool)
      await this.pool.query(
        migration +
          '\nALTER TABLE records ENABLE ROW LEVEL SECURITY; ALTER TABLE locks ENABLE ROW LEVEL SECURITY; ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;',
      );
    else this.sqlite!.exec(migration);
  }
  async query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    if (this.pool) {
      const client = this.context.getStore();
      return (await (client && client !== true ? client : this.pool).query(sql, values)).rows;
    }
    const statement = this.sqlite!.prepare(sql.replace(/\$\d+/g, '?'));
    const args = values as (string | number | null)[];
    return (
      /^\s*(SELECT|WITH)/i.test(sql) ? statement.all(...args) : (statement.run(...args), [])
    ) as T[];
  }
  async get<T>(kind: string, id: string): Promise<T | undefined> {
    const rows = await this.query<RecordRow>('SELECT * FROM records WHERE kind=$1 AND id=$2', [
      kind,
      id,
    ]);
    return rows[0] ? JSON.parse(rows[0].value) : undefined;
  }
  async list<T>(kind: string, campus?: string, owner?: string): Promise<T[]> {
    const args: unknown[] = [kind];
    let sql = 'SELECT * FROM records WHERE kind=$1';
    if (campus !== undefined) {
      args.push(campus);
      sql += ` AND campus_id=$${args.length}`;
    }
    if (owner !== undefined) {
      args.push(owner);
      sql += ` AND owner_id=$${args.length}`;
    }
    return (await this.query<RecordRow>(sql, args)).map((row) => JSON.parse(row.value));
  }
  async put(kind: string, id: string, value: unknown, campus = '', owner = '') {
    await this.query(
      `INSERT INTO records(kind,id,value,campus_id,owner_id) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value,campus_id=excluded.campus_id,owner_id=excluded.owner_id`,
      [kind, id, JSON.stringify(value), campus, owner],
    );
  }
  async remove(kind: string, id: string) {
    await this.query('DELETE FROM records WHERE kind=$1 AND id=$2', [kind, id]);
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return fn();
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        // Serializes schedule reservations and read/modify/write workflows across API instances.
        await client.query("SELECT id FROM locks WHERE id='placement' FOR UPDATE");
        const result = await this.context.run(client, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    const run = this.queue.then(async () => {
      this.sqlite!.exec('BEGIN IMMEDIATE');
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
