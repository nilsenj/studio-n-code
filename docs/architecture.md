# Architecture

studio-n-code is a standalone desktop application integration built on a pinned Code OSS source revision. The repository intentionally keeps the application-specific layer small and reviewable.

## Source layout

| Path | Responsibility |
| --- | --- |
| `assets/` | Original app icon, PNG exports and Windows ICO |
| `customizations/native/` | Native header, menu, rails, styling, Inter font and license |
| `customizations/studio-workbench/` | Bundled workbench extension, command registry, theme, icons and Git views |
| `scripts/lib/product.mjs` | Independent application identity and guarded source transformations |
| `scripts/prepare.mjs` | Revision validation and repeatable application integration |
| `scripts/launch.mjs` | Safe desktop process launch with persistent file logging |
| `scripts/build.ps1` | Windows source build orchestration |
| `upstream.lock.json` | Source repository, tag and exact commit |
| `tests/` | Unit, headless Git-view interaction and desktop integration tests |
| `docs/` | Public usage, architecture, shortcuts and verification notes |

## Reproducible integration

The build obtains upstream source into the ignored `upstream/` directory and validates its exact HEAD before applying changes. Transformations check expected anchors, are idempotent, and fail when an upstream layout change requires review. Native workbench changes are confined to selected entry/layout/configuration files plus the application's contribution.

A generated bundled extension uses the `studio.*` command namespace and contributes the application's theme, icons, shortcuts and Git views. Public extension APIs are used where possible; native workbench services supply shell layout and tool-window integration.

## Git boundary

The Git interface uses the bundled Git extension API. Repository identity and changed paths are validated against current repository state. Commit selection rejects unrelated staged files and unresolved conflicts. An explicit two-dot revision range compares commit contents; root commits use the repository's read-only computed empty-tree object ID.

Webviews render repository text using DOM text nodes and constrain resources through a Content Security Policy. Background snapshots preserve input focus and selection. The interface displays actual repository state rather than simulated history or terminal output.

## Application identity and assets

Product names, protocol, mutexes, storage directories and application IDs are independently configured. The original vector mark is exported to standard PNG and ICO sizes and applied to native application resources.

The upstream checkout, dependency folders, local application state, logs and smoke fixtures are not published. Inter's bundled license and upstream attribution are preserved; see [NOTICE.md](../NOTICE.md).

## Current implementation boundaries

The core editor, terminal, debug adapter support and language-provider infrastructure come from upstream. This layer supplies application chrome, workflow integration, branding and Git presentation. Platform packaging, a distribution service and broader language tooling are separate future components.
