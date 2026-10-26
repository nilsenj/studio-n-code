export function configureProduct(product) {
  return {
    ...product,
    nameShort: 'studio-n-code', nameLong: 'studio-n-code', applicationName: 'studio-n-code',
    dataFolderName: '.studio-n-code', sharedDataFolderName: '.studio-n-code-shared',
    win32MutexName: 'studioncode', win32DirName: 'studio-n-code', win32NameVersion: 'studio-n-code',
    win32RegValueName: 'StudioNCode', win32AppUserModelId: 'StudioNCode.Editor', win32ShellNameShort: 'studio-n-code',
    win32x64AppId: '{{BAE06E6C-7DF7-44D1-934C-1584CA4EAEE7}',
    win32arm64AppId: '{{888107B0-181D-4DFB-909E-38F250EC7663}',
    win32x64UserAppId: '{{0C61E089-5602-4C40-81FD-085EC5C033A1}',
    win32arm64UserAppId: '{{83F02B89-4443-48EC-A0D3-D8B899196D03}',
    win32TunnelServiceMutex: 'studioncode-tunnelservice', win32TunnelMutex: 'studioncode-tunnel',
    serverApplicationName: 'studio-server', serverDataFolderName: '.studio-server', tunnelApplicationName: 'studio-tunnel',
    darwinBundleIdentifier: 'dev.studioncode.editor', linuxDesktopName: 'dev.studioncode.editor', linuxIconName: 'studio-n-code',
    urlProtocol: 'studio-n-code',
    // No Microsoft Marketplace endpoint is added to this independently branded fork.
    enableTelemetry: false,
  };
}

export function assertRevision(actual, expected) {
  if (actual.trim() !== expected) throw new Error(`Unexpected upstream revision: ${actual.trim()}; expected ${expected}`);
}

export function patchWorkbench(source) {
  const addition = "import './contrib/studio/browser/studio.contribution.js';";
  if (source.includes(addition)) return source;
  const anchor = "import './workbench.common.main.js';";
  if (!source.includes(anchor)) throw new Error('Workbench import anchor was not found');
  return source.replace(anchor, `${anchor}\n${addition}`);
}

export function patchMenuDefault(source) {
  const replacement = "'default': 'compact', // studio-n-code menu default";
  if (source.includes(replacement)) return source;
  const anchor = "'default': isWeb ? 'compact' : 'classic',";
  if (!source.includes(anchor)) throw new Error('Menu default anchor was not found');
  return source.replace(anchor, replacement);
}

export function patchShell(kind, source) {
  if (kind === 'titlebar') source = source.replace('let value = 48; // Studio New UI header', 'let value = this.isCommandCenterVisible || wcoEnabled ? DEFAULT_CUSTOM_TITLEBAR_HEIGHT : 30;');
  const replacements = {
    layout: ['this.workbenchGrid.layout(this._mainContainerDimension.width, this._mainContainerDimension.height);', 'this.workbenchGrid.layout(Math.max(0, this._mainContainerDimension.width - 40), this._mainContainerDimension.height); // Studio right tool-window rail'],
    titlebar: ['let value = this.isCommandCenterVisible || wcoEnabled ? DEFAULT_CUSTOM_TITLEBAR_HEIGHT : 30;', 'let value = Math.max(48, DEFAULT_CUSTOM_TITLEBAR_HEIGHT); // Studio New UI header'],
    activitybar: ['static readonly ACTIVITYBAR_WIDTH = 48;', 'static readonly ACTIVITYBAR_WIDTH = 40; // Studio tool-window rail'],
    explorer: ["localize2('explore', \"Explorer\")", "localize2('explore', \"Project\")"],
  };
  const [anchor, replacement] = replacements[kind] || [];
  if (!anchor) throw new Error(`Unknown shell patch ${kind}`);
  if (source.includes(replacement)) return source;
  if (!source.includes(anchor)) throw new Error(`Shell ${kind} anchor was not found`);
  return source.replaceAll(anchor, replacement);
}
