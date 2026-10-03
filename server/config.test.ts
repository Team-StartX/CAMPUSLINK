import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  for (const key of [
    'PORT',
    'HOST',
    'FRONTEND_URL',
    'DATABASE_URL',
    'STORAGE_PROVIDER',
    'SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
    'EMAIL_PROVIDER',
    'RESEND_API_KEY',
    'EMAIL_FROM',
  ])
    vi.stubEnv(key, '');
  vi.stubEnv('NODE_ENV', 'test');
});
afterEach(() => vi.unstubAllEnvs());

describe('deployment configuration', () => {
  it('accepts a hosting service port and binds on all interfaces by default', async () => {
    vi.stubEnv('PORT', '10000');
    const { config } = await import('./config');
    expect(config.port).toBe(10000);
    expect(config.host).toBe('0.0.0.0');
  });

  it('keeps the development port and allows a custom host', async () => {
    vi.stubEnv('HOST', '127.0.0.1');
    const { config } = await import('./config');
    expect(config.port).toBe(8000);
    expect(config.host).toBe('127.0.0.1');
  });

  it.each(['abc', '0', '65536', '8000.5'])('rejects invalid port %s', async (port) => {
    vi.stubEnv('PORT', port);
    await expect(import('./config')).rejects.toThrow('PORT must be an integer');
  });

  it('reports missing external service credentials before production starts', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://example.invalid/db');
    vi.stubEnv('STORAGE_PROVIDER', 'supabase');
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    await expect(import('./config')).rejects.toThrow(
      'Missing production settings: FRONTEND_URL, SUPABASE_URL, SUPABASE_SECRET_KEY, RESEND_API_KEY, EMAIL_FROM',
    );
  });
});
