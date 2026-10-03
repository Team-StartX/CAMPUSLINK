import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService, useSession } from './session';
import { apiClient } from '@/services/api/client';
import type { User } from '@/types';

vi.mock('@/services/api/remote', () => ({
  backendEnabled: true,
  setCsrf: vi.fn(),
  setTargetStudent: vi.fn(),
}));
vi.mock('@/services/api/client', () => ({ apiClient: { get: vi.fn() } }));
const user: User = { id: 'user', name: 'Test', email: 'test@example.com', role: 'student' };
beforeEach(() => {
  vi.clearAllMocks();
  useSession.getState().setUser(null);
});

describe('session restoration', () => {
  it('restores a cookie session for a public-page visitor', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { user, csrf: 'token' } });
    expect(await authService.restore()).toEqual(user);
    expect(useSession.getState().user).toEqual(user);
    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
  });
  it('clears an expired session', async () => {
    useSession.getState().setUser(user);
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Unauthorized'));
    expect(await authService.restore()).toBeNull();
    expect(useSession.getState().user).toBeNull();
  });
  it('does not erase a new login when an older request fails', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const restore = authService.restore();
    useSession.getState().setUser(user);
    reject(new Error('Unauthorized'));
    expect(await restore).toEqual(user);
    expect(useSession.getState().user).toEqual(user);
  });
  it('does not restore an old account after logout', async () => {
    useSession.getState().setUser(user);
    let resolve!: (response: unknown) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const restore = authService.restore();
    useSession.getState().setUser(null);
    resolve({ data: { user, csrf: 'old-token' } });
    expect(await restore).toBeNull();
    expect(useSession.getState().user).toBeNull();
  });
});
