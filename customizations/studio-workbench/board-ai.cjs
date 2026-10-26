'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { realpath } = require('node:fs/promises');
const { loadBoard, contextForCard, boardContext } = require('./code-board.cjs');
const { complete, compatibleEndpoint, extractReplacement } = require('./ai-mode.cjs');

function registerBoardAI(vscode, context, report) {
  let boardPanel, aiPanel, board, selected, request, proposal, explainOnOpen = false;
  let lastEditor = vscode.window.activeTextEditor;
  let conversation = [];
  let conversationRoot;
  const proposalScheme = 'studio-ai-proposal';
  const proposed = new Map();
  const proposalChanged = new vscode.EventEmitter();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(proposalScheme, {
    onDidChange: proposalChanged.event,
    provideTextDocumentContent: uri => proposed.get(uri.toString()) || '',
  }), proposalChanged, vscode.window.onDidChangeActiveTextEditor(editor => { if (editor?.document.uri.scheme === 'file') lastEditor = editor; }));

  function panel(kind) {
    const name = kind === 'board' ? 'Code Board' : 'AI Mode';
    const current = kind === 'board' ? boardPanel : aiPanel;
    if (current) { current.reveal(vscode.ViewColumn.One); return current; }
    const created = vscode.window.createWebviewPanel(`studio.${kind}`, name, vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'ui')] });
    const ui = vscode.Uri.joinPath(context.extensionUri, 'ui');
    const nonce = crypto.randomBytes(18).toString('hex');
    const html = fs.readFileSync(path.join(context.extensionPath, 'ui', `${kind}.html`), 'utf8');
    created.webview.html = html.replaceAll('{{CSP}}', created.webview.cspSource).replaceAll('{{NONCE}}', nonce)
      .replaceAll('{{STYLE}}', created.webview.asWebviewUri(vscode.Uri.joinPath(ui, `${kind}.css`)).toString())
      .replaceAll('{{SCRIPT}}', created.webview.asWebviewUri(vscode.Uri.joinPath(ui, `${kind}.js`)).toString());
    if (kind === 'board') boardPanel = created; else aiPanel = created;
    created.onDidDispose(() => { if (kind === 'board') boardPanel = undefined; else { aiPanel = undefined; request?.abort(); request = undefined; } }, null, context.subscriptions);
    created.webview.onDidReceiveMessage(message => { void receive(kind, message).catch(error => {
      void created.webview.postMessage({ type: 'error', message: error?.message || String(error) });
      report(error);
    }); }, null, context.subscriptions);
    return created;
  }

  async function refreshBoard() {
    const active = lastEditor?.document.uri;
    const folder = active ? vscode.workspace.getWorkspaceFolder(active) || vscode.workspace.workspaceFolders?.[0] : vscode.workspace.workspaceFolders?.[0];
    const next = await loadBoard(vscode, folder);
    if (board?.root && board.root !== next.root) { conversation = []; selected = undefined; proposal = undefined; }
    board = next;
    selected = selected && [...board.files, ...board.areas, ...board.changes, ...board.features, ...board.commits].find(card => card.id === selected.id);
    await boardPanel?.webview.postMessage({ type: 'board', board });
  }

  async function showBoard() { panel('board'); await refreshBoard(); return { opened: true, files: board.totalFiles }; }

  async function showAI(card, explain = false) {
    if (card) selected = card;
    explainOnOpen = explain;
    const view = panel('ai');
    await view.webview.postMessage({ type: 'context', label: selected ? `${selected.kind}: ${selected.path || selected.title}` : lastEditor ? vscode.workspace.asRelativePath(lastEditor.document.uri) : '', explain });
    await sendSettings();
    return { opened: true };
  }

  async function sendSettings() {
    if (!aiPanel) return;
    await aiPanel.webview.postMessage({ type: 'settings', endpoint: context.globalState.get('studio.aiEndpoint', 'https://api.openai.com/v1'),
      model: context.globalState.get('studio.aiModel', ''), hasKey: !!await context.secrets.get('studio.aiKey') });
  }

  async function sourceContext() {
    if (selected && board) return contextForCard(vscode, board, selected);
    const document = lastEditor?.document;
    if (!document || document.uri.scheme !== 'file') return '';
    return boardContext({ kind: 'file', path: document.uri.fsPath, title: path.basename(document.uri.fsPath) }, document.getText().slice(0, 50000));
  }

  async function candidateFile() {
    const file = selected ? ['file', 'change'].includes(selected.kind) && board ? path.resolve(board.root, selected.path) : undefined : lastEditor?.document.uri.fsPath;
    if (!file) return;
    if (selected && board && !file.startsWith(path.resolve(board.root) + path.sep)) throw new Error('Selected file is outside the project.');
    if (selected && board) {
      const [realRoot, realFile] = await Promise.all([realpath(board.root), realpath(file)]);
      if (!realFile.startsWith(realRoot + path.sep)) throw new Error('Selected file link points outside the project.');
    }
    const uri = vscode.Uri.file(file);
    const document = await vscode.workspace.openTextDocument(uri);
    return { uri, original: document.getText(), hash: crypto.createHash('sha256').update(document.getText()).digest('hex') };
  }

  async function ask(message) {
    if (request) throw new Error('An AI request is already running.');
    const mode = ['ask', 'explain', 'plan', 'edit'].includes(message.mode) ? message.mode : 'ask';
    const prompt = String(message.prompt || '').trim();
    if (!prompt) throw new Error('Enter a question or instruction.');
    const endpoint = context.globalState.get('studio.aiEndpoint', 'https://api.openai.com/v1');
    const model = context.globalState.get('studio.aiModel', '');
    if (!model) throw new Error('Connect a model in AI Mode settings first.');
    const currentRoot = selected && board ? board.root : lastEditor ? vscode.workspace.getWorkspaceFolder(lastEditor.document.uri)?.uri.fsPath : undefined;
    if (conversationRoot !== currentRoot) { conversation = []; conversationRoot = currentRoot; }
    proposal = undefined;
    const file = mode === 'edit' ? await candidateFile() : undefined;
    if (mode === 'edit' && !file) throw new Error('Select a file on the Code Board or open one in the editor before using Edit file.');
    if (file && file.original.length > 50000) throw new Error('This file is too large for a safe whole-file AI edit (50,000 characters).');
    const source = file ? `Selected file: ${vscode.workspace.asRelativePath(file.uri)}\nComplete current contents:\n${file.original}` : await sourceContext();
    const modeInstruction = {
      ask: 'Answer the question about the supplied project context. State uncertainty when context is incomplete.',
      explain: 'Explain purpose, behavior, key dependencies and risks using the supplied context. Identify evidence rather than guessing.',
      plan: 'Give a practical step-by-step plan grounded in the supplied context. Do not claim to have changed files.',
      edit: 'Return the complete replacement contents for the selected single file in one fenced code block. Do not include commentary outside that block. Preserve unrelated behavior.',
    }[mode];
    const messages = [{ role: 'system', content: `You assist with code in studio-n-code. ${modeInstruction}` },
      ...conversation.slice(-8), { role: 'user', content: `Context (may be truncated):\n${source || '[No file selected]'}\n\nRequest: ${prompt}` }];
    const controller = new AbortController(); request = controller;
    let answer = '';
    try {
      answer = await complete({ endpoint, model, key: await context.secrets.get('studio.aiKey') || '', messages,
        signal: controller.signal, requireDone: mode === 'edit', onDelta: text => { void aiPanel?.webview.postMessage({ type: 'delta', text }); } });
      if (mode === 'edit') {
        proposal = { ...file, replacement: extractReplacement(answer) };
      } else proposal = undefined;
      conversation.push({ role: 'user', content: `Request: ${prompt}\nContext: ${source.slice(0, 12000)}` }, { role: 'assistant', content: answer.slice(0, 30000) });
      await aiPanel?.webview.postMessage({ type: 'done', edit: !!proposal, message: proposal ? 'Edit ready. Preview the diff before applying.' : 'Completed.' });
      if (proposal) await previewEdit();
      return { mode, response: answer, proposed: !!proposal };
    } catch (error) {
      await aiPanel?.webview.postMessage(controller.signal.aborted ? { type: 'stopped' } : { type: 'error', message: error?.message || String(error) });
      return { failed: true, message: error?.message || String(error) };
    } finally { if (request === controller) request = undefined; }
  }

  async function previewEdit() {
    if (!proposal) throw new Error('No edit is ready to preview.');
    const proposedUri = vscode.Uri.from({ scheme: proposalScheme, path: proposal.uri.path });
    proposed.set(proposedUri.toString(), proposal.replacement);
    proposalChanged.fire(proposedUri);
    await vscode.commands.executeCommand('vscode.diff', proposal.uri, proposedUri, `${path.basename(proposal.uri.fsPath)} · AI proposed edit`);
  }

  async function applyEdit() {
    if (!proposal) throw new Error('No edit is ready to apply.');
    const document = await vscode.workspace.openTextDocument(proposal.uri);
    if (crypto.createHash('sha256').update(document.getText()).digest('hex') !== proposal.hash) throw new Error('The file changed after the AI proposal. Request a new edit.');
    const edit = new vscode.WorkspaceEdit();
    edit.replace(proposal.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), proposal.replacement);
    if (!await vscode.workspace.applyEdit(edit)) throw new Error('Could not apply the edit.');
    await vscode.window.showTextDocument(proposal.uri);
    proposal = undefined;
    await aiPanel?.webview.postMessage({ type: 'applied' });
  }

  async function configure({ endpoint, model, key }) {
    const verified = compatibleEndpoint(endpoint).replace(/\/chat\/completions$/, '');
    const chosen = String(model || '').trim();
    if (!chosen) throw new Error('Enter a model ID.');
    await context.globalState.update('studio.aiEndpoint', verified);
    await context.globalState.update('studio.aiModel', chosen);
    if (key) await context.secrets.store('studio.aiKey', String(key));
    await sendSettings();
  }

  async function receive(kind, message) {
    if (!message || typeof message.type !== 'string') return;
    if (kind === 'board') {
      if (message.type === 'ready' || message.type === 'refresh') return refreshBoard();
      if (message.type === 'ai') return showAI();
      const card = [...(board?.files || []), ...(board?.areas || []), ...(board?.changes || []), ...(board?.features || []), ...(board?.commits || [])].find(item => item.id === message.id);
      if (!card) return;
      if (message.type === 'explain') return showAI(card, true);
      if (message.type === 'open') {
        if (card.kind === 'commit') return vscode.commands.executeCommand('studio.git');
        if (['file', 'change'].includes(card.kind)) {
          const file = path.resolve(board.root, card.path);
          if (!file.startsWith(path.resolve(board.root) + path.sep)) throw new Error('File is outside the project.');
          return vscode.window.showTextDocument(vscode.Uri.file(file));
        }
      }
      return;
    }
    if (message.type === 'ready') { await sendSettings(); await aiPanel?.webview.postMessage({ type: 'context', label: selected ? `${selected.kind}: ${selected.path || selected.title}` : lastEditor ? vscode.workspace.asRelativePath(lastEditor.document.uri) : '', explain: explainOnOpen }); }
    if (message.type === 'useActiveFile') { selected = undefined; proposal = undefined; explainOnOpen = false; await aiPanel?.webview.postMessage({ type: 'context', label: lastEditor ? vscode.workspace.asRelativePath(lastEditor.document.uri) : '' }); return; }
    if (message.type === 'board') return showBoard();
    if (message.type === 'saveSettings') {
      return configure(message);
    }
    if (message.type === 'clearKey') { await context.secrets.delete('studio.aiKey'); return sendSettings(); }
    if (message.type === 'stop') { request?.abort(); return; }
    if (message.type === 'clear') { request?.abort(); conversation = []; proposal = undefined; await aiPanel?.webview.postMessage({ type: 'cleared' }); return; }
    if (message.type === 'ask') return ask(message);
    if (message.type === 'previewEdit') return previewEdit();
    if (message.type === 'applyEdit') return applyEdit();
  }

  return { showBoard, showAI, refreshBoard, ask, configure, applyEdit };
}

module.exports = { registerBoardAI };
