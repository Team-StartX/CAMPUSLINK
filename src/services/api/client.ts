import axios from 'axios';
export function requestErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Unexpected request error';
  if (typeof error.response?.data?.message === 'string') return error.response.data.message;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
    return 'The server is taking too long to respond. Please try again in a moment.';
  if (!error.response || error.response.status >= 500)
    return process.env.NODE_ENV === 'development'
      ? 'We could not connect to CampusLink. Start the website and its API with npm run dev, then try again.'
      : 'We could not connect to CampusLink. Please try again in a moment.';
  if (error.response.status === 429)
    return 'Too many attempts. Please wait a few minutes before trying again.';
  return 'Unable to complete this request. Please try again.';
}
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  timeout: 30000,
  withCredentials: true,
});
apiClient.interceptors.request.use((config) => {
  config.headers.set('Accept', 'application/json');
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(new Error(requestErrorMessage(error))),
);
// Future authentication headers must use server-issued credentials, never a mock session.
