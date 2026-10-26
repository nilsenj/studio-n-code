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
