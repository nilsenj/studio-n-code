import { join, dirname } from 'node:path';

export function launchConfiguration(root, paths = [], environment = process.env, smoke = false, packagedExecutable) {
  const env = { ...environment, NODE_ENV: packagedExecutable ? 'production' : 'development', VSCODE_DEV: '1' };
  if (packagedExecutable) delete env.VSCODE_DEV;
  delete env.ELECTRON_RUN_AS_NODE;
  const data = join(root, '.runtime', 'studio-n-code');
  const home = environment.USERPROFILE || environment.HOME;
  const userData = smoke
    ? join(data, packagedExecutable ? 'packaged-smoke-data' : 'smoke-user-data')
    : environment.APPDATA ? join(environment.APPDATA, 'studio-n-code')
      : process.platform === 'darwin' && home ? join(home, 'Library', 'Application Support', 'studio-n-code')
        : process.platform === 'linux' ? join(environment.XDG_CONFIG_HOME || (home ? join(home, '.config') : data), 'studio-n-code')
          : join(data, 'user-data');
  const extensions = smoke ? join(data, 'smoke-extensions') : home ? join(home, '.studio-n-code', 'extensions') : join(data, 'extensions');
  const args = [...(packagedExecutable ? [] : ['.']), '--user-data-dir', userData,
    '--extensions-dir', extensions,
    '--disable-extension=vscode.vscode-api-tests', '--skip-welcome', '--skip-release-notes', ...paths];
  if (smoke) args.push('--extensionDevelopmentPath', join(root, 'tests/smoke-extension'),
    '--extensionTestsPath', join(root, 'tests/smoke-extension/test.cjs'), '--disable-workspace-trust');
  const developmentExecutable = process.platform === 'win32' ? 'studio-n-code.exe' : 'studio-n-code';
  return { executable: packagedExecutable || join(root, 'upstream', '.build', 'electron', developmentExecutable), cwd: packagedExecutable ? dirname(packagedExecutable) : join(root, 'upstream'),
    args, env, detached: !smoke, outputMode: 'file' };
}
