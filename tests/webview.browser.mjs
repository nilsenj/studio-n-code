import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../upstream/package.json', import.meta.url));
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
after(() => browser.close());
const script = await readFile(new URL('../customizations/studio-workbench/ui/git.js', import.meta.url), 'utf8');
const snapshot = { type: 'snapshot', repository: 'file:///repo', repositories: [{ id: 'file:///repo', name: 'repo' }], name: 'repo', branch: 'main', ref: '', branches: [{ name: 'main', type: 0, commit: 'abc' }], changes: [{ path: '/repo/a.ts', relativePath: 'a.ts', status: 'M' }], commits: [{ hash: 'abc', row: 0, lane: 0, parents: [], message: 'Initial commit', authorName: 'Test' }] };

async function pageFor(kind) {
  const page = await browser.newPage();
  await page.setContent(`<body data-kind="${kind}"><div id="app"></div></body>`);
  await page.evaluate(() => { window.sent = []; window.acquireVsCodeApi = () => ({ getState: () => undefined, setState: () => {}, postMessage: message => window.sent.push(message) }); });
  await page.addScriptTag({ content: script });
  await page.evaluate(message => window.dispatchEvent(new MessageEvent('message', { data: message })), snapshot);
  return page;
}

test('Git refresh preserves commit message focus and selection', async () => {
  const page = await pageFor('commit');
  try {
    await page.locator('textarea').fill('A commit message');
    await page.locator('textarea').evaluate(element => element.setSelectionRange(2, 7));
    await page.evaluate(message => window.dispatchEvent(new MessageEvent('message', { data: message })), snapshot);
    const state = await page.locator('textarea').evaluate(element => ({ focused: document.activeElement === element, start: element.selectionStart, end: element.selectionEnd, value: element.value }));
    assert.deepEqual(state, { focused: true, start: 2, end: 7, value: 'A commit message' });
  } finally { await page.close(); }
});

test('Git refresh preserves history search focus and query', async () => {
  const page = await pageFor('log');
  try {
    await page.locator('.log-search').fill('Initial');
    await page.evaluate(message => window.dispatchEvent(new MessageEvent('message', { data: message })), snapshot);
    assert.equal(await page.locator('.log-search').evaluate(element => document.activeElement === element && element.value === 'Initial'), true);
  } finally { await page.close(); }
});

test('commit completion is visible and subsequent errors replace success', async () => {
  const page = await pageFor('commit');
  try {
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'committed', files: 2, hash: 'abc123' } })));
    assert.equal(await page.locator('.success').getAttribute('hidden'), null);
    assert.match(await page.locator('.success').textContent(), /Committed 2 files.*abc123/);
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'error', message: 'Remote rejected the push' } })));
    assert.equal(await page.locator('.success').evaluate(element => element.hidden), true);
    assert.equal(await page.locator('.error').textContent(), 'Remote rejected the push');
  } finally { await page.close(); }
});

test('Code Board searches all card types and Explain carries the selected card ID', async () => {
  const page = await browser.newPage();
  try {
    const html = (await readFile(new URL('../customizations/studio-workbench/ui/board.html', import.meta.url), 'utf8')).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/<script nonce="\{\{NONCE\}\}" src="\{\{SCRIPT\}\}"><\/script>/, '');
    await page.setContent(html);
    await page.evaluate(() => { window.sent = []; window.acquireVsCodeApi = () => ({ postMessage: message => window.sent.push(message) }); });
    await page.addScriptTag({ content: await readFile(new URL('../customizations/studio-workbench/ui/board.js', import.meta.url), 'utf8') });
    const board = { root: '/repo', branch: 'main', files: [{ id: 'file:src/app.js', kind: 'file', path: 'src/app.js', title: 'app.js' }],
      areas: [{ id: 'area:src', kind: 'area', path: 'src', title: 'src', fileCount: 1 }], changes: [],
      features: [{ id: 'feature:abc', kind: 'feature', title: 'Search', hash: 'abc' }], commits: [] };
    await page.evaluate(value => window.dispatchEvent(new MessageEvent('message', { data: { type: 'board', board: value } })), board);
    await page.locator('#tabs button').filter({ hasText: 'Files' }).click();
    await page.locator('#search').fill('app.js');
    assert.equal(await page.locator('.card').count(), 1);
    await page.locator('.card .explain').click();
    assert.deepEqual(await page.evaluate(() => window.sent.at(-1)), { type: 'explain', id: 'file:src/app.js' });
    await page.locator('#tabs button').filter({ hasText: 'Features' }).click();
    await page.locator('#search').fill('Search');
    assert.equal(await page.locator('.card').count(), 1);
    await page.locator('.card .explain').click();
    assert.deepEqual(await page.evaluate(() => window.sent.at(-1)), { type: 'explain', id: 'feature:abc' });
  } finally { await page.close(); }
});

test('Code Board card activation opens details and modal Explain keeps the card identity', async () => {
  const page = await browser.newPage();
  try {
    const html = (await readFile(new URL('../customizations/studio-workbench/ui/board.html', import.meta.url), 'utf8')).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/<script nonce="\{\{NONCE\}\}" src="\{\{SCRIPT\}\}"><\/script>/, '');
    await page.setContent(html);
    await page.evaluate(() => { window.sent = []; window.acquireVsCodeApi = () => ({ postMessage: message => window.sent.push(message) }); });
    await page.addScriptTag({ content: await readFile(new URL('../customizations/studio-workbench/ui/board.js', import.meta.url), 'utf8') });
    const board = { root: '/repo', branch: 'main', files: [{ id: 'file:src/app.js', kind: 'file', path: 'src/app.js', title: 'app.js' }], areas: [], changes: [], features: [], commits: [] };
    await page.evaluate(value => window.dispatchEvent(new MessageEvent('message', { data: { type: 'board', board: value } })), board);
    await page.locator('#tabs button').filter({ hasText: 'Files' }).click();
    await page.locator('.card').click();
    assert.deepEqual(await page.evaluate(() => window.sent.at(-1)), { type: 'details', id: 'file:src/app.js' });
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'details', details: { kind: 'file', title: 'app.js', path: 'src/app.js', language: 'JS', status: 'M', history: ['abc update'] } } })));
    assert.equal(await page.locator('#details-dialog').evaluate(element => element.open), true);
    assert.match(await page.locator('#details-content').textContent(), /src\/app\.js.*JS.*M.*abc update/s);
    await page.locator('#details-explain').click();
    assert.deepEqual(await page.evaluate(() => window.sent.at(-1)), { type: 'explain', id: 'file:src/app.js' });
  } finally { await page.close(); }
});

test('AI Mode automatically discovers saved provider models without sending a saved key', async () => {
  const page = await browser.newPage();
  try {
    const html = (await readFile(new URL('../customizations/studio-workbench/ui/ai.html', import.meta.url), 'utf8')).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/<script nonce="\{\{NONCE\}\}" src="\{\{SCRIPT\}\}"><\/script>/, '');
    await page.setContent(html);
    await page.evaluate(() => { window.sent = []; window.acquireVsCodeApi = () => ({ postMessage: message => window.sent.push(message) }); });
    await page.addScriptTag({ content: await readFile(new URL('../customizations/studio-workbench/ui/ai.js', import.meta.url), 'utf8') });
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'settings', provider: 'gemini', model: 'gemini-flash', hasKey: true } })));
    assert.deepEqual(await page.evaluate(() => window.sent.at(-1)), { type: 'discoverModels', provider: 'gemini', key: '' });
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'models', provider: 'gemini', options: [{ id: 'gemini-flash', label: 'Gemini Flash', recommended: true }], recommended: 'gemini-flash' } })));
    assert.equal(await page.locator('#model').inputValue(), 'gemini-flash');
    assert.match(await page.locator('#model-note').textContent(), /Balanced recommendation/);
  } finally { await page.close(); }
});
