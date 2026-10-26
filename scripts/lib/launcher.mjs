import { join } from 'node:path';

export function launchConfiguration(root, paths = [], environment = process.env, smoke = false) {
  const env = { ...environment, NODE_ENV: 'development', VSCODE_DEV: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const data = join(root, '.runtime', 'studio-n-code');
  const args = ['.', '--user-data-dir', join(data, smoke ? 'smoke-user-data' : 'user-data'),
    '--extensions-dir', join(data, smoke ? 'smoke-extensions' : 'extensions'),
    '--disable-extension=vscode.vscode-api-tests', '--skip-welcome', '--skip-release-notes', ...paths];
  if (smoke) args.push('--extensionDevelopmentPath', join(root, 'tests/smoke-extension'),
    '--extensionTestsPath', join(root, 'tests/smoke-extension/test.cjs'), '--disable-workspace-trust');
  return { executable: join(root, 'upstream/.build/electron/studio-n-code.exe'), cwd: join(root, 'upstream'),
    args, env, detached: !smoke, outputMode: 'file' };
}
