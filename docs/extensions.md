# Extensions

studio-n-code retains the Code OSS extension host and public VS Code extension API from the revision in [upstream.lock.json](../upstream.lock.json). Branding does not replace language, debugger, theme, task or webview APIs.

Open **Extensions**, search and select **Install**. The catalog uses [Open VSX](https://open-vsx.org/), configured with its [official adapter](https://github.com/eclipse-openvsx/openvsx/wiki/Using-Open-VSX-in-VS-Code). Updates use the same registry.

For author-provided `.vsix` files, run **Extensions: Install from VSIX...** in Find Action. The command line also supports `studio-n-code.exe --install-extension path-to-file.vsix`.

## Compatibility boundaries

Compatible VS Code extensions are supported; every published extension cannot be guaranteed. Engine version, operating system, architecture, native modules, external runtimes, authentication and proposed APIs affect compatibility. Workspace Trust and extension enable/disable controls remain available.

Open VSX has a different catalog from Microsoft's Marketplace. Authors may offer their own VSIX downloads if the license permits. Microsoft documents restrictions on proprietary extensions/services in [distribution differences](https://github.com/microsoft/vscode/wiki/Differences-between-the-repository-and-Visual-Studio-Code). The app does not bypass these restrictions. Successful installation alone does not establish feature compatibility.

For the Open VSX catalog, `extensions.verifySignature` defaults to `false` because its packages do not carry the Microsoft gallery signature metadata expected by the upstream installer. Packages still arrive over HTTPS. You may enable signature verification in Settings, but Open VSX installs without that metadata will fail.

Report extension ID/version, app version, Windows version, Output/log errors and a minimal reproduction when reporting problems.
