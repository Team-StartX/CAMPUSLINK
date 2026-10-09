const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
require('dotenv').config({ path: path.resolve('.env'), quiet: true });

const children = new Set();
let stopping = false;
let restartTimer;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
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

function start(script, args, env, restart = false) {
  const child = spawn(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env,
    windowsHide: true,
  });
  children.add(child);
  child.on('error', () => {
    console.error('CampusLink could not start. Check the build and connection settings.');
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (stopping) return;
    if (restart) {
      console.error('The CampusLink API stopped. Restarting in 3 seconds…');
      restartTimer = setTimeout(() => start(script, args, env, true), 3000);
    } else stop(code || 0);
  });
}
async function healthy(origin) {
  try {
    const response = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok' && ['postgresql', 'sqlite-local'].includes(data.database);
  } catch {
    return false;
  }
}
async function main() {
  if (!fs.existsSync(path.resolve('.next/BUILD_ID')))
    throw new Error('Build the website first with npm run build.');
  const args = process.argv.slice(2);
  const portFlag = args.findIndex((arg) => arg === '--port' || arg === '-p');
  const port = portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || '3000';
  const origin = new URL(process.env.API_INTERNAL_URL || 'http://127.0.0.1:8000');
  const publicApi = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (local && !/^https?:\/\//.test(publicApi)) {
    if (!(await healthy(origin.origin))) {
      if (!fs.existsSync(path.resolve('server/dist/index.cjs')))
        throw new Error('Build the API first with npm run server:build.');
      console.log('Starting the CampusLink API and connecting to the database…');
      start(
        path.resolve('server/dist/index.cjs'),
        [],
        {
          ...process.env,
          PORT: origin.port || (origin.protocol === 'https:' ? '443' : '80'),
          FRONTEND_URL: process.env.FRONTEND_URL || `http://localhost:${port}`,
        },
        true,
      );
      const deadline = Date.now() + 60000;
      while (!stopping && !(await healthy(origin.origin))) {
        if (Date.now() >= deadline)
          throw new Error('The API could not connect. Check the database settings in server/.env.');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } else console.log('Using the running CampusLink API.');
  }
  if (!stopping)
    start(
      require.resolve('next/dist/bin/next'),
      ['start', '--hostname', '0.0.0.0', ...(portFlag >= 0 ? [] : ['--port', port]), ...args],
      process.env,
    );
}
main().catch((error) => {
  console.error(error.message);
  stop(1);
});
