'use strict';

const PROVIDERS = {
  openai: { base: 'https://api.openai.com/v1', balanced: [/^gpt-5(?:\.\d+)?-mini/i, /^gpt-4\.1-mini/i, /^gpt-4o-mini/i, /^gpt-5(?:\.\d+)?(?!-nano)/i, /^gpt-4\.1(?!-nano)/i, /^gpt-4o/i, /^o4-mini/i, /^o3-mini/i], exclude: /(?:embedding|whisper|tts|dall-e|moderation|realtime|transcri|audio|search-preview|computer-use)/i },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta', balanced: [/^gemini-.*-flash(?!-lite)/i, /^gemini-.*-pro/i, /^gemini-.*-flash-lite/i], exclude: /(?:embedding|aqa|nano|tts|image|robotics)/i },
  anthropic: { base: 'https://api.anthropic.com/v1', balanced: [/^claude-.*sonnet/i], exclude: /(?:embedding|legacy|instant)/i },
};

function apiUrl(value, suffix) {
  const input = new URL(String(value));
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(input.hostname);
  if (input.protocol !== 'https:' && !(loopback && input.protocol === 'http:')) throw new Error('AI endpoint must use HTTPS except for localhost.');
  if (input.username || input.password || input.search || input.hash) throw new Error('AI endpoint cannot include credentials, a query or a fragment.');
  return `${input.toString().replace(/\/$/, '')}${suffix}`;
}

function compatibleEndpoint(value) {
  const input = new URL(String(value).trim());
  const base = input.toString().replace(/\/$/, '').replace(/\/chat\/completions$/, '');
  return apiUrl(base, '/chat/completions');
}

function extractReplacement(text) {
  const match = /^\s*```[^\n]*\n([\s\S]*?)```\s*$/.exec(text);
  if (!match) throw new Error('The model did not return a complete fenced file. No edit was staged.');
  return match[1];
}

class EventStream {
  constructor(provider, onDelta = () => {}) { this.provider = provider; this.onDelta = onDelta; this.buffer = ''; this.text = ''; this.done = false; }
  write(chunk) {
    this.buffer += chunk.replaceAll('\r', '');
    while (true) {
      const index = this.buffer.indexOf('\n\n'); if (index < 0) break;
      const frame = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 2);
      const eventName = frame.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data) continue;
      if (data === '[DONE]') { this.done = true; continue; }
      let json; try { json = JSON.parse(data); } catch { continue; }
      if (json.error || json.event_type === 'error') throw new Error(json.error?.message || json.message || 'AI service returned an error.');
      let delta = '';
      if (this.provider === 'openai') delta = json.choices?.[0]?.delta?.content || '';
      if (this.provider === 'anthropic') {
        if (json.type === 'content_block_delta' || json.delta?.type === 'text_delta') delta = json.delta?.text || '';
        if (json.type === 'message_stop' || eventName === 'message_stop') this.done = true;
      }
      if (this.provider === 'gemini') {
        if (json.event_type === 'step.delta' && json.delta?.type === 'text') delta = json.delta.text || '';
        if (json.event_type === 'interaction.completed') this.done = true;
      }
      if (typeof delta === 'string' && delta) { this.text += delta; this.onDelta(delta); }
    }
    return { text: this.text, done: this.done };
  }
}

function parseSseChunks(chunks) {
  const decoder = new EventStream('openai'); for (const chunk of chunks) decoder.write(chunk);
  return { text: decoder.text, done: decoder.done };
}

function modelId(provider, item) { return provider === 'gemini' ? String(item.name || '').replace(/^models\//, '') : String(item.id || ''); }
function textModel(provider, item) {
  const id = modelId(provider, item); if (!id) return false;
  if (provider === 'gemini') return (item.supportedGenerationMethods || []).some(method => ['generateContent', 'streamGenerateContent', 'interactions'].includes(method));
  return !PROVIDERS[provider].exclude.test(id);
}

async function listModels(provider, key, { signal, baseUrl } = {}) {
  const config = PROVIDERS[provider]; if (!config) throw new Error('Choose OpenAI, Gemini or Anthropic.');
  if (!key) throw new Error('Enter an API key before discovering models.');
  const base = baseUrl || config.base; const models = []; let cursor = '';
  for (let page = 0; page < 20; page++) {
    let url, headers = { Accept: 'application/json' };
    if (provider === 'openai') { url = apiUrl(base, '/models'); headers.Authorization = `Bearer ${key}`; }
    if (provider === 'gemini') { url = apiUrl(base, `/models?pageSize=100${cursor ? `&pageToken=${encodeURIComponent(cursor)}` : ''}`); headers['x-goog-api-key'] = key; }
    if (provider === 'anthropic') { url = apiUrl(base, `/models?limit=100${cursor ? `&after_id=${encodeURIComponent(cursor)}` : ''}`); headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01'; }
    const response = await fetch(url, { headers, signal });
    if (!response.ok) throw new Error(`${providerLabel(provider)} model discovery returned ${response.status}. Check the API key and provider access.`);
    const data = await response.json(); const batch = provider === 'gemini' ? data.models || [] : data.data || [];
    for (const item of batch) if (textModel(provider, item)) models.push({ id: modelId(provider, item), label: item.displayName || modelId(provider, item), description: provider === 'anthropic' ? (item.type || item.display_name) : undefined, recommended: false });
    cursor = provider === 'gemini' ? data.nextPageToken : data.has_more ? data.last_id || batch.at(-1)?.id : '';
    if (!cursor) break;
  }
  const unique = [...new Map(models.map(item => [item.id, item])).values()];
  if (!unique.length) throw new Error('No text-generation models were available for this API key.');
  const recommended = recommendModel(provider, unique); if (recommended) recommended.recommended = true;
  return unique.sort((a, b) => a.label.localeCompare(b.label));
}

function providerLabel(provider) { return ({ openai: 'OpenAI', gemini: 'Gemini', anthropic: 'Anthropic' })[provider] || 'AI'; }
function recommendModel(provider, models = []) {
  const patterns = PROVIDERS[provider]?.balanced || [];
  for (const pattern of patterns) { const match = models.find(item => pattern.test(item.id)); if (match) return match; }
  return models[0];
}

function endpointFor(provider, base, model) {
  const root = base || PROVIDERS[provider]?.base;
  if (!PROVIDERS[provider]) throw new Error('Choose OpenAI, Gemini or Anthropic.');
  if (provider === 'openai') return compatibleEndpoint(root);
  return apiUrl(root, provider === 'anthropic' ? '/messages' : '/interactions');
}

async function complete({ provider = 'openai', endpoint, baseUrl, model, key = '', messages, signal, onDelta = () => {}, requireDone = false }) {
  if (!model?.trim()) throw new Error('Choose a discovered AI model in AI Mode settings.');
  const base = baseUrl || endpoint || PROVIDERS[provider]?.base;
  const url = endpointFor(provider, base, model);
  let headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' }; let body;
  if (provider === 'openai') { if (key) headers.Authorization = `Bearer ${key}`; body = { model: model.trim(), messages, stream: true }; }
  if (provider === 'anthropic') {
    headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01';
    const system = messages.filter(item => item.role === 'system').map(item => item.content).join('\n');
    body = { model: model.trim(), max_tokens: 4096, stream: true, ...(system ? { system } : {}), messages: messages.filter(item => item.role !== 'system') };
  }
  if (provider === 'gemini') {
    headers['x-goog-api-key'] = key;
    body = { model: model.trim(), stream: true, input: messages.filter(item => item.role !== 'system').map(item => ({ type: item.role === 'assistant' ? 'model_output' : 'user_input', content: [{ type: 'text', text: item.content }] })), ...(messages.find(item => item.role === 'system') ? { system_instruction: messages.find(item => item.role === 'system').content } : {}) };
  }
  const response = await fetch(url, { method: 'POST', signal, headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${providerLabel(provider)} request returned ${response.status}. Check provider access, model and quota.`);
  if (!response.body) throw new Error('AI service did not provide a response body.');
  const decoder = new EventStream(provider, onDelta); const utf8 = new TextDecoder();
  for await (const chunk of response.body) { if (signal?.aborted) throw new Error('AI request stopped.'); decoder.write(utf8.decode(chunk, { stream: true })); if (decoder.text.length > 200000) throw new Error('AI response exceeded the display limit.'); }
  decoder.write(utf8.decode());
  if (requireDone && !decoder.done) throw new Error('AI response ended before completion. No edit was staged.');
  if (!decoder.text) throw new Error('AI service returned no text.');
  return decoder.text;
}

module.exports = { EventStream, SseDecoder: EventStream, parseSseChunks, extractReplacement, compatibleEndpoint, complete, listModels, recommendModel, PROVIDERS };
