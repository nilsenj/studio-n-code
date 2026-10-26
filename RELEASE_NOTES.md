# studio-n-code 0.2.2 preview

Standalone Windows and Linux x64 coding studio with Studio N styling, integrated Git tools, keyboard commands, visible command feedback and Open VSX extension installation.

Code Board organizes project files, areas, changes, features and Git history. Every card opens a details dialog with relevant file or Git metadata and an AI Explain action. AI Mode supports OpenAI, Google Gemini and Anthropic API keys, discovers available models automatically, and recommends a balanced model when the provider catalog allows it. AI answers render Markdown and have Concise, Standard and Detailed sizes; output length is capped for each provider. Keys are stored separately in the editor's OS-backed secret store. A model/account is not bundled.

On Windows, download `studio-n-code-0.2.2-windows-x64-setup.exe` for a per-user installation, or extract `studio-n-code-0.2.2-windows-x64.zip` and run `studio-n-code.exe`. On Ubuntu 22.04 x64, use the `install-linux.sh` installer asset or follow the Linux instructions in `INSTALL.md`; the installer downloads the archive and verifies its SHA-256 digest. `SHA256SUMS.txt` and `SHA256SUMS-linux.txt` contain platform-specific file digests.

See [installation instructions](https://github.com/nilsenj/studio-n-code/blob/main/INSTALL.md) and [extension compatibility](https://github.com/nilsenj/studio-n-code/blob/main/docs/extensions.md).

The Windows preview is unsigned and uses ordinary MSVC runtime libraries. Linux builds target x64 and are built on Ubuntu 22.04; other distributions and ARM are not validated. Automatic updates are not available. Extensions requiring Microsoft-only services/licenses are not guaranteed to work. Save work before updating.
