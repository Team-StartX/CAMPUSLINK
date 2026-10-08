const apiOrigin = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
if (process.env.VERCEL && !process.env.API_INTERNAL_URL)
  throw new Error('Set API_INTERNAL_URL to the deployed backend URL before building on Vercel.');
const config = {
  allowedDevOrigins: (process.env.DEV_FRONTEND_ORIGINS || '')
    .split(',')
    .map((origin) => {
      try {
        return new URL(origin.trim()).hostname;
      } catch {
        return '';
      }
    })
    .filter(Boolean),
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};
export default config;
