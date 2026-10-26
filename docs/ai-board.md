# Code Board and AI Mode

Open **Code Board** from the toolbar, left rail, View menu or Find Action. The board lists the current project's tracked and visible untracked files, directory areas, working changes and recent commits. Conventional `feat:` commits appear as feature cards. Search across the active category, click any card for its details, use **Open** to navigate to a file, or **Explain** on any card. Refresh after large changes. A folder without Git still shows workspace files; history and change cards require Git.

## Board details and explanations

Every card opens a keyboard-accessible details window; Escape closes it. File details include path, type, working-tree state and available file history. Change details also include the staged and unstaged diff. Areas list their member files. Feature and commit details show the source commit, author, author and commit dates, full hash, parents, changed files and bounded patch/history where Git provides it. Explain is available on every card and in every details window. Project context is sent only after you choose **Explain** or **Send**.

AI Mode uses up to 30,000 characters of bounded context. A file includes source; an area includes member names and representative source; a feature or commit includes a bounded Git patch. Long context is marked as truncated. A file that cannot be read as text is explained from its metadata.

## Connect a provider

Open **AI Mode > Connection**. Choose **OpenAI**, **Google Gemini**, or **Anthropic**, enter that provider's API key, then choose **Discover models**. The app filters out models that do not support text generation and presents the available choices. It selects a deterministic balanced recommendation when the provider's model information makes one identifiable; provider catalogs do not all publish a quality ranking, so the recommendation can use model-family naming. The model remains selectable. No model ID needs to be entered manually.

Each provider's key is stored separately in the editor's OS-backed SecretStorage and is never placed in project settings, prompts, logs, or release source. **Remove key** affects only the selected provider. Model discovery sends the provider key and makes no project-context request. Project content goes to the selected provider only after Ask, Explain, Plan, or Edit. No model subscription or key is bundled with the app.

## Work with AI

- **Ask:** question about the selected board item or active file.
- **Explain:** purpose, flow, dependencies and risks, grounded in the supplied code.
- **Plan:** an implementation plan based on the current context.
- **Edit file:** request a replacement for one selected or open file up to 50,000 characters. The complete current file is sent as context; larger files are rejected for whole-file edits. A complete streamed response and closed code fence are required before the app opens a diff. Choose **Apply edit** only after reviewing it. If the file changed since the proposal, Apply refuses and asks for a new proposal. The edit appears in the editor and remains unsaved until you save it; ordinary Undo works.

Responses stream into the panel. **Stop** cancels an active request; **Clear chat** drops the in-memory conversation. Errors appear in the panel. Conversation context resets when the project changes. The app uses the selected provider account, pricing and privacy terms. Review which project code is attached before sending, especially in shared or sensitive repositories. External APIs, native model runtimes and advanced agent tools are not bundled.
