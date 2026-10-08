import { apiClient } from './client';
// CampusLink always uses server authentication and persisted application records.
export const backendEnabled = true;
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
  if (target && !config.headers.has('X-Student-ID')) config.headers.set('X-Student-ID', target);
  return config;
});
export async function rpc<T>(
  service: string,
  method: string,
  args: unknown[] = [],
  timeout?: number,
): Promise<T> {
  if (!csrf) {
    const { data } = await apiClient.get('/auth/me');
    setCsrf(data.csrf);
  }
  const response = await apiClient.post(`/services/${service}/${method}`, { args }, { timeout });
  return response.data;
}
export function remoteService<T extends object>(name: string, synchronous: Partial<T> = {}): T {
  return new Proxy(synchronous as T, {
    get(object, key) {
      if (key === 'then') return undefined;
      if (Object.prototype.hasOwnProperty.call(object, key)) return Reflect.get(object, key);
      return (...args: unknown[]) => rpc(name, String(key), args);
    },
  });
}
