import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchConfiguration } from '../scripts/lib/launcher.mjs';

test('desktop launch uses file output instead of a console pipe and preserves paths with spaces', () => {
  const config = launchConfiguration('C:/My Project/Studio', ['C:/User Code/My App'], { ELECTRON_RUN_AS_NODE: '1', PATH: 'tools' });
  assert.equal(config.env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(config.env.VSCODE_DEV, '1');
  assert.equal(config.env.PATH, 'tools');
  assert.equal(config.args.at(-1), 'C:/User Code/My App');
  assert.equal(config.detached, true);
  assert.equal(config.outputMode, 'file');
  assert.ok(config.args.includes('--user-data-dir'));
  assert.ok(config.args.includes('--extensions-dir'));
});
