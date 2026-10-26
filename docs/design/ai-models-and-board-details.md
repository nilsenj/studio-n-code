# AI Providers and Code Board Details

## Goal

Make AI Mode useful with the user’s own OpenAI, Google Gemini, or Anthropic API key, and make every Code Board entry inspectable and explainable. Keep the current Studio N visual language and store credentials in the editor’s OS-backed secret store.

## AI provider experience

- Replace the freeform endpoint and model ID fields with a provider selector, API key field, discovered-model selector, and refresh action.
- Use the official provider APIs for OpenAI, Gemini, and Anthropic. Fetch available models after a provider key is supplied; show only models suitable for text generation.
- Choose a balanced default from available provider model information when possible. Keep the model editable so users can select any discovered model.
- Store one key per provider in the existing secret store. Store provider and model preference in global state. Do not send project context during discovery; send context only after an explicit Ask, Explain, Plan, or Edit action.
- Preserve streaming output, cancellation, explanation, and safe edit preview/apply. Map provider-specific response formats into the current conversation interface.
- Report missing credentials, model-list failures, unsupported generation models, rate limits, and request errors in the AI panel without exposing keys.

## Board item details

- Clicking a card opens a shared, keyboard-accessible detail modal. Cards retain an explicit Explain action; the modal also provides Explain for every item kind.
- Files show path, language/type, working-tree status, and relevant Git history. Changed files include their status and available diff.
- Areas show the folder summary and member files. Features show their originating commit and related files. Commits show full hash, subject, author, author date, commit date, parents, changed-file summary, and the available patch/history.
- Explain sends the selected item’s bounded, relevant context only after the user activates it.
- Escape and the close button dismiss the modal; modal focus remains accessible to keyboard and assistive-technology users.

## File icons

Expand the existing Studio Outline Icons theme across common languages, frameworks, configuration files, build files, and lockfiles. Prefer recognizable extension-specific icons where assets are available and clear shared category icons for long-tail formats. Preserve folder icons and the current Studio styling.

## Boundaries

- Support the three named first-party providers in this iteration; avoid adding SDK dependencies where provider REST APIs and the existing `fetch` runtime suffice.
- Keep API keys out of workspace settings, logs, AI prompts, and model-list UI messages.
- Do not claim to select a vendor-designated “middle” tier unless that provider exposes ranking/capability metadata. If its API only lists IDs, use a documented, deterministic balanced-model preference and let users choose another discovered model.
- Continue to explain files, folders/areas, changed files, conventional features, and commits; do not make the details modal depend on Git for non-Git folders.

## Acceptance criteria

1. Each provider can securely save its own key, discover text-generation models, choose a balanced default where identifiable, and switch to any discovered model.
2. Ask, Explain, Plan, and Edit continue to work through each supported provider, with streaming/cancel behavior and safe edit preview intact.
3. Activating any file, area, change, feature, or commit opens details with relevant metadata; Explain works from every detail view.
4. Commit details expose author, timestamps, hash, changed files, and available history/patch data. Change details expose working-tree status and available diffs.
5. Common source, web, data, configuration, and build file types receive specific or category icons in the Studio icon theme.
6. Existing Code Board search, category counts, no-Git behavior, and Studio N visual styling remain intact.
