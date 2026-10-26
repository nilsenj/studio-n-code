'use strict';
const vscode = require('vscode');
const actions = require('./commands.json');
const { searchItems, runAction, initializeLayout } = require('./workflow.cjs');
const { registerGitTools } = require('./git-tools.cjs');

function activate(context) {
  const output = vscode.window.createOutputChannel('studio-n-code');
  context.subscriptions.push(output);
  const report = error => {
    output.appendLine(String(error?.stack || error));
    vscode.window.showErrorMessage(`studio-n-code: ${error.message || error}`);
  };

  async function searchEverywhere(mode = 'all') {
    const picker = vscode.window.createQuickPick();
    picker.title = mode === 'classes' ? 'Go to Class' : 'Search Everywhere';
    picker.placeholder = mode === 'classes' ? 'Search classes, interfaces, and types' : 'Search files, symbols, and actions';
    picker.matchOnDescription = true;
    let generation = 0;
    let timer;
    let disposed = false;
    let cancellation;
    const update = async () => {
      const current = ++generation;
      cancellation?.cancel();
      cancellation?.dispose();
      cancellation = new vscode.CancellationTokenSource();
      picker.busy = true;
      try {
        const query = picker.value.trim();
        const escaped = query.replace(/[\[\]{}*?\\]/g, '?').split(/\s+/).join('*');
        const [uris, symbols] = await Promise.all([
          query && mode !== 'classes' ? vscode.workspace.findFiles(`**/*${escaped}*`, '**/{node_modules,.git,vendor,dist,out}/**', 150, cancellation.token) : [],
          query ? vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', query) : [],
        ]);
        if (disposed || current !== generation) return;
        const files = uris.map(uri => ({ label: vscode.workspace.asRelativePath(uri), uri }));
        const symbolItems = (symbols || []).filter(symbol => mode !== 'classes' || [vscode.SymbolKind.Class, vscode.SymbolKind.Interface, vscode.SymbolKind.Enum, vscode.SymbolKind.Struct].includes(symbol.kind)).slice(0, 80)
          .map(symbol => ({ label: `$(symbol-class) ${symbol.name}`, description: vscode.workspace.asRelativePath(symbol.location.uri), uri: symbol.location.uri, range: symbol.location.range }));
        picker.items = [...searchItems(query, files, mode === 'classes' ? [] : actions), ...symbolItems];
      } catch (error) {
        if (!disposed && current === generation) report(error);
      } finally {
        if (!disposed && current === generation) picker.busy = false;
      }
    };
    const subscriptions = [
      picker.onDidChangeValue(() => { clearTimeout(timer); timer = setTimeout(update, 100); }),
      picker.onDidAccept(() => {
        const item = picker.selectedItems[0];
        if (!item) return;
        picker.hide();
        void runAction(vscode, item).catch(report);
      }),
      picker.onDidHide(() => {
        disposed = true;
        clearTimeout(timer);
        cancellation?.cancel();
        cancellation?.dispose();
        subscriptions.forEach(subscription => subscription.dispose());
        picker.dispose();
      }),
    ];
    picker.show();
    await update();
  }

  const gitTools = registerGitTools(vscode, context, report);
  let runConfiguration = context.workspaceState.get('studio.runConfiguration');
  async function chooseRunConfiguration() {
    const configurations = vscode.workspace.getConfiguration('launch').get('configurations', []);
    const choice = await vscode.window.showQuickPick([
      { label: 'Current File', current: true },
      ...configurations.map(configuration => ({ label: configuration.name, configuration })),
      { label: 'Edit Configurations…', edit: true },
    ], { title: 'Run/Debug Configurations', placeHolder: 'Select a configuration' });
    if (!choice) return;
    if (choice.edit) return vscode.commands.executeCommand('workbench.action.debug.configure');
    runConfiguration = choice.configuration?.name;
    await context.workspaceState.update('studio.runConfiguration', runConfiguration);
    await vscode.commands.executeCommand('studio.nativeHeaderState', { run: runConfiguration || 'Current File' });
  }
  async function runFile(noDebug) {
    const editor = vscode.window.activeTextEditor;
    const folder = editor ? vscode.workspace.getWorkspaceFolder(editor.document.uri) : vscode.workspace.workspaceFolders?.[0];
    if (runConfiguration) return vscode.debug.startDebugging(folder, runConfiguration, { noDebug });
    if (editor && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(editor.document.languageId)) {
      if (editor.document.isDirty && !await editor.document.save()) return;
      return vscode.debug.startDebugging(folder, { type: 'pwa-node', request: 'launch', name: editor.document.fileName.split(/[\\/]/).at(-1), program: editor.document.uri.fsPath, console: 'integratedTerminal' }, { noDebug });
    }
    return vscode.commands.executeCommand(noDebug ? 'workbench.action.debug.run' : 'workbench.action.debug.start');
  }
  async function projects() {
    const selected = await vscode.window.showQuickPick([
      { label: '$(folder-opened) Open Project…', target: 'workbench.action.files.openFolder' },
      { label: '$(history) Recent Projects…', target: 'workbench.action.openRecent' },
      { label: '$(window) New Window', target: 'workbench.action.newWindow' },
      { label: '$(close) Close Project', target: 'workbench.action.closeFolder' },
    ], { title: vscode.workspace.name || 'Projects' });
    if (selected) await vscode.commands.executeCommand(selected.target);
  }
  async function toolWindows() {
    const selected = await vscode.window.showQuickPick(actions.filter(action => /Tool Window/.test(action.title)).map(action => ({ label: action.title.replace(' Tool Window', ''), command: action.id })), { title: 'Tool Windows' });
    if (selected) await vscode.commands.executeCommand(selected.command);
  }
  const handlers = { search: searchEverywhere, classes: () => searchEverywhere('classes'), branches: gitTools.vcsMenu, projects, runConfigurations: chooseRunConfiguration, run: () => runFile(true), debug: () => runFile(false), toolWindows };
  for (const action of actions) {
    context.subscriptions.push(vscode.commands.registerCommand(action.id, () =>
      (action.handler ? handlers[action.handler]() : vscode.commands.executeCommand(action.target)).catch(report)
    ));
  }
  context.subscriptions.push(vscode.commands.registerCommand('studio.restoreLayout', async () => {
    await context.globalState.update('studio.layout.newui.initialized', false);
    await initializeLayout(vscode, context.globalState);
  }));
  void initializeLayout(vscode, context.globalState).catch(report);
  void vscode.commands.executeCommand('studio.nativeHeaderState', { run: runConfiguration || 'Current File' }).then(undefined, () => {});
  return { gitTools };
}

module.exports = { activate };
