type WorkerError = { name?: unknown; code?: unknown; cause?: unknown };
const explanations: Record<string, string> = {
  ENOTFOUND: 'Database or service hostname could not be resolved.',
  EAI_AGAIN: 'Temporary hostname lookup failure.',
  ECONNREFUSED: 'Database or service refused the connection.',
  ECONNRESET: 'Database or service connection was interrupted.',
  ETIMEDOUT: 'Database or service connection timed out.',
  '28P01': 'Database authentication failed. Check the deployed DATABASE_URL.',
  '28000': 'Database access was rejected.',
  '3D000': 'Configured database does not exist.',
  '42P01': 'Required database table is missing. Check deployed database and migrations.',
  '42703': 'Required database column is missing. Check deployed migrations.',
  '42501': 'Database role lacks permission for this operation.',
  '53300': 'Database connection limit reached.',
  '57P01': 'Database is restarting or shutting down.',
  '57P03': 'Database is temporarily unavailable.',
  CERT_HAS_EXPIRED: 'Database or service TLS certificate has expired.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS certificate could not be verified.',
};

export function workerErrorDetails(error: unknown) {
  const value = (error && typeof error === 'object' ? error : {}) as WorkerError;
  const cause = (value.cause && typeof value.cause === 'object' ? value.cause : {}) as WorkerError;
  const rawCode = value.code ?? cause.code;
  const code =
    typeof rawCode === 'string' && /^[A-Z0-9_]{2,64}$/.test(rawCode) ? rawCode : undefined;
  // Do not log raw database errors: they can contain credentials, queries or personal data.
  return {
    code,
    reason:
      (code && explanations[code]) ||
      (value.name === 'TimeoutError'
        ? 'Background operation timed out.'
        : 'Background operation failed; check database connectivity and service configuration.'),
  };
}

export function startWorker(name: string, task: () => Promise<void>, interval = 30000) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let failures = 0;
  const schedule = (delay: number) => {
    timer = setTimeout(() => void run(), delay);
    timer.unref();
  };
  const run = async () => {
    try {
      await task();
      if (failures) console.info(`${name} worker recovered`);
      failures = 0;
    } catch (error) {
      failures += 1;
      console.error(`${name} worker failed`, workerErrorDetails(error));
    } finally {
      // Each worker has its own timer; a slow external service cannot pause other workers.
      if (!stopped) schedule(Math.min(interval * 2 ** Math.min(failures, 4), 300000));
    }
  };
  schedule(interval);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
