'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { changesFromState, validateCommitSelection, graphRows } = require('./git-model.cjs');

function registerGitTools(vscode, context, report) {
  let git;
  let chosenRoot;
  let ref;
  let lastSnapshot;
  let operation = false;
  let publication = 0;
  const views = new Set();
  const subscriptions = new Map();
  const emptyTrees = new Map();
  const empty = vscode.Uri.parse('studio-empty:/empty');
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('studio-empty', { provideTextDocumentContent: () => '' }));

  async function api() {
    if (!git) {
      const extension = vscode.extensions.getExtension('vscode.git');
      if (!extension) throw new Error('The bundled Git extension is unavailable.');
      await extension.activate();
      git = extension.exports.getAPI(1);
      context.subscriptions.push(git.onDidOpenRepository(watch), git.onDidCloseRepository(repository => {
        subscriptions.get(repository)?.dispose(); subscriptions.delete(repository); void refresh();
      }));
      git.repositories.forEach(watch);
    }
    return git;
  }

  function watch(repository) {
    if (subscriptions.has(repository)) return;
    const listener = repository.state.onDidChange(() => { void refresh(); });
    subscriptions.set(repository, listener);
    context.subscriptions.push(listener);
    void refresh();
  }

  async function repository() {
    const current = await api();
    return current.repositories.find(repo => repo.rootUri.toString() === chosenRoot)
      || (vscode.window.activeTextEditor && current.getRepository(vscode.window.activeTextEditor.document.uri))
      || current.repositories[0];
  }

  let refreshTimer;
  async function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void publish().catch(report); }, 80);
  }
  context.subscriptions.push({ dispose: () => clearTimeout(refreshTimer) });

  async function publish() {
    const currentPublication = ++publication;
    const repo = await repository();
    if (currentPublication !== publication) return lastSnapshot;
    const repositories = git.repositories.map(item => ({ id: item.rootUri.toString(), name: path.basename(item.rootUri.fsPath) }));
    const head = repo?.state.HEAD;
    void vscode.commands.executeCommand('studio.nativeHeaderState', { branch: repo ? head?.name || (head?.commit ? head.commit.slice(0, 8) : 'No commits') : 'No VCS', project: vscode.workspace.name || 'studio-n-code' }).then(undefined, () => {});
    if (!repo) {
      lastSnapshot = { type: 'snapshot', repositories, changes: [], commits: [], branches: [], noRepository: true };
    } else {
      const [commits, branches] = await Promise.all([
        head?.commit ? repo.log({ maxEntries: 200, ...(ref ? { refNames: [ref] } : {}) }) : [],
        repo.getBranches({ remote: true, sort: 'alphabetically' }).catch(() => []),
      ]);
      if (currentPublication !== publication) return lastSnapshot;
      lastSnapshot = {
        type: 'snapshot', repositories, repository: repo.rootUri.toString(), name: path.basename(repo.rootUri.fsPath),
        branch: head?.name || 'Detached HEAD', ahead: head?.ahead || 0, behind: head?.behind || 0,
        ref: ref || '', changes: changesFromState(repo.state, repo.rootUri.fsPath),
        commits: graphRows(commits.map(commit => ({ ...commit, authorDate: commit.authorDate?.toISOString(), commitDate: commit.commitDate?.toISOString() }))),
        branches: branches.map(branch => ({ name: branch.name, type: branch.type, commit: branch.commit })),
      };
    }
    for (const view of views) void view.webview.postMessage(lastSnapshot);
    return lastSnapshot;
  }

  async function commitSelection(selection) {
    if (operation) throw new Error('Another Git operation is in progress.');
    const repo = await repository();
    if (!repo) throw new Error('Open a Git repository first.');
    operation = true;
    try {
      await repo.status();
      const files = changesFromState(repo.state, repo.rootUri.fsPath);
      const selected = validateCommitSelection(files, selection?.paths, selection?.message);
      await repo.add(selected);
      await repo.commit(selection.message.trim(), { all: false, amend: selection.amend === true, requireUserConfig: true, postCommitCommand: null });
      for (const view of views) void view.webview.postMessage({ type: 'committed' });
      await repo.status();
      await refresh();
    } finally { operation = false; }
  }

  async function commitDetails(hash) {
    const repo = await repository();
    if (!repo || !/^[0-9a-f]{40,64}$/i.test(hash)) throw new Error('Invalid commit.');
    const commit = await repo.getCommit(hash);
    let parent = commit.parents[0];
    if (!parent) {
      const root = repo.rootUri.fsPath;
      if (!emptyTrees.has(root)) emptyTrees.set(root, new Promise((resolve, reject) => {
        const child = execFile(git.git.path, ['-C', root, 'hash-object', '-t', 'tree', '--stdin'], { windowsHide: true, encoding: 'utf8' }, (error, stdout) => {
          if (error) { emptyTrees.delete(root); reject(error); }
          else if (/^[0-9a-f]{40,64}$/.test(stdout.trim())) resolve(stdout.trim());
          else { emptyTrees.delete(root); reject(new Error('Unable to determine the empty Git tree.')); }
        });
        child.stdin.end();
      }));
      parent = await emptyTrees.get(root);
    }
    // This API forwards a complete revision range unchanged. Use two dots:
    // the two-ref API inserts three dots, which cannot accept an empty tree.
    const changes = await repo.diffBetweenWithStats2(`${parent}..${hash}`);
    return { type: 'commitDetails', hash, message: commit.message, author: commit.authorName,
      files: changes.map(change => ({ path: change.uri.fsPath, originalPath: change.originalUri.fsPath,
        relativePath: path.relative(repo.rootUri.fsPath, change.uri.fsPath).replaceAll('\\', '/'),
        status: change.status })), parents: commit.parents };
  }

  async function receive(message, view) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'ready') { if (lastSnapshot) await view.webview.postMessage(lastSnapshot); await refresh(); return; }
    const repo = await repository();
    if (message.type === 'repository') {
      if (git.repositories.some(item => item.rootUri.toString() === message.id)) { chosenRoot = message.id; ref = undefined; }
      await refresh(); return;
    }
    if (!repo) return;
    switch (message.type) {
      case 'refresh': await repo.status(); await refresh(); break;
      case 'openLog': await vscode.commands.executeCommand('studio.gitLog.focus'); break;
      case 'commit': await commitSelection(message); break;
      case 'openChange': {
        const changes = [...repo.state.indexChanges, ...repo.state.workingTreeChanges, ...(repo.state.untrackedChanges || []), ...repo.state.mergeChanges];
        const change = changes.find(item => item.uri.fsPath === message.path);
        if (change) await vscode.commands.executeCommand('git.openChange', change.uri);
        break;
      }
      case 'selectCommit':
        if (lastSnapshot?.commits.some(commit => commit.hash === message.hash)) await view.webview.postMessage(await commitDetails(message.hash));
        break;
      case 'openCommitFile': {
        if (!lastSnapshot?.commits.some(commit => commit.hash === message.hash)) break;
        const commit = await repo.getCommit(message.hash);
        const details = await commitDetails(message.hash);
        const change = details.files.find(item => item.path === message.path);
        if (!change) break;
        const before = commit.parents.length && ![1, 7].includes(change.status) ? git.toGitUri(vscode.Uri.file(change.originalPath), commit.parents[0]) : empty;
        const after = [2, 6].includes(change.status) ? empty : git.toGitUri(vscode.Uri.file(change.path), message.hash);
        await vscode.commands.executeCommand('vscode.diff', before, after, `${path.basename(message.path)} (${message.hash.slice(0, 8)})`);
        break;
      }
      case 'filterBranch':
        if (!message.ref || lastSnapshot?.branches.some(branch => branch.name === message.ref)) ref = message.ref || undefined;
        await refresh(); break;
      case 'branches': await vcsMenu(); break;
      case 'fetch': await repo.fetch(); await refresh(); break;
      case 'pull': await vscode.commands.executeCommand('git.pull', repo.rootUri); break;
      case 'push': await vscode.commands.executeCommand('git.push', repo.rootUri); break;
    }
  }

  function provider(kind) {
    return { resolveWebviewView(view) {
      const assets = vscode.Uri.joinPath(context.extensionUri, 'ui');
      const nonce = crypto.randomBytes(24).toString('hex');
      view.webview.options = { enableScripts: true, localResourceRoots: [assets] };
      const html = fs.readFileSync(path.join(context.extensionPath, 'ui/git.html'), 'utf8');
      view.webview.html = html.replaceAll('{{CSP}}', view.webview.cspSource).replaceAll('{{NONCE}}', nonce)
        .replaceAll('{{STYLE}}', view.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'git.css')).toString())
        .replaceAll('{{SCRIPT}}', view.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'git.js')).toString())
        .replaceAll('{{KIND}}', kind);
      views.add(view);
      context.subscriptions.push(view.onDidDispose(() => views.delete(view)), view.onDidChangeVisibility(() => { if (view.visible) void refresh(); }),
        view.webview.onDidReceiveMessage(message => { void receive(message, view).catch(error => {
          void view.webview.postMessage({ type: 'error', message: error.message || String(error) });
        }); }));
      void refresh();
    } };
  }

  async function vcsMenu() {
    const repo = await repository();
    if (!repo) return vscode.commands.executeCommand('git.init');
    const branches = await repo.getBranches({ remote: true });
    const entries = [
      { label: '$(check) Commit…', command: 'studio.commitView.focus' },
      { label: '$(repo-push) Push…', command: 'git.push' },
      { label: '$(repo-pull) Update Project…', command: 'git.pull' },
      { label: '$(git-branch) New Branch…', command: 'git.branch' },
      { label: '$(history) Show Git Log', command: 'studio.gitLog.focus' },
      { label: 'Branches', kind: vscode.QuickPickItemKind.Separator },
      ...branches.map(branch => ({ label: `$(git-branch) ${branch.name}`, description: branch.name === repo.state.HEAD?.name ? 'Current' : branch.type === 1 ? 'Remote' : 'Local', branch: branch.name })),
    ];
    const choice = await vscode.window.showQuickPick(entries, { title: repo.state.HEAD?.name || 'Git', placeHolder: 'Branches and VCS actions' });
    if (choice?.command) return vscode.commands.executeCommand(choice.command, repo.rootUri);
    if (choice?.branch && choice.branch !== repo.state.HEAD?.name) { await repo.checkout(choice.branch); await refresh(); }
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('studio.commitView', provider('commit'), { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.window.registerWebviewViewProvider('studio.gitLog', provider('log'), { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('studio.commitSelection', commitSelection),
    vscode.commands.registerCommand('studio.gitRefresh', async () => { const repo = await repository(); if (repo) await repo.status(); await refresh(); }),
  );
  void api().then(refresh, report);
  return { vcsMenu, refresh, snapshot: publish, commitDetails };
}

module.exports = { registerGitTools };
