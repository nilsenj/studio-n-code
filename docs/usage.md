# Using studio-n-code

## Projects and navigation

Use the project widget in the header to open a folder, choose a recent project, open another window or close the current project. The left Project tool window shows the actual filesystem.

Double Shift opens Search Everywhere across filenames, workspace symbols and application actions. Ctrl+N filters workspace symbols to classes, interfaces, enums and structs. Ctrl+Shift+N opens file navigation, Ctrl+E recent files and Ctrl+Shift+A the full action palette.

## Editing and formatting

Code Board and AI Mode are available in the main toolbar and left rail. See [their guide](ai-board.md) for Git-backed cards, explanations, model setup and diff-reviewed edits. Commands show their running state and outcome in the toolbar/status bar; **Output > studio-n-code** keeps details.

- Ctrl+Alt+L reformats the document using the available formatter.
- Select lines and press Ctrl+Alt+I to reindent them.
- Ctrl+D duplicates a line or selection; Ctrl+Y deletes the line.
- Ctrl+W and Ctrl+Shift+W expand and shrink the selection.
- Alt+Enter opens intentions/code actions supplied by the language provider.
- Ctrl+B navigates to a definition; Alt+F7 finds references; Shift+F6 renames a symbol when supported.

These commands use real providers. Installing a syntax grammar alone does not supply advanced navigation, formatting or refactoring.

## Commit tool window

Open Commit with Ctrl+K or Alt+0.

1. Select the repository if the workspace has more than one.
2. Review the changed-file checklist. Click a filename to open its native diff.
3. Check only the files to include, enter a message and optionally enable Amend.
4. Click Commit to perform the actual Git commit.

Selection is per file, not per hunk. If an unselected file is already staged, the commit is refused so unrelated staged changes are not silently included. Include that staged file or unstage it before retrying. Unresolved merge conflicts must be resolved first. Git author identity is taken from that repository's normal Git configuration; the application does not invent or globally replace it.

If a commit fails after files have been staged, inspect the error and current Git state before retrying. Staging selected files is part of the explicit commit action.

## Git log

Open Git with Alt+9. The bottom tool window shows real local/remote branches, a parent-based graph and up to 200 commits. Use the text/hash filter to narrow the visible history. Choosing a branch in the branch list filters history; it does not check out the branch.

Select a commit to see its message and changed files. Open a file from those details to compare the commit with its first parent. A root commit is compared with the empty tree.

The header branch widget provides branch switching and VCS actions. Fetch, Update Project and Push operate on the selected repository and its real remotes. They are not performed automatically simply by viewing history.

## Run and debug

Use the run-configuration widget to select a project launch configuration or edit configurations. Shift+F10 runs, Shift+F9 debugs and Ctrl+F2 stops an active debug session.

Current JavaScript/TypeScript files use the Node debugger when no named launch configuration is selected. Other languages require their own runtime and debugger provider. The integrated terminal is available with Alt+F12.

## Settings, extensions and data

Ctrl+Alt+S opens settings. Search and install compatible extensions through Open VSX or install an author-provided VSIX. See [extension compatibility](extensions.md) for limitations. This project's release scripts do not publish extensions to a marketplace.

The installed app stores settings and extensions in its per-user profile. Development launchers use `.runtime/studio-n-code/` as described in [BUILDING.md](../BUILDING.md).

The Restore Tool Window Layout action resets the application's initial project/tool-window arrangement. It does not erase files or Git history.
