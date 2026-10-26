<p align="center"><img src="assets/icon-256.png" width="96" height="96" alt="studio-n-code icon"></p>

# studio-n-code

A desktop coding studio with a focused workspace, integrated Git tools, and a practical keyboard workflow.

studio-n-code combines a project-oriented interface with a real editor, terminal, debugger and source-control services. Its application-specific source is maintained in this repository; the build reproducibly integrates a pinned Code OSS revision.

**Status:** early development release, focused on Windows x64. Build from source using the instructions below. A signed installer is not available yet.

## Features

- Project, branch and run-configuration controls in the main toolbar.
- Project and tool-window navigation with a dark interface, Inter typography and original file icons.
- Search across files and workspace symbols, plus a full action palette.
- 59 application actions with documented editing, navigation, formatting and debugger shortcuts.
- Commit checklist with explicit file selection, message entry and amend support.
- Git branches, commit graph, history filtering, commit details and file diffs.
- Integrated terminal and Node run/debug support.
- JavaScript/TypeScript language services and support for additional compatible language tooling.

## Build and run

On Windows x64, install Git, Node.js 24.18 or newer in the 24.x line, npm below 13, Python 3.12, and Visual Studio C++ Build Tools with a Windows SDK and the matching Spectre runtime libraries.

```powershell
git clone https://github.com/nilsenj/studio-n-code.git
cd studio-n-code
npm ci
npm run build
npm start -- "C:\path\to\your-project"
```

After building, you can also use **Start studio-n-code.cmd**.

See [BUILDING.md](BUILDING.md) for complete prerequisites, the optional local-development toolchain configuration, incremental builds and troubleshooting. The first build downloads upstream sources and dependencies and needs several GB of free disk space.

## Everyday shortcuts

| Action | Shortcut |
| --- | --- |
| Search Everywhere | Double Shift |
| Find Action | Ctrl+Shift+A |
| Go to Class / File | Ctrl+N / Ctrl+Shift+N |
| Recent Files | Ctrl+E |
| Reformat Code | Ctrl+Alt+L |
| Auto-Indent Lines | Ctrl+Alt+I |
| Intention Actions | Alt+Enter |
| Commit | Ctrl+K / Alt+0 |
| Git Log | Alt+9 |
| Terminal | Alt+F12 |
| Run / Debug | Shift+F10 / Shift+F9 |
| Settings | Ctrl+Alt+S |

Formatting, navigation and refactoring depend on the language providers installed for the file. See the [complete shortcut map](docs/shortcuts.md) and [usage guide](docs/usage.md).

## Documentation

- [Build instructions and troubleshooting](BUILDING.md)
- [Usage and Git workflow](docs/usage.md)
- [Keyboard shortcuts](docs/shortcuts.md)
- [Architecture and source layout](docs/architecture.md)
- [Verification](docs/verification.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Licensing and attribution](NOTICE.md)

## Current scope

The application is in active development. The repository provides source and reproducible development builds. Installer packaging, signing, other platform builds, and broader language integrations are future work.

PHP syntax/basic language support is present in the underlying source distribution. Rich PHP indexing, advanced refactoring, framework tooling and Xdebug require additional compatible providers. Some extensions and external services may have their own licensing or account requirements.

## License

Application-specific source, original icon and documentation are MIT licensed. The editor engine, fonts, runtime, dependencies and bundled extensions retain their respective licenses. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
