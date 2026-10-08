import { config } from './config';

export function trustedOrigin(origin: string | undefined) {
  if (!origin || origin === config.origin) return true;
  if (config.production) return false;
  if (config.developmentOrigins.includes(origin)) return true;
  try {
    const expected = new URL(config.origin);
    const actual = new URL(origin);
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return (
      actual.origin === origin &&
      loopback.has(expected.hostname) &&
      loopback.has(actual.hostname) &&
      actual.protocol === expected.protocol &&
      actual.port === expected.port
    );
  } catch {
    return false;
  }
}
