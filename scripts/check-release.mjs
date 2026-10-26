import { execFileSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = /^(?:upstream|node_modules|\.runtime|\.logs|\.private|artifacts|\.aws|\.codex|\.agents)\//;
const privatePath = /[A-Z]:[\\/]Users[\\/][^\s"'`]+/i;
const errors = [];
for (const file of files) {
  if (forbidden.test(file) || /^\.env(?:\.|$)/.test(file) && file !== '.env.example') errors.push(`Private/generated path is tracked: ${file}`);
  if (!/\.(?:md|json|[cm]?js|ts|css|html|svg|ps1|cmd|ya?ml)$/.test(file) || file.endsWith('package-lock.json')) continue;
  const text = await readFile(resolve(root, file), 'utf8');
  if (privatePath.test(text)) errors.push(`Personal machine path in ${file}`);
  if (file.endsWith('.md')) {
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].replace(/^<|>$/g, '').split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      try { await access(resolve(root, dirname(file), decodeURIComponent(target))); }
      catch { errors.push(`Broken local documentation link in ${file}: ${target}`); }
    }
  }
}
for (const file of ['README.md', 'BUILDING.md', 'CONTRIBUTING.md', 'SECURITY.md', 'NOTICE.md', 'LICENSE', 'CHANGELOG.md', 'assets/icon.svg', 'assets/icon.ico', 'assets/icon-512.png']) {
  if (!files.includes(file)) errors.push(`Release file is missing from Git: ${file}`);
}
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (pkg.name !== 'studio-n-code') errors.push('Root package name does not match studio-n-code.');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Release source checks passed for ${files.length} tracked files.`);
