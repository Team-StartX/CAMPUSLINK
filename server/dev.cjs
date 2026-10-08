const { context } = require('esbuild');
const { spawn } = require('node:child_process');
let child;
let watcher;
let stopping = false;
let retryTimer;
let failures = 0;
let restartQueue = Promise.resolve();

function startServer() {
  if (stopping) return;
  const started = Date.now();
  const running = spawn(process.execPath, ['server/dist/index.cjs'], {
    stdio: 'inherit',
    windowsHide: true,
  });
  child = running;
  running.on('error', (error) => console.error(`API process failed: ${error.message}`));
  running.once('close', (code, signal) => {
    if (child !== running || stopping) return;
    child = undefined;
    if (Date.now() - started > 60000) failures = 0;
    const delay = Math.min(1000 * 2 ** Math.min(failures++, 5), 30000);
    console.error(`API stopped (${signal || code}). Retrying in ${delay / 1000}s.`);
    retryTimer = setTimeout(startServer, delay);
  });
}

async function stopServer() {
  clearTimeout(retryTimer);
  const running = child;
  child = undefined;
  if (!running || running.exitCode !== null || running.signalCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => running.kill('SIGKILL'), 5000);
    running.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
    running.kill();
  });
}
context({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  packages: 'external',
  outdir: 'server/dist',
  outExtension: { '.js': '.cjs' },
  sourcemap: true,
  plugins: [
    {
      name: 'restart-server',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length) return;
          restartQueue = restartQueue.then(async () => {
            await stopServer();
            startServer();
          });
          await restartQueue;
        });
      },
    },
  ],
})
  .then(async (ctx) => {
    watcher = ctx;
    if (stopping) await ctx.dispose();
    else await ctx.watch();
  })
  .catch((error) => {
    console.error(`API watcher failed: ${error.message}`);
    process.exitCode = 1;
    void close();
  });
async function close() {
  if (stopping) return;
  stopping = true;
  await restartQueue;
  await stopServer();
  await watcher?.dispose();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
