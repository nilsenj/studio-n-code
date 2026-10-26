import { createReadStream, writeFile } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const write = promisify(writeFile);
const [directory, ...files] = process.argv.slice(2);
if (!directory || !files.length) throw new Error('Usage: node scripts/write-checksums.mjs <directory> <file> [file ...]');
const root = resolve(directory);
const lines = [];
for (const file of files) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(join(root, file))) digest.update(chunk);
  lines.push(`${digest.digest('hex')}  ${basename(file)}`);
}
await write(join(root, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'ascii');
console.log(`Wrote SHA256SUMS.txt for ${lines.length} release files.`);
