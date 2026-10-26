import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(join(root, 'assets/icon.svg'));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map(size => new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng());
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + index * 16;
  header[entry] = sizes[index] === 256 ? 0 : sizes[index];
  header[entry + 1] = header[entry];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(pngs[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += pngs[index].length;
}
await writeFile(join(root, 'assets/icon.ico'), Buffer.concat([header, ...pngs]));
for (const size of [256, 512, 1024]) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(join(root, `assets/icon-${size}.png`), png);
}
await mkdir(join(root, 'customizations/native'), { recursive: true });
await copyFile(join(root, 'assets/icon.svg'), join(root, 'customizations/native/studio-mark.svg'));
console.log('Generated studio-n-code application icons: SVG, PNG (256/512/1024), ICO (16–256).');
