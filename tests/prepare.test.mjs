import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureProduct, assertRevision, patchWorkbench, patchMenuDefault, patchShell } from '../scripts/lib/product.mjs';

test('Studio has independent identity while retaining upstream licensing', () => {
  const upstream = { nameShort: 'Code - OSS', licenseName: 'MIT', builtInExtensions: [{ name: 'debugger' }] };
  const result = configureProduct(upstream);
  assert.equal(result.nameShort, 'studio-n-code');
  assert.equal(result.applicationName, 'studio-n-code');
  assert.equal(result.dataFolderName, '.studio-n-code');
  assert.equal(result.win32AppUserModelId, 'StudioNCode.Editor');
  assert.equal(result.licenseName, 'MIT');
  assert.equal(result.extensionsGallery.serviceUrl, 'https://open-vsx.org/vscode/gallery');
  assert.match(result.extensionsGallery.resourceUrlTemplate, /\{publisher\}\/\{name\}/);
  assert.deepEqual(result.builtInExtensions, upstream.builtInExtensions);
  assert.equal(upstream.nameShort, 'Code - OSS');
  assert.deepEqual(configureProduct(result), result);
});

test('setup rejects an unexpected upstream revision', () => {
  assert.throws(() => assertRevision('bad', 'expected'), /revision/);
  assert.doesNotThrow(() => assertRevision('expected\n', 'expected'));
});

test('native workbench import is added exactly once', () => {
  const input = "import './workbench.common.main.js';\n";
  const patched = patchWorkbench(input);
  assert.match(patched, /studio.contribution.js/);
  assert.equal(patchWorkbench(patched), patched);
  assert.throws(() => patchWorkbench('unexpected source'), /anchor/);
});

test('compact menu is a native default and the patch is idempotent', () => {
  const source = "'default': isWeb ? 'compact' : 'classic',";
  const result = patchMenuDefault(source);
  assert.equal(result, "'default': 'compact', // studio-n-code menu default");
  assert.equal(patchMenuDefault(result), result);
  assert.throws(() => patchMenuDefault('changed upstream'), /anchor/);
});

test('shell patch reserves real grid space for the right rail and enlarges the header', () => {
  const layout = 'this.workbenchGrid.layout(this._mainContainerDimension.width, this._mainContainerDimension.height);';
  assert.match(patchShell('layout', layout), /width - 40/);
  const header = 'let value = this.isCommandCenterVisible || wcoEnabled ? DEFAULT_CUSTOM_TITLEBAR_HEIGHT : 30;';
  assert.match(patchShell('titlebar', header), /Math.max\(48, DEFAULT_CUSTOM_TITLEBAR_HEIGHT\)/);
  assert.equal(patchShell('layout', patchShell('layout', layout)), patchShell('layout', layout));
  assert.throws(() => patchShell('layout', 'changed upstream'), /anchor/);
});

test('production bundler accepts the bundled application font', () => {
  const source = "loader: { '.ttf': 'file', }";
  const result = patchShell('bundler', source);
  assert.match(result, /'\.woff2': 'file'/);
  assert.equal(patchShell('bundler', result), result);
});

test('packaging retains the built-in extension SDK required by its runtime shim', () => {
  const input = '@github/copilot/**\n@github/copilot-win32-x64/**\n@github/copilot-sdk/node_modules/@github/copilot/**';
  const output = patchShell('copilotignore', input);
  assert.ok(output.includes('\n@github/copilot/**\n!@github/copilot/package.json\n!@github/copilot/sdk/**'));
  assert.match(output, /@github\/copilot-win32-x64/);
  assert.ok(output.includes('@github/copilot-sdk/node_modules/@github/copilot/**'));
  assert.equal(patchShell('copilotignore', output), output);
});

test('Copilot packaging excludes foreign native modules but retains its SDK', () => {
  const source = "export function packageCopilotExtensionStream() { return es.merge(a, b).pipe(util2.setExecutableBit(['**/*.sh'])); }\nexport function packageMarketplaceExtensionsStream() {}";
  const result = patchShell('copilotpackage', source);
  assert.match(result, /name\.includes\(copilot \+ 'sdk\/'\)/);
  assert.match(result, /return !name\.includes\(copilot\)/);
  assert.equal(patchShell('copilotpackage', result), result);
});

test('Open VSX does not require Microsoft gallery signature metadata', () => {
  const source = "[VerifyExtensionSignatureConfigKey]: {\n\t\t\t\ttype: 'boolean',\n\t\t\t\tdefault: true,\n\t\t\t\tscope: ConfigurationScope.APPLICATION,\n\t\t\t},";
  const output = patchShell('openvsxsignature', source);
  assert.match(output, /product\.extensionsGallery\?\.serviceUrl/);
  assert.equal(patchShell('openvsxsignature', output), output);
  const cli = 'verifySignature = isBoolean(value) ? value : true;';
  const cliOutput = patchShell('openvsxcli', cli);
  assert.match(cliOutput, /this\.productService\.extensionsGallery/);
  assert.equal(patchShell('openvsxcli', cliOutput), cliOutput);
});
