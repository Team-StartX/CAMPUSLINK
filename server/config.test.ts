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
    'AI_PROVIDER',
    'OPENAI_API_KEY',
  ])
    vi.stubEnv(key, '');
  vi.stubEnv('NODE_ENV', 'test');
});
afterEach(() => vi.unstubAllEnvs());

describe('deployment configuration', () => {
  const production = () => {
    for (const [key, value] of Object.entries({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example.invalid/db',
      STORAGE_PROVIDER: 'supabase',
      EMAIL_PROVIDER: 'resend',
      FRONTEND_URL: 'https://campus.example',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'test-storage-key',
      RESEND_API_KEY: 'test-mail-key',
      EMAIL_FROM: 'placements@example.invalid',
    }))
      vi.stubEnv(key, value);
  };
  it.each(['STORAGE_PROVIDER', 'EMAIL_PROVIDER', 'AI_PROVIDER'])(
    'rejects unsupported %s',
    async (key) => {
      production();
      vi.stubEnv(key, 'misspelled-provider');
      await expect(import('./config')).rejects.toThrow(`${key} must be`);
    },
  );
  it.each([
    'http://campus.example',
    'https://campus.example/',
    'https://campus.example/path',
    'https://user:password@campus.example',
  ])('rejects unsafe production frontend origin %s', async (origin) => {
    production();
    vi.stubEnv('FRONTEND_URL', origin);
    await expect(import('./config')).rejects.toThrow('FRONTEND_URL must be an HTTPS origin');
  });
  it('accepts a fully configured production environment', async () => {
    production();
    expect((await import('./config')).config.production).toBe(true);
  });
  it('requires a PostgreSQL URL in production', async () => {
    production();
    vi.stubEnv('DATABASE_URL', 'https://example.invalid/db');
    await expect(import('./config')).rejects.toThrow('DATABASE_URL must be a PostgreSQL');
  });
  it('requires the optional AI provider key before startup', async () => {
    production();
    vi.stubEnv('AI_PROVIDER', 'openai');
    await expect(import('./config')).rejects.toThrow('OPENAI_API_KEY is required');
  });
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
