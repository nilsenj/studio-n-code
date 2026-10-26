# Contributing

## Development setup

Follow [BUILDING.md](BUILDING.md), then create a branch for your change. Keep modifications in the application customization layer; avoid editing generated output or making unrecorded changes directly in `upstream/`.

## Where changes belong

- Interface chrome and layout integration: `customizations/native/`.
- Commands, keybindings, language-provider integration and Git tools: `customizations/studio-workbench/`.
- Reproducible source transformations: `scripts/lib/product.mjs` and `scripts/prepare.mjs`.
- Application branding: `assets/`, `scripts/lib/product.mjs`, and `scripts/lib/launcher.mjs`.
- Public documentation: `README.md` and `docs/`.

Edit `commands.json` as the command registry, then run `node scripts/generate-manifest.mjs`. The generated extension manifest must be committed with the registry changes.

For icon changes, edit `assets/icon.svg`, run `npm run icons`, and commit the SVG, PNG and ICO outputs together. Preserve the original asset's license and attribution if adding third-party artwork.

## Checks

```powershell
npm test
npm run test:ui
npm run prepare:upstream
npm run smoke
```

The browser interaction tests need upstream dependencies. The smoke suite needs a built desktop application and creates a disposable Git repository under `artifacts/`. Its commits use a test identity configured only inside that fixture.

After a native workbench change, run the incremental build and the client type check from `upstream/`. See [BUILDING.md](BUILDING.md). Do not claim screenshots, installers, platforms or integrations were verified unless they were actually checked.

## Pull requests

Explain the problem, resulting behavior, and validation. Include screenshots for interface changes when available. Keep unrelated refactors separate. Never commit account data, credentials, local logs, full upstream source, dependency folders, or test fixtures.
