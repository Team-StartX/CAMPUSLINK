const { context } = require('esbuild');
const { spawn } = require('node:child_process');
let child;
let watcher;
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
        build.onEnd((result) => {
          if (result.errors.length) return;
          if (child) child.kill();
          child = spawn(process.execPath, ['server/dist/index.cjs'], { stdio: 'inherit' });
        });
      },
    },
  ],
}).then((ctx) => {
  watcher = ctx;
  return ctx.watch();
});
async function close() {
  child?.kill();
  await watcher?.dispose();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
