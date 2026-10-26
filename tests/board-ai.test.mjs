import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
const require = createRequire(import.meta.url);
const { buildBoard, boardContext } = require('../customizations/studio-workbench/code-board.cjs');
const { parseSseChunks, extractReplacement, compatibleEndpoint, complete } = require('../customizations/studio-workbench/ai-mode.cjs');

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
