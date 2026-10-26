# Install studio-n-code

## Linux x64

After a release includes Linux assets, install the latest preview for your user account with:

```sh
curl -fsSL https://raw.githubusercontent.com/nilsenj/studio-n-code/main/scripts/install-linux.sh | bash
```

The script checks the release archive against its SHA-256 checksum, installs under `~/.local/opt/studio-n-code/`, adds a launcher in `~/.local/bin/`, and creates an applications-menu entry. It does not require administrator access. `curl` (or `wget`), `tar`, and `sha256sum` are required. Add `~/.local/bin` to `PATH` if you want to start the editor from a terminal. The build host is Ubuntu 22.04 x64; other distribution compatibility and ARM builds are not yet validated. Minimal Ubuntu/WSL images also need the Electron runtime libraries `libnspr4`, `libnss3` and `libasound2` (`sudo apt install libnspr4 libnss3 libasound2`).

To update, run the same command again. To uninstall, remove `~/.local/opt/studio-n-code`, `~/.local/bin/studio-n-code`, `~/.local/share/applications/studio-n-code.desktop`, and `~/.local/share/icons/hicolor/256x256/apps/studio-n-code.png`. Workspace files are not affected.

## Windows 10/11 x64

1. Open [Releases](https://github.com/nilsenj/studio-n-code/releases) and select the newest preview.
2. Download `studio-n-code-<version>-windows-x64-setup.exe` under **Assets**.
3. Run the installer. It installs for your Windows account without administrator access.
4. Open **studio-n-code** from Start, then **File > Open Folder**.

Node.js, npm, Python and C++ Build Tools are not required to install or launch the release. Install [Git for Windows](https://git-scm.com/download/win) for Git features, and a language runtime for running your project's code.

The preview is unsigned. Windows may show an unknown-publisher message; verify the repository/download before choosing to run it. Compare the complete hash with the matching filename in the release's `SHA256SUMS.txt`:

```powershell
Get-FileHash .\studio-n-code-0.2.3-windows-x64-setup.exe -Algorithm SHA256
```

## Portable ZIP

Download the `windows-x64.zip` asset, extract **all** files into a writable folder, then open `studio-n-code.exe`. Running from inside the ZIP will not work. To keep settings alongside the app, create an empty `data` folder there before first launch. Otherwise settings use the normal Windows profile location.

## Extensions and commands

Open **Code Board** from the toolbar to explore files, areas, changes, features and history. Click any card for its details; each card has **Explain**. Open **AI Mode > Connection**, choose OpenAI, Google Gemini or Anthropic, enter an API key and discover your available models. Keys are stored separately in the OS-backed secret store. See [Code Board and AI guide](docs/ai-board.md). No model credentials are included in the installer.

Open **Extensions**, search Open VSX and select **Install**. Use **Extensions: Install from VSIX...** for author-provided compatible files. See [compatibility details](docs/extensions.md).

**Ctrl+Alt+L** formats code; **Ctrl+Alt+I** adjusts indentation. Missing providers and command outcomes appear in the editor/status bar. Details are in **Output > studio-n-code**.

## Update

Save files and close the app, then run the newer installer with the same installation folder. Settings and installed extensions are retained. There is no automatic updater. For portable updates, extract into a new folder; move a portable `data` folder only while the app is closed.

## Uninstall and icons

Use **Windows Settings > Apps > Installed apps > studio-n-code > Uninstall**. The installer registers a Studio N icon, Start shortcut and uninstall entry. Uninstalling retains settings. An older development launcher is separate; unpin its old shortcut and pin the installed application if needed. Other editors' shortcuts are independent.

## Troubleshooting

- Missing Git/runtime: install the tool, restart the app and check its terminal.
- Missing formatter/refactoring: read command feedback and install a suitable language provider.
- Startup failure: retain all extracted companion DLLs and report the error in [Issues](https://github.com/nilsenj/studio-n-code/issues). Default logs are in `%APPDATA%\studio-n-code\logs`.
- Developers building source should use [BUILDING.md](BUILDING.md).
