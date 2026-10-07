import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventEmitter } from 'node:events';
import { Database } from './db';
import { config } from './config';

const state = vi.hoisted(() => ({ pool: null as EventEmitter | null }));
vi.mock('pg', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    Pool: class extends EventEmitter {
      constructor() {
        super();
        state.pool = this;
      }
      async query() {
        return { rows: [{ connected: true }] };
      }
      async end() {}
    },
  };
});
afterEach(() => vi.restoreAllMocks());
describe('hosted database connection recovery', () => {
  it('handles an idle connection error without crashing and can serve the next query', async () => {
    const previousCa = config.databaseCaPath;
    config.databaseCaPath = '';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = new Database('postgresql://test.invalid/database');
    config.databaseCaPath = previousCa;
    try {
      expect(() =>
        state.pool!.emit('error', new Error('private connection details')),
      ).not.toThrow();
      expect(log).toHaveBeenCalledWith(
        'Database connection interrupted. The next request will reconnect.',
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('private connection details');
      expect(await db.query('SELECT 1')).toEqual([{ connected: true }]);
    } finally {
      await db.close();
    }
  });
});
