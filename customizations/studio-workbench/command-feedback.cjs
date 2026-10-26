'use strict';

function summarizeResult(action, value, context = {}) {
  if (value === false) return { phase: 'cancelled', message: `${action.title} was cancelled or did not start.` };
  if (['studio.format', 'studio.indent'].includes(action.id) && Number.isInteger(context.beforeVersion) && context.beforeVersion === context.afterVersion) {
    return { phase: 'unchanged', message: action.id === 'studio.format' ? 'No formatting changes were needed or applied.' : 'No indentation changes were needed or applied.' };
  }
  if (Number.isInteger(context.beforeVersion) && context.afterVersion > context.beforeVersion) return { phase: 'success', message: `${action.title} applied.` };
  if (value === undefined) return { phase: 'dispatched', message: `${action.title} requested.` };
  return { phase: 'success', message: `${action.title} completed.` };
}

async function runCommand(action, execute, adapter = {}) {
  const emit = event => adapter.emit?.({ id: action.id, title: action.title, key: action.key, ...event });
  try {
    emit({ phase: 'running', message: `${action.title}…` });
    const reason = await adapter.check?.(action);
    if (reason) { const outcome = { phase: 'unavailable', message: reason }; emit(outcome); return outcome; }
    const beforeVersion = adapter.capture?.();
    const value = await execute();
    const outcome = summarizeResult(action, value, { beforeVersion, afterVersion: adapter.capture?.() });
    emit(outcome);
    return { ...outcome, value };
  } catch (error) {
    const outcome = { phase: 'error', message: error?.message || String(error) };
    emit(outcome);
    return outcome;
  }
}

function createFeedback(vscode, context, output) {
  const item = vscode.window.createStatusBarItem('studio.commandFeedback', vscode.StatusBarAlignment.Left, 110);
  item.name = 'Command Feedback';
  context.subscriptions.push(item);
  let hide;
  context.subscriptions.push({ dispose: () => clearTimeout(hide) });
  const providerKeys = {
    'studio.format': ['format', 'formatter'], 'studio.rename': ['rename', 'rename provider'],
    'studio.goToDefinition': ['definition', 'definition provider'], 'studio.findUsages': ['references', 'reference provider'],
  };
  const mutating = new Set(['studio.format', 'studio.indent', 'studio.rename', 'studio.duplicate', 'studio.deleteLine', 'studio.joinLines', 'studio.organizeImports', 'studio.lineComment', 'studio.blockComment', 'studio.moveLineUp', 'studio.moveLineDown', 'studio.replace']);
  return {
    capture: () => vscode.window.activeTextEditor?.document.version,
    check: async action => {
      const editorAction = action.target?.startsWith('editor.') || mutating.has(action.id);
      const editor = vscode.window.activeTextEditor;
      if (editorAction && !editor) return `Open a code file before using ${action.title}.`;
      if (!editorAction) return;
      const capabilities = await vscode.commands.executeCommand('studio.nativeCapabilities').then(value => value || {}, () => ({}));
      if (mutating.has(action.id) && capabilities.readonly === true) return 'This editor is read-only.';
      const requirement = providerKeys[action.id];
      if (requirement && capabilities[requirement[0]] === false) return `No ${requirement[1]} is available for ${editor.document.languageId}. Configure compatible language tooling and try again.`;
    },
    emit: event => {
      output.appendLine(`[${event.phase}] ${event.title}: ${event.message}`);
      if (event.phase === 'error') void vscode.window.showErrorMessage(`${event.title}: ${event.message}`);
      if (!vscode.workspace.getConfiguration('studio').get('commandFeedback', true)) return;
      clearTimeout(hide);
      const icon = { running: 'loading~spin', success: 'check', unchanged: 'info', dispatched: 'info', cancelled: 'circle-slash', unavailable: 'warning', error: 'error' }[event.phase] || 'info';
      item.text = `$(${icon}) ${event.phase === 'running' ? event.title : event.message}`;
      item.tooltip = `${event.title}${event.key ? ` · ${event.key}` : ''}\n${event.message}`;
      item.show();
      if (event.phase !== 'running') hide = setTimeout(() => item.hide(), event.phase === 'error' || event.phase === 'unavailable' ? 8000 : 4000);
      void vscode.commands.executeCommand('studio.nativeActionFeedback', event).then(undefined, () => {});
    },
  };
}

module.exports = { runCommand, summarizeResult, createFeedback };
