import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application icon includes Windows sizes and correctly sized PNG exports', async () => {
  const ico = await readFile(new URL('../assets/icon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);
  for (let index = 0; index < 7; index++) {
    const entry = 6 + index * 16;
    const offset = ico.readUInt32LE(entry + 12);
    assert.equal(ico.subarray(offset, offset + 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(offset + ico.readUInt32LE(entry + 8) <= ico.length);
  }
  for (const size of [256, 512, 1024]) {
    const png = await readFile(new URL(`../assets/icon-${size}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
