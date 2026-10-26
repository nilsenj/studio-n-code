# Verification

Local validation performed on 2026-10-26 for the studio-n-code development source.

## Environment

- Windows x64.
- Node.js 24.20.0, npm 11.19.0, Python 3.12.10.
- Visual Studio Build Tools 2022 / MSVC 14.44.
- Code OSS source pinned to tag `1.143.1`, commit `e646868227c3e3a9e3f24277c8c7220be42c0be7`.

## Results

| Check | Result |
| --- | --- |
| Root unit tests | 15 passed, 0 failed |
| Headless Git-view interaction tests | 2 passed, 0 failed |
| Real desktop smoke checks | 9 passed, 0 failed |
| Native incremental source build | Passed |
| Whole-client TypeScript check | Passed |
| SVG/PNG/ICO asset structure and sizes | Passed |
| Windows executable product name, description and original filename | studio-n-code |

The icon assets are original SVG artwork with deterministic PNG/ICO exports. ICO checks cover seven sizes from 16 through 256 pixels; PNG checks cover 256, 512 and 1024 pixels.

## Desktop smoke coverage

The suite runs in the real Electron extension host against a generated, disposable repository. It verifies:

1. The application workbench bundle activates, its theme is configured, and mapped commands exist.
2. A real file opens, changes, saves, and matches its on-disk contents.
3. TypeScript definition, reference, and rename providers return results.
4. Git discovers a working change, opens its diff, stages it and unstages it.
5. The integrated terminal executes a shell command and produces a checked output file.
6. A PHP file is recognized and the basic language bundle is present.
7. The Node debugger executes a real program and produces its checked output.
8. Dedicated Commit/Git views open, expose real branch/history data and return the complete root-commit file list.
9. A checklist commit includes only the selected file and preserves unrelated working changes.

The root-commit check asserts the complete original file set. Selected-commit changes are compared using an explicit parent-to-commit range; root commits use the read-only computed empty-tree ID.

## Interaction checks

Headless Chromium executes the actual Git-view JavaScript. Background snapshots are checked to preserve the commit message's input focus/caret and the history filter's focus/query.

## Scope of these results

These are local development checks, not a claim of a signed or packaged release. The complete upstream test suite, installer behavior, other operating systems, external account integrations, advanced PHP intelligence and Xdebug were not validated. A screenshot-based desktop visual review was not performed.

This machine used the explicit local-development MSBuild override for ordinary runtime libraries because the matching Spectre libraries were absent. Standard release builds should use the full supported toolchain described in [BUILDING.md](../BUILDING.md).

Local run logs and machine-readable smoke results are generated under ignored `.logs/` and `artifacts/` directories. They are not published because they can contain local paths and project data.
