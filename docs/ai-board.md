# Code Board and AI Mode

Open **Code Board** from the toolbar, left rail, View menu or Find Action. The board lists the current project's Git tracked and visible untracked files, directory areas, working changes and recent commits. Conventional `feat:` commits appear as feature cards. Search across the active category, use **Open** to navigate to a file, or **Explain** on any card. Refresh after large changes. A folder without Git still shows workspace files; Git history and change cards require Git.

The board's Explain button opens **AI Mode** with that card as context. If a model is already connected, it starts the explanation. For a file, AI receives up to 30,000 characters of source. An area includes file names and representative source; a feature or commit includes a bounded Git patch. Long context is marked as truncated. The app sends project context only after you choose **Explain** or **Send**.

## Connect a model

Open **AI Mode > Connection**. Enter an OpenAI-compatible chat-completions endpoint and model ID. For OpenAI, the endpoint is `https://api.openai.com/v1`; enter a model ID supported by your account. Local compatible servers may use `http://localhost` or `http://127.0.0.1`. Remote endpoints must use HTTPS. Enter an API key if required. The key is stored in the editor's OS-backed SecretStorage and is never placed in the project or release source. **Remove key** clears it. No model subscription or key is bundled with the app.

## Work with AI

- **Ask:** question about the selected board item or active file.
- **Explain:** purpose, flow, dependencies and risks, grounded in the supplied code.
- **Plan:** an implementation plan based on the current context.
- **Edit file:** request a replacement for one selected or open file up to 50,000 characters. The complete current file is sent as context; larger files are rejected for whole-file edits. A complete streamed response and closed code fence are required before the app opens a diff. Choose **Apply edit** only after reviewing it. If the file changed since the proposal, Apply refuses and asks for a new proposal. The edit appears in the editor and remains unsaved until you save it; ordinary Undo works.

Responses stream into the panel. **Stop** cancels an active request; **Clear chat** drops the in-memory conversation. Errors appear in the panel. Conversation context resets when the project changes. Unsupported files still have board cards; a file that cannot be read as text is explained from its metadata.

The app uses the configured endpoint's own account, pricing and privacy terms. Review which project code is attached before sending, especially in shared or sensitive repositories. External APIs, native model runtimes and advanced agent tools are not bundled.
