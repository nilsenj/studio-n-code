import { readFile, writeFile, cp, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureProduct, assertRevision, patchWorkbench, patchMenuDefault, patchShell } from './lib/product.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = resolve(root, 'upstream');
const lock = JSON.parse(await readFile(join(root, 'upstream.lock.json'), 'utf8'));
assertRevision(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }), lock.commit);
const productPath = join(upstream, 'product.json');
const product = JSON.parse(await readFile(productPath, 'utf8'));
await writeFile(productPath, JSON.stringify(configureProduct(product), null, '\t') + '\n');
await cp(join(root, 'assets/icon.ico'), join(upstream, 'resources/win32/code.ico'));
await cp(join(root, 'assets/icon-70.png'), join(upstream, 'resources/win32/code_70x70.png'));
await cp(join(root, 'assets/icon-150.png'), join(upstream, 'resources/win32/code_150x150.png'));
await cp(join(root, 'assets/icon-256.png'), join(upstream, 'resources/linux/code.png'));
await cp(join(root, 'assets/icon.svg'), join(upstream, 'src/vs/workbench/browser/media/code-icon.svg'));
await cp(join(root, 'customizations/studio-workbench'), join(upstream, 'extensions/studio-workbench'), { recursive: true });
await cp(join(root, 'customizations/native/fonts'), join(upstream, 'extensions/studio-workbench/ui/fonts'), { recursive: true });
const native = join(upstream, 'src/vs/workbench/contrib/studio/browser');
await mkdir(native, { recursive: true });
await cp(join(root, 'customizations/native'), native, { recursive: true });
const entry = join(upstream, 'src/vs/workbench/workbench.desktop.main.ts');
await writeFile(entry, patchWorkbench(await readFile(entry, 'utf8')));
const settings = join(upstream, 'src/vs/workbench/browser/workbench.contribution.ts');
await writeFile(settings, patchMenuDefault(await readFile(settings, 'utf8')));
for (const [kind, file] of Object.entries({
  brokenpipe: 'src/bootstrap-node.ts',
  copilotignore: 'build/.moduleignore',
  copilotpackage: 'build/lib/extensions.ts',
  openvsxsignature: 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts',
  openvsxcli: 'src/vs/platform/extensionManagement/node/extensionManagementService.ts',
  bundler: 'build/next/index.ts',
  layout: 'src/vs/workbench/browser/layout.ts',
  titlebar: 'src/vs/workbench/browser/parts/titlebar/titlebarPart.ts',
  activitybar: 'src/vs/workbench/browser/parts/activitybar/activitybarPart.ts',
  explorer: 'src/vs/workbench/contrib/files/browser/explorerViewlet.ts',
})) {
  const target = join(upstream, file);
  await writeFile(target, patchShell(kind, await readFile(target, 'utf8')));
}
console.log(`Studio customization applied to ${lock.tag} (${lock.commit.slice(0, 12)})`);
