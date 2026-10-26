import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { searchItems, runAction, initializeLayout } = require('../customizations/studio-workbench/workflow.cjs');

test('search finds files and actions case-insensitively and keeps file URI', () => {
  const uri = { fsPath: 'C:/project/src/User.ts' };
  const items = searchItems('user', [{ label: 'src/User.ts', uri }], [{ id: 'rename', title: 'Rename User' }]);
  assert.equal(items.length, 2);
  assert.equal(items[0].uri, uri);
  assert.equal(items[1].command, 'rename');
  assert.equal(searchItems('absent', [{ label: 'src/User.ts', uri }], []).length, 0);
});

test('action routing opens files, executes commands, and ignores cancellation', async () => {
  const calls = [];
  const api = { window: { showTextDocument: async uri => calls.push(['open', uri]) }, commands: { executeCommand: async id => calls.push(['command', id]) } };
  await runAction(api, undefined);
  await runAction(api, { uri: 'file:///a.ts' });
  await runAction(api, { command: 'editor.action.rename' });
  assert.deepEqual(calls, [['open', 'file:///a.ts'], ['command', 'editor.action.rename']]);
});

test('layout initializes once and does not write user configuration', async () => {
  const calls = [];
  const data = new Map();
  const state = { get: key => data.get(key), update: async (key, value) => data.set(key, value) };
  const api = { commands: { executeCommand: async id => calls.push(id) } };
  await initializeLayout(api, state);
  await initializeLayout(api, state);
  assert.deepEqual(calls, ['workbench.action.closeAuxiliaryBar', 'workbench.action.positionPanelBottom', 'workbench.view.explorer', 'studio.gitLog.focus', 'workbench.action.focusActiveEditorGroup']);
});
