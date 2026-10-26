# Notices and attribution

studio-n-code's application-specific source, original icon and documentation are distributed under the MIT license in [LICENSE](LICENSE).

## Code OSS

The editor and desktop runtime integration are based on Microsoft's Code OSS source, pinned by [upstream.lock.json](upstream.lock.json). The build downloads that source into `upstream/` and retains its original copyright notices, `LICENSE.txt`, and `ThirdPartyNotices.txt`.

- Source: https://github.com/microsoft/vscode
- Upstream license: https://github.com/microsoft/vscode/blob/main/LICENSE.txt

This repository contains the application customization layer and reproducible build tooling. It does not vendor the complete upstream checkout or claim authorship of the editor engine.

## Inter

Inter is bundled for the application interface. Copyright belongs to the Inter project authors. Its SIL Open Font License 1.1 is included at [customizations/native/fonts/LICENSE.txt](customizations/native/fonts/LICENSE.txt).

- Source: https://github.com/rsms/inter/tree/v4.1

## Dependencies and built-in extensions

Electron, Node.js, npm dependencies, and upstream built-in extensions retain their respective licenses. Their inclusion in a development build does not change those terms. Preserve all upstream notices when redistributing compiled builds. The root MIT license applies to the source and assets authored for this project, not as a replacement for third-party licenses.

The icon renderer, `@resvg/resvg-js`, is a development dependency under its own MPL-2.0 license. The generated original icon assets are part of this project's MIT-licensed assets.
