import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { changesFromState, validateCommitSelection, graphRows, selectRepository } = require('../customizations/studio-workbench/git-model.cjs');
const change = (file, status) => ({ uri: { fsPath: file }, status });

test('commit checklist merges staged and working changes without losing file status', () => {
  const result = changesFromState({ indexChanges: [change('/repo/a.ts', 0)], workingTreeChanges: [change('/repo/a.ts', 5), change('/repo/new.ts', 7)], mergeChanges: [] }, '/repo');
  assert.equal(result.length, 2);
  assert.deepEqual(result.find(item => item.path === '/repo/a.ts'), { path: '/repo/a.ts', relativePath: 'a.ts', status: 'M', staged: true, working: true, conflict: false });
  assert.equal(result.find(item => item.path === '/repo/new.ts').status, '?');
});

test('commit refuses to include unselected staged files or arbitrary paths', () => {
  const files = [{ path: '/repo/a', staged: true }, { path: '/repo/b', staged: false }];
  assert.throws(() => validateCommitSelection(files, ['/repo/b'], 'message'), /staged files/);
  assert.throws(() => validateCommitSelection(files, ['/outside'], 'message'), /changed files/);
  assert.throws(() => validateCommitSelection(files, ['/repo/a'], '  '), /message/);
  assert.throws(() => validateCommitSelection(files, [], 'message'), /Select/);
  assert.deepEqual(validateCommitSelection(files, ['/repo/a', '/repo/b', '/repo/b'], 'message'), ['/repo/a', '/repo/b']);
});

test('commit blocks unresolved conflicts', () => {
  assert.throws(() => validateCommitSelection([{ path: '/a', conflict: true }], ['/a'], 'message'), /conflicts/);
});

test('separately grouped untracked files are available in the commit checklist', () => {
  const files = changesFromState({ untrackedChanges: [change('/repo/new.ts', 7)] }, '/repo');
  assert.equal(files.length, 1);
  assert.equal(files[0].relativePath, 'new.ts');
  assert.equal(files[0].working, true);
});

test('graph follows actual parent edges through branches and merges', () => {
  const rows = graphRows([
    { hash: 'merge', parents: ['left', 'right'] },
    { hash: 'left', parents: ['root'] },
    { hash: 'right', parents: ['root'] },
    { hash: 'root', parents: [] },
  ]);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].parents.length, 2);
  assert.equal(rows[2].parents[0].hash, 'root');
  assert.equal(rows[3].parents.length, 0);
  for (const row of rows) {
    assert.ok(Number.isInteger(row.lane) && row.lane >= 0);
    for (const edge of row.parents) assert.ok(edge.row > row.row);
  }
});

test('Git header selects the opened workspace repository before a nested upstream checkout', () => {
  const upstream = { rootUri: { fsPath: 'C:\\repo\\upstream', toString: () => 'file:///C:/repo/upstream' }, state: { HEAD: { commit: 'tag-1.143.1' } } };
  const project = { rootUri: { fsPath: 'C:\\repo', toString: () => 'file:///C:/repo' }, state: { HEAD: { name: 'main' } } };
  assert.equal(selectRepository([upstream, project], { workspaceRoot: 'C:\\repo', platform: 'win32' }), project);
});

test('explicitly selected repository takes precedence over the active project repository', () => {
  const nested = { rootUri: { fsPath: '/repo/upstream', toString: () => 'file:///repo/upstream' } };
  const project = { rootUri: { fsPath: '/repo', toString: () => 'file:///repo' } };
  assert.equal(selectRepository([nested, project], { chosenRoot: 'file:///repo/upstream', workspaceRoot: '/repo', platform: 'linux' }), nested);
});
