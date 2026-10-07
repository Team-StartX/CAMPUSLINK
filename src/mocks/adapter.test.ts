import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockAdapter } from './adapter';
afterEach(() => vi.unstubAllEnvs());
describe('workspace persistence boundary', () => {
  it('never substitutes sample accounts when real persistence is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(mockAdapter.read()).rejects.toThrow('persistence is not configured');
    expect(() => mockAdapter.reset()).toThrow('restricted to isolated tests');
  });
});
