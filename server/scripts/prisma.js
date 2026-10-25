import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(serverRoot, '..');
dotenv.config({ path: resolve(projectRoot, '.env') });

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma');
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: serverRoot,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
