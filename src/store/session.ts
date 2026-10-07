import { apiClient } from '@/services/api/client';
import { setCsrf, setTargetStudent } from '@/services/api/remote';
import { Role, User } from '@/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
interface Session {
  user: User | null;
  remember: boolean;
  setUser: (user: User | null) => void;
  setRemember: (remember: boolean) => void;
}
export const useSession = create<Session>()(
  persist(
    (set) => ({
      user: null,
      remember: false,
      setUser: (user) => set({ user }),
      setRemember: (remember) => set({ remember }),
    }),
    {
      name: 'campuslink-session',
      storage: createJSONStorage(() => ({
        getItem: (name) =>
          typeof window === 'undefined'
            ? null
            : localStorage.getItem(name) || sessionStorage.getItem(name),
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          const remembered = JSON.parse(value).state.remember;
          localStorage.removeItem(name);
          sessionStorage.removeItem(name);
          (remembered ? localStorage : sessionStorage).setItem(name, value);
        },
        removeItem: (name) => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(name);
            sessionStorage.removeItem(name);
          }
        },
      })),
    },
  ),
);
export const authService = {
  async login(email: string, password: string, remember = false): Promise<User> {
    email = email.trim().toLowerCase();
    const { data } = await apiClient.post('/auth/login', { email, password, remember });
    setCsrf(data.csrf);
    setTargetStudent('');
    useSession.getState().setRemember(remember);
    useSession.getState().setUser(data.user);
    return data.user;
  },
  async register(
    name: string,
    email: string,
    role: Role,
    password?: string,
    details: Record<string, string | undefined> = {},
  ): Promise<User> {
    email = email.trim().toLowerCase();
    const { data } = await apiClient.post('/auth/register', {
      name,
      email,
      role,
      password,
      ...details,
    });
    setCsrf(data.csrf);
    setTargetStudent('');
    useSession.getState().setUser(data.user);
    return data.user;
  },
  async restore() {
    const previousUser = useSession.getState().user;
    try {
      const { data } = await apiClient.get('/auth/me');
      // A delayed restore must not overwrite a newer login or logout.
      if (useSession.getState().user !== previousUser) return useSession.getState().user;
      setCsrf(data.csrf);
      useSession.getState().setUser(data.user);
      return data.user as User;
    } catch {
      if (useSession.getState().user !== previousUser) return useSession.getState().user;
      useSession.getState().setUser(null);
      return null;
    }
  },
  async requestReset(email: string) {
    return (await apiClient.post('/auth/forgot-password', { email })).data;
  },
  async logout() {
    if (await this.restore()) {
      await apiClient.post('/auth/logout');
      setCsrf('');
      setTargetStudent('');
    }
    useSession.getState().setUser(null);
  },
};
