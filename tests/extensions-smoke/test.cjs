const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');
exports.run = async () => {
  const results = [];
  for (const id of ['esbenp.prettier-vscode', 'EditorConfig.EditorConfig', 'dracula-theme.theme-dracula']) {
    const extension = vscode.extensions.getExtension(id);
    assert.ok(extension, `${id} did not install`);
    if (extension.packageJSON.main) await extension.activate();
    results.push({ id, version: extension.packageJSON.version, installed: true, activated: extension.isActive });
  }
  const root = vscode.workspace.workspaceFolders[0].uri;
  const uri = vscode.Uri.joinPath(root, 'format-compatibility.js');
  await vscode.workspace.fs.writeFile(uri, Buffer.from('const sample={ok:true,items:[1,2]};\n'));
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand('prettier.forceFormatDocument');
  assert.match(document.getText(), /const sample = \{ ok: true, items: \[1, 2\] \};/);
  await fs.mkdir(path.resolve(__dirname, '../../artifacts'), { recursive: true });
  await fs.writeFile(path.resolve(__dirname, '../../artifacts/extensions-results.json'), JSON.stringify({ extensions: results, prettierFormatted: true }, null, 2));
};
