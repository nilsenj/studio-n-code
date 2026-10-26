import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { launchConfiguration } from './lib/launcher.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const smoke = process.argv[2] === '--smoke';
if (smoke) { process.chdir(root); await import('./create-fixture.mjs'); }
const paths = smoke ? [readFileSync(join(root, 'artifacts/fixture-path.txt'), 'utf8').trim()]
  : process.argv.slice(2).map(path => resolve(path));
const config = launchConfiguration(root, paths, process.env, smoke);
if (!existsSync(config.executable) || !existsSync(join(config.cwd, 'out/main.js'))) {
  throw new Error('studio-n-code has not been built. See README.md for build instructions.');
}
mkdirSync(join(root, '.logs'), { recursive: true });
const stamp = `${smoke ? 'smoke' : 'desktop'}-${Date.now()}`;
const stdoutPath = join(root, '.logs', `${stamp}.stdout.log`);
const stderrPath = join(root, '.logs', `${stamp}.stderr.log`);
const stdout = openSync(stdoutPath, 'a');
const stderr = openSync(stderrPath, 'a');
const child = spawn(config.executable, config.args, {
  cwd: config.cwd, env: config.env, detached: config.detached,
  // Persistent file handles survive the launching terminal and prevent EPIPE.
  stdio: ['ignore', stdout, stderr], windowsHide: false,
});
closeSync(stdout);
closeSync(stderr);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
console.log(`studio-n-code PID: ${child.pid}\nStartup log: ${stdoutPath}\nError log: ${stderrPath}`);
if (smoke) {
  const code = await new Promise(resolveExit => child.once('exit', resolveExit));
  process.exitCode = code ?? 1;
  console.log(`Desktop smoke runner exited with ${process.exitCode}`);
} else {
  child.unref();
}
