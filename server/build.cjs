const { buildSync } = require('esbuild');
buildSync({
  entryPoints: ['server/index.ts', 'server/cli.ts'],
  bundle: true,
  platform: 'node',
  packages: 'external',
  outdir: 'server/dist',
  outExtension: { '.js': '.cjs' },
  sourcemap: true,
});
console.log('Express backend built.');
