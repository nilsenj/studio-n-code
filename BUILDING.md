# Building studio-n-code

## Supported development environment

The currently verified desktop environment is Windows x64 with:

- Git for Windows.
- Node.js 24.x, at least 24.18.0. The pinned upstream `.nvmrc` is authoritative when changing revisions.
- npm below version 13.
- Python 3.12.
- Visual Studio Build Tools 2022 with Desktop development with C++, a Windows SDK, and matching MSVC Spectre-mitigated runtime libraries.
- Several GB of free disk space for the upstream source, native dependencies and Electron runtime.

The application integration layer is versioned separately from the upstream editor engine. `upstream.lock.json` records the exact source tag and commit. Changing it requires checking build prerequisites and extension compatibility again.

## First build

```powershell
npm ci
npm run build
```

The build script:

1. Obtains the pinned source into `upstream/` if necessary.
2. Generates the bundled workbench manifest from the command registry.
3. Applies independent product identity, original icons and targeted workbench transformations.
4. Installs upstream dependencies, including native modules.
5. Builds the application, obtains Electron and prepares built-in debugger extensions.

The upstream checkout and build output are ignored by the root Git repository. The customization source and upstream pin are sufficient to reproduce the integration.

## Launch

```powershell
npm start -- "C:\path\to\project"
```

Alternatively, run `Start studio-n-code.cmd`. Use the launcher rather than opening the raw development executable: the launcher supplies the source-application path, development environment, separate data paths and persistent log handles.

For a local shortcut using the application icon, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcut.ps1`. This creates `studio-n-code.lnk` in the checkout. The machine-specific shortcut is ignored by Git; regenerate it if you move the checkout.

Development executable: `upstream/.build/electron/studio-n-code.exe`.

Application settings and extension installations live under `.runtime/studio-n-code/` in this checkout. Shared application storage uses `.studio-n-code-shared` in the user's home directory. The project launcher writes stdout/stderr to `.logs/`; closing the launching terminal does not close those application log handles.

## Local development without Spectre runtime libraries

If your compiler installation lacks the matching Spectre libraries, an explicit development-only option uses ordinary MSVC runtime libraries:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1 -DevelopmentWithoutSpectre
```

This copies `customizations/build/Directory.Build.targets` into the upstream checkout. It is not a release-build configuration. A standard build refuses to silently reuse that override. Install the matching libraries and remove the generated override before making a standard release build.

## Incremental work

After editing commands, theme, native integration or Git UI:

```powershell
node scripts/generate-manifest.mjs
npm run prepare:upstream
cd upstream
npm run build-fast -- --client-only
```

Restart or reload the application after applying changes. For native TypeScript changes, also run:

```powershell
npm run typecheck-client
```

A full extension rebuild is needed when modifying upstream extension TypeScript. Application-specific JavaScript and webview assets are copied directly by `prepare:upstream`.

## Icon assets

`assets/icon.svg` is the original scalable source. Regenerate the committed exports with:

```powershell
npm run icons
```

This creates PNG exports at 256, 512 and 1024 pixels, a seven-size Windows ICO, and the native application mark. The source preparation step applies these assets to upstream application resources; Electron preparation embeds the Windows icon into the executable.

## Validation

```powershell
npm test
npm run test:ui
npm run smoke
```

Unit tests can run after the root `npm ci`. Headless webview tests use Playwright from the installed upstream development dependencies. Desktop smoke tests need the compiled executable and create a disposable repository under `artifacts/`.

The source-check workflow runs root unit tests and checks that the generated manifest matches its command registry. Full desktop builds and desktop smoke checks are separate, more expensive validations.

## Troubleshooting

### Missing compiler or native dependency failure

Read the first actual compiler error in the install log. Verify Python, MSVC, Windows SDK, the pinned Node major version and the matching runtime libraries. Do not switch the upstream Electron target to the local Node version: native modules must match Electron's ABI.

### EPIPE or a window that opens and then reports a main-process logging error

Use `npm start` or `Start studio-n-code.cmd`. The launcher redirects application output to persistent files. Launching the raw GUI executable through a short-lived console pipe can leave it with a closed output stream.

### A shortcut appears to do nothing

Open Find Action with Ctrl+Shift+A. Some commands require editor focus or a language provider. Formatting needs a formatter; PHP debugging needs an appropriate debugger provider and runtime configuration.

### Changes to source are not visible

Regenerate the manifest, reapply source preparation, rebuild the changed native output, and restart the application. Check `.logs/` for startup errors. Do not upload unredacted private logs to public issues.
