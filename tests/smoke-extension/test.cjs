const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const cp = require('node:child_process');
const vscode = require('vscode');
const actions = require('../../customizations/studio-workbench/commands.json');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, timeout = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await fn();
    if (result) return result;
    await pause(250);
  }
  throw new Error(`Timed out: ${label}`);
}

async function run() {
  const results = [];
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const report = path.resolve(__dirname, '../../artifacts/smoke-results.json');
  async function check(name, action) {
    try { await action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error.stack || error) }); }
  }
  await check('Studio bundle activates and all mapped commands exist', async () => {
    const extension = vscode.extensions.getExtension('studio-n-code.studio-workbench');
    assert.ok(extension, 'Studio bundled extension is missing');
    await extension.activate();
    const commands = await vscode.commands.getCommands(true);
    for (const action of actions) {
      assert.ok(commands.includes(action.id), `Missing Studio action ${action.id}`);
      if (action.target) assert.ok(commands.includes(action.target), `Missing target ${action.target}`);
    }
    assert.equal(vscode.workspace.getConfiguration('workbench').get('colorTheme'), 'Studio Dark');
  });
  await check('Real file open, edit, save and reload', async () => {
    const uri = vscode.Uri.file(path.join(root, 'notes.txt'));
    await fs.writeFile(uri.fsPath, 'before\n');
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    assert.ok(await editor.edit(edit => edit.replace(new vscode.Range(0, 0, 1, 0), 'after\n')));
    assert.ok(await document.save());
    assert.equal(await fs.readFile(uri.fsPath, 'utf8'), 'after\n');
  });
  await check('TypeScript definitions, references and rename providers', async () => {
    const uri = vscode.Uri.file(path.join(root, 'src/main.ts'));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    const definition = await until(async () => {
      const definitions = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', uri, new vscode.Position(1, 15));
      return definitions?.length && definitions;
    }, 'TypeScript definitions');
    assert.ok(definition.length);
    const references = await vscode.commands.executeCommand('vscode.executeReferenceProvider', uri, new vscode.Position(0, 16));
    assert.ok(references.length >= 2);
    const rename = await vscode.commands.executeCommand('vscode.executeDocumentRenameProvider', uri, new vscode.Position(0, 16), 'welcome');
    assert.ok(rename.size > 0);
  });
  await check('Git discovers changes, opens diff, stages and unstages', async () => {
    const extension = vscode.extensions.getExtension('vscode.git');
    await extension.activate();
    const git = extension.exports.getAPI(1);
    const repository = await until(() => git.repositories[0], 'Git repository discovery');
    const changed = vscode.Uri.file(path.join(root, 'src/main.ts'));
    await fs.appendFile(changed.fsPath, '\n// changed in desktop smoke test\n');
    await repository.status();
    assert.ok(repository.state.workingTreeChanges.some(change => change.uri.fsPath === changed.fsPath));
    await vscode.commands.executeCommand('git.openChange', changed);
    await repository.add([changed.fsPath]);
    await repository.status();
    assert.ok(repository.state.indexChanges.some(change => change.uri.fsPath === changed.fsPath));
    await repository.revert([changed.fsPath]);
    await repository.status();
    assert.ok(!repository.state.indexChanges.some(change => change.uri.fsPath === changed.fsPath));
    assert.ok(repository.state.workingTreeChanges.some(change => change.uri.fsPath === changed.fsPath));
  });
  await check('Integrated terminal executes a real shell command', async () => {
    const marker = path.join(root, 'terminal-result.txt');
    const terminal = vscode.window.createTerminal({ name: 'Studio Smoke', shellPath: 'C:\\Windows\\System32\\cmd.exe', cwd: root });
    try {
      terminal.show();
      const pid = await terminal.processId;
      assert.ok(pid);
      terminal.sendText(`echo studio-terminal-ok>"${marker}"`);
      await until(async () => {
        try { return (await fs.readFile(marker, 'utf8')).includes('studio-terminal-ok'); } catch { return false; }
      }, 'terminal marker');
    } finally { terminal.dispose(); }
  });
  await check('PHP syntax and language bundle is present', async () => {
    assert.ok(vscode.extensions.getExtension('vscode.php-language-features'));
    const document = await vscode.workspace.openTextDocument(path.join(root, 'sample.php'));
    assert.equal(document.languageId, 'php');
  });
  await check('Node debugging launches and executes a real program', async () => {
    const started = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
      name: 'Studio Smoke Debug', type: 'pwa-node', request: 'launch',
      program: path.join(root, 'run.cjs'), console: 'internalConsole',
    });
    assert.equal(started, true);
    await until(async () => {
      try { return (await fs.readFile(path.join(root, 'debug-result.txt'), 'utf8')) === 'studio-debug-ok'; }
      catch { return false; }
    }, 'Node debug output');
    await vscode.debug.stopDebugging();
  });
  await check('Dedicated Commit and Git Log views open and expose real history', async () => {
    await vscode.commands.executeCommand('studio.commitView.focus');
    await vscode.commands.executeCommand('studio.gitLog.focus');
    const studio = vscode.extensions.getExtension('studio-n-code.studio-workbench');
    const snapshot = await studio.exports.gitTools.snapshot();
    assert.equal(snapshot.branch, 'main');
    assert.ok(snapshot.commits.some(commit => commit.message.startsWith('Initial fixture')));
    assert.ok(snapshot.branches.some(branch => branch.name === 'main'));
    assert.ok(snapshot.changes.some(change => change.relativePath === 'src/main.ts'));
    const rootCommit = await studio.exports.gitTools.commitDetails(snapshot.commits.at(-1).hash);
    assert.deepEqual(rootCommit.files.map(file => file.relativePath).sort(), ['README.md', 'run.cjs', 'sample.php', 'src/main.ts', 'tsconfig.json'].sort());
  });
  await check('Commit checklist commits only selected files and preserves unselected changes', async () => {
    const git = vscode.extensions.getExtension('vscode.git').exports.getAPI(1);
    const repo = git.repositories[0];
    const selected = path.join(root, 'src/main.ts');
    const unselected = path.join(root, 'notes.txt');
    await repo.status();
    await vscode.commands.executeCommand('studio.commitSelection', { paths: [selected], message: 'Commit selected file from Studio tool window', amend: false });
    await repo.status();
    const log = await repo.log({ maxEntries: 1 });
    assert.equal(log[0].message.trim(), 'Commit selected file from Studio tool window');
    const studio = vscode.extensions.getExtension('studio-n-code.studio-workbench');
    const details = await studio.exports.gitTools.commitDetails(log[0].hash);
    assert.deepEqual(details.files.map(change => change.path), [selected]);
    assert.ok(repo.state.workingTreeChanges.some(change => change.uri.fsPath === unselected));
  });
  await fs.mkdir(path.dirname(report), { recursive: true });
  await fs.writeFile(report, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  const failed = results.filter(result => !result.passed);
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `\n${result.error}` : ''}`);
  if (failed.length) throw new Error(`${failed.length} desktop smoke checks failed. See ${report}`);
}
module.exports = { run };
