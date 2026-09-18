// Run by `shopify app dev` (see shopify.web.toml). Starts two processes:
// - the admin pages (Vite dev server on the CLI's PORT, behind its tunnel)
// - the storefront bundle, rebuilt into the theme extension's assets on change,
//   which the CLI then pushes to the dev store's theme.
//
// Vite is started through Node directly rather than a shell, so arguments are
// passed as-is on every platform (no shell: true, no DEP0190 warning).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const commands = [
  [],
  ['build', '--watch', '--config', 'vite.storefront.config.ts', '--logLevel', 'warn'],
];

const children = commands.map((args) => spawn(process.execPath, [vite, ...args], { stdio: 'inherit', env: process.env }));

const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) {
  child.on('exit', (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
}
