const path = require('node:path');
const { spawn } = require('node:child_process');
require('dotenv').config({ path: path.resolve('.env'), quiet: true });

const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (process.platform === 'win32' && child.pid)
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    else child.kill();
  }
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function start(script, args = [], env = process.env) {
  const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env });
  children.add(child);
  child.on('error', (error) => {
    console.error(`Development startup failed: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) stop(code || 0);
  });
  return child;
}
async function healthy(origin) {
  try {
    const response = await fetch(`${origin}/api/v1/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok' && ['postgresql', 'sqlite-local'].includes(data.database);
  } catch {
    return false;
  }
}
async function main() {
  const args = process.argv.slice(2);
  const portFlag = args.findIndex((arg) => arg === '--port' || arg === '-p');
  const port = portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || '3000';
  const apiOrigin = new URL(process.env.API_INTERNAL_URL || 'http://127.0.0.1:8000');
  const publicApi = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  const localApi = ['localhost', '127.0.0.1', '[::1]'].includes(apiOrigin.hostname);
  if (process.env.NEXT_PUBLIC_APP_ENV === 'api' && localApi && !/^https?:\/\//.test(publicApi)) {
    if (!(await healthy(apiOrigin.origin))) {
      console.log('Starting the CampusLink API before the website…');
      start(path.resolve('server/dev.cjs'), [], {
        ...process.env,
        PORT: apiOrigin.port || (apiOrigin.protocol === 'https:' ? '443' : '80'),
        FRONTEND_URL: process.env.FRONTEND_URL || `http://localhost:${port}`,
      });
      const deadline = Date.now() + 30000;
      while (!stopping && !(await healthy(apiOrigin.origin))) {
        if (Date.now() >= deadline)
          throw new Error(
            'The API did not become ready. Check the database settings in server/.env.',
          );
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } else console.log('Using the running CampusLink API.');
  }
  if (!stopping)
    start(require.resolve('next/dist/bin/next'), [
      'dev',
      '--hostname',
      '0.0.0.0',
      ...(portFlag >= 0 ? [] : ['--port', port]),
      ...args,
    ]);
}
main().catch((error) => {
  console.error(error.message);
  stop(1);
});
