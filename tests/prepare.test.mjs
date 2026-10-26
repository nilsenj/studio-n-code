import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureProduct, assertRevision, patchWorkbench, patchMenuDefault, patchShell } from '../scripts/lib/product.mjs';

test('Studio has independent identity while retaining upstream licensing', () => {
  const upstream = { nameShort: 'Code - OSS', licenseName: 'MIT', builtInExtensions: [{ name: 'debugger' }] };
  const result = configureProduct(upstream);
  assert.equal(result.nameShort, 'studio-n-code');
  assert.equal(result.applicationName, 'studio-n-code');
  assert.equal(result.dataFolderName, '.studio-n-code');
  assert.equal(result.win32AppUserModelId, 'StudioNCode.Editor');
  assert.equal(result.licenseName, 'MIT');
  assert.deepEqual(result.builtInExtensions, upstream.builtInExtensions);
  assert.equal(upstream.nameShort, 'Code - OSS');
  assert.deepEqual(configureProduct(result), result);
});

test('setup rejects an unexpected upstream revision', () => {
  assert.throws(() => assertRevision('bad', 'expected'), /revision/);
  assert.doesNotThrow(() => assertRevision('expected\n', 'expected'));
});

test('native workbench import is added exactly once', () => {
  const input = "import './workbench.common.main.js';\n";
  const patched = patchWorkbench(input);
  assert.match(patched, /studio.contribution.js/);
  assert.equal(patchWorkbench(patched), patched);
  assert.throws(() => patchWorkbench('unexpected source'), /anchor/);
});

test('compact menu is a native default and the patch is idempotent', () => {
  const source = "'default': isWeb ? 'compact' : 'classic',";
  const result = patchMenuDefault(source);
  assert.equal(result, "'default': 'compact', // studio-n-code menu default");
  assert.equal(patchMenuDefault(result), result);
  assert.throws(() => patchMenuDefault('changed upstream'), /anchor/);
});

test('shell patch reserves real grid space for the right rail and enlarges the header', () => {
  const layout = 'this.workbenchGrid.layout(this._mainContainerDimension.width, this._mainContainerDimension.height);';
  assert.match(patchShell('layout', layout), /width - 40/);
  const header = 'let value = this.isCommandCenterVisible || wcoEnabled ? DEFAULT_CUSTOM_TITLEBAR_HEIGHT : 30;';
  assert.match(patchShell('titlebar', header), /Math.max\(48, DEFAULT_CUSTOM_TITLEBAR_HEIGHT\)/);
  assert.equal(patchShell('layout', patchShell('layout', layout)), patchShell('layout', layout));
  assert.throws(() => patchShell('layout', 'changed upstream'), /anchor/);
});
