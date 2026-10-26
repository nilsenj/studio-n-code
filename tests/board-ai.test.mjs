import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { buildBoard, boardContext, loadBoard, detailForCard } = require('../customizations/studio-workbench/code-board.cjs');
const { parseSseChunks, extractReplacement, compatibleEndpoint, complete, listModels, recommendModel } = require('../customizations/studio-workbench/ai-mode.cjs');

test('board keeps every current file and groups directories, changes and feature commits', () => {
  const board = buildBoard({ files: ['README.md', 'src/main.ts', 'src/util.ts', 'docs/start.md'],
    status: new Map([['src/main.ts', 'M']]),
    commits: [{ hash: 'a'.repeat(40), subject: 'feat(search): add index', date: '2026-10-26' }] });
  assert.equal(board.files.length, 4);
  assert.equal(board.areas.find(area => area.path === 'src').fileCount, 2);
  assert.equal(board.changes[0].path, 'src/main.ts');
  assert.equal(board.features[0].title, 'add index');
});

test('board explanation context is bounded and identifies the selected source', () => {
  const context = boardContext({ kind: 'file', path: 'src/main.ts', title: 'main.ts' }, 'x'.repeat(100000), 5000);
  assert.match(context, /src\/main.ts/);
  assert.ok(context.length <= 5300);
  assert.match(context, /truncated/i);
});

test('SSE parser handles split frames, content chunks, completion and malformed data', () => {
  const frames = ['data: {"choices":[{"delta":{"content":"Hel', 'lo"}}]}\n\n: keepalive\n\ndata: bad\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n'];
  assert.deepEqual(parseSseChunks(frames), { text: 'Hello world', done: true });
});

test('edit proposals accept a full-file code fence and endpoints require HTTPS except loopback', () => {
  assert.equal(extractReplacement('```js\nconst n = 2;\n```'), 'const n = 2;\n');
  assert.throws(() => extractReplacement('```js\nconst n = 2;\n'), /complete fenced file/);
  assert.equal(compatibleEndpoint('https://api.example.test/v1'), 'https://api.example.test/v1/chat/completions');
  assert.equal(compatibleEndpoint('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/v1/chat/completions');
  assert.throws(() => compatibleEndpoint('http://example.test/v1'), /HTTPS/);
});

test('edit response requires the complete SSE stream', async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('data: {"choices":[{"delta":{"content":"```js\\npartial\\n```"}}]}\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(complete({ endpoint: `http://127.0.0.1:${server.address().port}/v1`, model: 'local-test',
      messages: [{ role: 'user', content: 'Edit' }], requireDone: true }), /before completion/);
  } finally { server.close(); }
});

test('AI mode streams a real local compatible response and sends selected code context', async () => {
  let payload;
  const server = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    payload = { path: request.url, auth: request.headers.authorization, body: JSON.parse(body) };
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write('data: {"choices":[{"delta":{"content":"File handles"}}]}\n\n');
    response.end('data: {"choices":[{"delta":{"content":" requests"}}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const deltas = [];
    const answer = await complete({ endpoint: `http://127.0.0.1:${server.address().port}/v1`, model: 'local-test', key: 'test-only',
      messages: [{ role: 'user', content: 'Explain src/server.js: handles requests' }], onDelta: value => deltas.push(value) });
    assert.equal(answer, 'File handles requests');
    assert.deepEqual(deltas, ['File handles', ' requests']);
    assert.equal(payload.path, '/v1/chat/completions');
    assert.equal(payload.auth, 'Bearer test-only');
    assert.equal(payload.body.messages[0].content.includes('src/server.js'), true);
    assert.equal(payload.body.stream, true);
  } finally { server.close(); }
});

test('AI output size is bounded for each provider', async () => {
  const calls = [];
  const server = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    calls.push({ path: request.url, body: JSON.parse(body) });
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end(request.url === '/v1/chat/completions' ? 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'
      : request.url === '/messages' ? 'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"ok"}}\n\nevent: message_stop\ndata: {}\n\n'
        : 'data: {"event_type":"step.delta","delta":{"type":"text","text":"ok"}}\n\ndata: {"event_type":"interaction.completed"}\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await complete({ provider: 'openai', baseUrl: `${baseUrl}/v1`, model: 'gpt-test', key: 'test', maxOutputTokens: 700, messages: [{ role: 'user', content: 'Short' }] });
    await complete({ provider: 'anthropic', baseUrl, model: 'claude-test', key: 'test', maxOutputTokens: 1600, messages: [{ role: 'user', content: 'Medium' }] });
    await complete({ provider: 'gemini', baseUrl, model: 'gemini-test', key: 'test', maxOutputTokens: 3200, messages: [{ role: 'user', content: 'Long' }] });
    assert.equal(calls[0].body.max_completion_tokens, 700);
    assert.equal(calls[1].body.max_tokens, 1600);
    assert.equal(calls[2].body.max_output_tokens, 3200);
  } finally { server.close(); }
});

test('model discovery normalizes and filters generation models and recommends a balanced choice', async () => {
  const server = http.createServer((request, response) => {
    assert.equal(request.url, '/v1beta/models?pageSize=100');
    assert.equal(request.headers['x-goog-api-key'], 'gemini-test');
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ models: [
      { name: 'models/gemini-2.5-flash', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
    ] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const models = await listModels('gemini', 'gemini-test', { baseUrl: `http://127.0.0.1:${server.address().port}/v1beta` });
    assert.deepEqual(models.map(model => model.id), ['gemini-2.5-flash']);
    assert.equal(recommendModel('gemini', models).id, 'gemini-2.5-flash');
  } finally { server.close(); }
});

test('OpenAI model discovery filters non-chat models and prefers a balanced available model', async () => {
  const server = http.createServer((request, response) => {
    assert.equal(request.url, '/v1/models');assert.equal(request.headers.authorization, 'Bearer openai-test');
    response.setHeader('content-type', 'application/json');response.end(JSON.stringify({ data: [
      { id: 'text-embedding-3-small' }, { id: 'whisper-1' }, { id: 'gpt-4.1' }, { id: 'gpt-4.1-mini' },
    ] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const models = await listModels('openai', 'openai-test', { baseUrl: `http://127.0.0.1:${server.address().port}/v1` });
    assert.deepEqual(models.map(model => model.id), ['gpt-4.1', 'gpt-4.1-mini']);assert.equal(recommendModel('openai', models).id, 'gpt-4.1-mini');
  } finally { server.close(); }
});

test('Anthropic model discovery follows pagination and recommends the Sonnet line', async () => {
  let calls = 0;
  const server = http.createServer((request, response) => {
    calls++;assert.equal(request.headers['x-api-key'], 'anthropic-list-test');assert.equal(request.headers['anthropic-version'], '2023-06-01');
    if (calls === 1) assert.equal(request.url, '/v1/models?limit=100'); else assert.equal(request.url, '/v1/models?limit=100&after_id=claude-opus-4');
    response.setHeader('content-type', 'application/json');response.end(JSON.stringify(calls === 1
      ? { data: [{ id: 'claude-opus-4', display_name: 'Claude Opus' }], has_more: true, last_id: 'claude-opus-4' }
      : { data: [{ id: 'claude-sonnet-4', display_name: 'Claude Sonnet' }], has_more: false }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const models = await listModels('anthropic', 'anthropic-list-test', { baseUrl: `http://127.0.0.1:${server.address().port}/v1` });
    assert.equal(calls, 2);assert.equal(recommendModel('anthropic', models).id, 'claude-sonnet-4');
  } finally { server.close(); }
});

test('Anthropic Messages streaming maps text deltas and requires completion', async () => {
  let requestData;
  const server = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    requestData = { headers: request.headers, body: JSON.parse(body) };
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"Hello"}}\n\nevent: message_stop\ndata: {}\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const deltas = [];
    const result = await complete({ provider: 'anthropic', baseUrl: `http://127.0.0.1:${server.address().port}`, model: 'claude-sonnet', key: 'anthropic-test', messages: [{ role: 'user', content: 'Hi' }], requireDone: true, onDelta: value => deltas.push(value) });
    assert.equal(result, 'Hello'); assert.deepEqual(deltas, ['Hello']);
    assert.equal(requestData.headers['x-api-key'], 'anthropic-test');
    assert.equal(requestData.headers['anthropic-version'], '2023-06-01');
  } finally { server.close(); }
});

test('Gemini Interactions streaming maps text deltas and completion', async () => {
  let payload;
  const server = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk; payload = JSON.parse(body);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('data: {"event_type":"step.delta","delta":{"type":"text","text":"Gemini"}}\n\ndata: {"event_type":"interaction.completed"}\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await complete({ provider: 'gemini', baseUrl: `http://127.0.0.1:${server.address().port}`, model: 'gemini-2.5-flash', key: 'gemini-test', messages: [{ role: 'system', content: 'Be concise' }, { role: 'user', content: 'Hi' }], requireDone: true });
    assert.equal(result, 'Gemini'); assert.equal(payload.model, 'gemini-2.5-flash'); assert.equal(payload.system_instruction, 'Be concise');
    assert.deepEqual(payload.input.map(item => item.type), ['user_input']);assert.equal(payload.input[0].content[0].text, 'Hi');
  } finally { server.close(); }
});

test('board commit details include author, dates, parents and changed paths; file changes include staged and unstaged status', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-board-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  try {
    git('init');git('config','user.name','Board Tester');git('config','user.email','board@example.test');
    await writeFile(`${root}/app.js`, 'const value = 1;\n');git('add','app.js');git('commit','-m','feat(editor): create app');
    await writeFile(`${root}/app.js`, 'const value = 2;\n');git('add','app.js');await writeFile(`${root}/app.js`, 'const value = 3;\n');
    const vscode = { workspace: { findFiles: async () => [] } };
    const board = await loadBoard(vscode, { uri: { fsPath: root } });
    const detail = await detailForCard(vscode, board, board.commits[0]);
    assert.equal(detail.author, 'Board Tester');assert.equal(detail.authorEmail, 'board@example.test');
    assert.ok(detail.authorDate);assert.ok(detail.commitDate);assert.equal(detail.parents.length, 0);
    assert.deepEqual(detail.changedFiles.map(file => file.path), ['app.js']);assert.deepEqual(detail.stats, { files: 1, additions: 1, deletions: 0 });
    assert.match(detail.patch, /create app|app\.js/);
    assert.equal(board.files.find(file => file.path === 'app.js').status, 'MM');
    assert.equal(board.files.find(file => file.path === 'app.js').indexStatus, 'M');assert.equal(board.files.find(file => file.path === 'app.js').worktreeStatus, 'M');
    const change = await detailForCard(vscode, board, board.changes[0]);
    assert.match(change.patch, /const value = 2/);assert.match(change.patch, /const value = 3/);assert.equal(change.indexStatus, 'M');assert.equal(change.worktreeStatus, 'M');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Code Board remains usable for a non-Git folder', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-board-'));
  try {
    const vscode = { workspace: { findFiles: async () => [{ fsPath: path.join(root, 'README.md') }] } };
    const board = await loadBoard(vscode, { uri: { fsPath: root } });
    assert.equal(board.hasGit, false);assert.equal(board.files[0].path, 'README.md');
    assert.equal((await detailForCard(vscode, board, board.files[0])).language, 'MD');
  } finally { await rm(root, { recursive: true, force: true }); }
});
