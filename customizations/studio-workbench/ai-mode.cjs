'use strict';

class SseDecoder {
  constructor(onDelta = () => {}) { this.buffer = ''; this.text = ''; this.done = false; this.onDelta = onDelta; }
  write(chunk) {
    this.buffer += chunk.replaceAll('\r', '');
    while (true) {
      const index = this.buffer.indexOf('\n\n');
      if (index < 0) break;
      const frame = this.buffer.slice(0, index).replaceAll('\r', '');
      this.buffer = this.buffer.slice(index + 2);
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data === '[DONE]') { this.done = true; continue; }
      if (!data) continue;
      let json; try { json = JSON.parse(data); } catch { continue; }
      if (json.error) throw new Error(json.error.message || 'AI service returned an error.');
      const delta = json.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) { this.text += delta; this.onDelta(delta); }
    }
    return { text: this.text, done: this.done };
  }
}

function parseSseChunks(chunks) {
  const decoder = new SseDecoder();
  for (const chunk of chunks) decoder.write(chunk);
  return { text: decoder.text, done: decoder.done };
}

function compatibleEndpoint(value) {
  const input = new URL(String(value).trim());
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(input.hostname);
  if (input.protocol !== 'https:' && !(loopback && input.protocol === 'http:')) throw new Error('AI endpoint must use HTTPS except for localhost.');
  if (input.username || input.password || input.search || input.hash) throw new Error('AI endpoint cannot include credentials, a query or a fragment.');
  return input.toString().replace(/\/$/, '').replace(/\/chat\/completions$/, '') + '/chat/completions';
}

function extractReplacement(text) {
  const match = /^\s*```[^\n]*\n([\s\S]*?)```\s*$/.exec(text);
  if (!match) throw new Error('The model did not return a complete fenced file. No edit was staged.');
  return match[1];
}

async function complete({ endpoint, model, key = '', messages, signal, onDelta = () => {}, requireDone = false }) {
  if (!model?.trim()) throw new Error('Choose an AI model in AI Mode settings.');
  const response = await fetch(compatibleEndpoint(endpoint), {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: model.trim(), messages, stream: true }),
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
  if (!response.body) throw new Error('AI service did not provide a response body.');
  const decoder = new SseDecoder(onDelta);
  const utf8 = new TextDecoder();
  for await (const chunk of response.body) {
    if (signal?.aborted) throw new Error('AI request stopped.');
    decoder.write(utf8.decode(chunk, { stream: true }));
    if (decoder.text.length > 200000) throw new Error('AI response exceeded the display limit.');
  }
  decoder.write(utf8.decode());
  if (requireDone && !decoder.done) throw new Error('AI response ended before completion. No edit was staged.');
  if (!decoder.text) throw new Error('AI service returned no text.');
  return decoder.text;
}

module.exports = { SseDecoder, parseSseChunks, extractReplacement, compatibleEndpoint, complete };
