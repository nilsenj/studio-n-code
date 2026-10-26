import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runCommand, summarizeResult } = require('../customizations/studio-workbench/command-feedback.cjs');

test('unavailable commands explain the reason and do not execute', async () => {
  let executions = 0;
  const events = [];
  const result = await runCommand({ id: 'format', title: 'Reformat Code' }, async () => { executions++; }, { check: async () => 'No formatter is available for PHP.', emit: event => events.push(event) });
  assert.equal(executions, 0);
  assert.equal(result.phase, 'unavailable');
  assert.match(events.at(-1).message, /No formatter/);
});

test('false results are cancellation, not successful execution', async () => {
  const events = [];
  const result = await runCommand({ id: 'run', title: 'Run' }, async () => false, { emit: event => events.push(event) });
  assert.deepEqual(events.map(event => event.phase), ['running', 'cancelled']);
  assert.equal(result.phase, 'cancelled');
});

test('failed commands keep their error message and never emit success', async () => {
  const events = [];
  const result = await runCommand({ id: 'rename', title: 'Rename' }, async () => { throw new Error('Provider failed'); }, { emit: event => events.push(event) });
  assert.deepEqual(events.map(event => event.phase), ['running', 'error']);
  assert.equal(result.message, 'Provider failed');
});

test('formatting reports unchanged content honestly', () => {
  assert.deepEqual(summarizeResult({ id: 'studio.format', title: 'Reformat Code' }, undefined, { beforeVersion: 4, afterVersion: 4 }), { phase: 'unchanged', message: 'No formatting changes were needed or applied.' });
  assert.equal(summarizeResult({ id: 'studio.format', title: 'Reformat Code' }, undefined, { beforeVersion: 4, afterVersion: 5 }).phase, 'success');
});

test('void upstream commands acknowledge dispatch without claiming completion', () => {
  assert.equal(summarizeResult({ id: 'studio.push', title: 'Push' }, undefined).phase, 'dispatched');
});
