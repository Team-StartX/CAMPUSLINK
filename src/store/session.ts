import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { User, Role } from '@/types';
import { apiClient } from '@/services/api/client';
import { backendEnabled, setCsrf, setTargetStudent } from '@/services/api/remote';
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
    if (backendEnabled) {
      const { data } = await apiClient.post('/auth/login', { email, password, remember });
      setCsrf(data.csrf);
      setTargetStudent('');
      useSession.getState().setRemember(remember);
      useSession.getState().setUser(data.user);
      return data.user;
    }
    if (!email.includes('@') || password.length < 6)
      throw new Error('Enter a valid email and a password with at least 6 characters.');
    let registered: User | undefined;
    if (typeof window !== 'undefined') {
      const users = JSON.parse(localStorage.getItem('campuslink-accounts') || '[]') as User[];
      registered = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    }
    const role: Role = email.startsWith('recruiter')
      ? 'recruiter'
      : email.startsWith('campus')
        ? 'campus'
        : 'student';
    const user = registered || {
      id: 'demo-user',
      name:
        role === 'student'
          ? 'Diptiprav Dash'
          : role === 'recruiter'
            ? 'Sonalika Nayak'
            : 'Sonalika Nayak',
      email,
      role,
    };
    useSession.getState().setRemember(remember);
    useSession.getState().setUser(user);
    return user;
  },
  async register(
    name: string,
    email: string,
    role: Role,
    password?: string,
    details: Record<string, string | undefined> = {},
  ): Promise<User> {
    if (backendEnabled) {
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
    }
    const user = { id: crypto.randomUUID(), name, email, role };
    if (typeof window !== 'undefined') {
      const users = JSON.parse(localStorage.getItem('campuslink-accounts') || '[]') as User[];
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
        throw new Error('An account with this email already exists. Sign in instead.');
      users.push(user);
      localStorage.setItem('campuslink-accounts', JSON.stringify(users));
    }
    useSession.getState().setUser(user);
    return user;
  },
  async restore() {
    if (!backendEnabled) return useSession.getState().user;
    try {
      const { data } = await apiClient.get('/auth/me');
      setCsrf(data.csrf);
      useSession.getState().setUser(data.user);
      return data.user as User;
    } catch {
      useSession.getState().setUser(null);
      return null;
    }
  },
  async requestReset(email: string) {
    if (backendEnabled) return (await apiClient.post('/auth/forgot-password', { email })).data;
    return { message: 'Demo reset request recorded.' };
  },
  async logout() {
    if (backendEnabled) {
      if (!(await this.restore())) return;
      await apiClient.post('/auth/logout');
      setCsrf('');
      setTargetStudent('');
    }
    useSession.getState().setUser(null);
  },
};
