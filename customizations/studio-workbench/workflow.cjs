'use strict';

function searchItems(query, files, actions) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = text => words.every(word => text.toLowerCase().includes(word));
  return [
    ...files.filter(file => matches(file.label)).map(file => ({ label: `$(file-code) ${file.label}`, uri: file.uri, description: 'File' })),
    ...actions.filter(action => matches(action.title)).map(action => ({ label: `$(symbol-method) ${action.title}`, command: action.id, description: 'Action' })),
  ];
}

async function runAction(api, item) {
  if (item?.uri) return api.window.showTextDocument(item.uri, item.range ? { selection: item.range } : undefined);
  if (item?.command) return api.commands.executeCommand(item.command);
}

async function initializeLayout(api, state) {
  if (state.get('studio.layout.newui.initialized')) return;
  await api.commands.executeCommand('workbench.action.closeAuxiliaryBar');
  await api.commands.executeCommand('workbench.action.positionPanelBottom');
  await api.commands.executeCommand('workbench.view.explorer');
  await api.commands.executeCommand('studio.gitLog.focus');
  await api.commands.executeCommand('workbench.action.focusActiveEditorGroup');
  await state.update('studio.layout.newui.initialized', true);
}

module.exports = { searchItems, runAction, initializeLayout };
