import { apiClient } from './client';
export const backendEnabled = process.env.NEXT_PUBLIC_APP_ENV === 'api';
let csrf = '';
let target = '';
export const setCsrf = (value: string) => {
  csrf = value;
};
export const setTargetStudent = (value: string) => {
  target = value;
};
apiClient.interceptors.request.use((config) => {
  if (csrf) config.headers.set('X-CSRF-Token', csrf);
  if (target) config.headers.set('X-Student-ID', target);
  return config;
});
export async function rpc<T>(service: string, method: string, args: unknown[] = []): Promise<T> {
  if (!csrf) {
    const { data } = await apiClient.get('/auth/me');
    setCsrf(data.csrf);
  }
  const response = await apiClient.post(`/services/${service}/${method}`, { args });
  return response.data;
}
export function remoteService<T extends object>(
  name: string,
  local: T,
  synchronous: string[] = [],
): T {
  return new Proxy(local, {
    get(object, key, receiver) {
      const value = Reflect.get(object, key, receiver);
      return backendEnabled && typeof value === 'function' && !synchronous.includes(String(key))
        ? (...args: unknown[]) => rpc(name, String(key), args)
        : value;
    },
  });
}
