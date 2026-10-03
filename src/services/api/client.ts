import axios from 'axios';
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  timeout: 15000,
  withCredentials: true,
});
apiClient.interceptors.request.use((config) => {
  config.headers.set('Accept', 'application/json');
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.reject(
      new Error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || error.message
          : 'Unexpected request error',
      ),
    ),
);
// Future authentication headers must use server-issued credentials, never a mock session.
