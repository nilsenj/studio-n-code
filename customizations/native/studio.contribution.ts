/* Copyright (c) studio-n-code contributors. Licensed under the MIT License. */
import './workbench.css';
import { mainWindow } from '../../../../base/browser/window.js';
import { $, append, addDisposableListener, EventType } from '../../../../base/browser/dom.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Action, SubmenuAction } from '../../../../base/common/actions.js';
import { localize } from '../../../../nls.js';
import { ICommandService, CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { getCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { EditorOption } from '../../../../editor/common/config/editorOptions.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

class StudioShell extends Disposable {
	static readonly ID = 'workbench.contrib.studioShell';

	constructor(
		@IWorkbenchLayoutService layout: IWorkbenchLayoutService,
		@ICommandService commands: ICommandService,
		@INotificationService notifications: INotificationService,
		@IContextMenuService menus: IContextMenuService,
		@IWorkspaceContextService workspace: IWorkspaceContextService,
		@IViewsService views: IViewsService,
		@IViewDescriptorService descriptors: IViewDescriptorService,
		@IContextKeyService contextKeys: IContextKeyService,
		@IEditorService editors: IEditorService,
		@ILanguageFeaturesService languageFeatures: ILanguageFeaturesService,
	) {
		super();
		const execute = (id: string, ...args: object[]) => commands.executeCommand(id, ...args).catch(error => notifications.error(error));
		const submenu = (id: string, label: string, entries: readonly (readonly [string, string])[]) => new SubmenuAction(`studio.menu.${id}`, label, entries.map(([title, command]) => this._register(new Action(command, title, undefined, true, () => execute(command)))));
		const mainMenu = [
			submenu('file', localize('studio.menu.file', "File"), [
				['New File', 'workbench.action.files.newUntitledFile'], ['Open Project…', 'studio.projects'], ['Recent Projects…', 'workbench.action.openRecent'], ['Save All', 'workbench.action.files.saveAll'], ['Settings…', 'studio.settings'], ['Close Project', 'workbench.action.closeFolder'], ['Exit', 'workbench.action.quit'],
			]),
			submenu('edit', localize('studio.menu.edit', "Edit"), [
				['Undo', 'undo'], ['Redo', 'redo'], ['Cut', 'editor.action.clipboardCutAction'], ['Copy', 'editor.action.clipboardCopyAction'], ['Paste', 'editor.action.clipboardPasteAction'], ['Find', 'actions.find'], ['Replace', 'studio.replace'], ['Find in Files…', 'studio.findInFiles'], ['Replace in Files…', 'studio.replaceInFiles'],
			]),
			submenu('view', localize('studio.menu.view', "View"), [
				['Tool Windows…', 'studio.toolWindows'], ['Project', 'studio.project'], ['Code Board', 'studio.codeBoard'], ['AI Mode', 'studio.aiMode'], ['Commit', 'studio.commit'], ['Git', 'studio.git'], ['Terminal', 'studio.terminal'], ['Problems', 'studio.problems'], ['Structure', 'studio.structure'], ['Distraction Free Mode', 'workbench.action.toggleZenMode'], ['Full Screen', 'workbench.action.toggleFullScreen'],
			]),
			submenu('navigate', localize('studio.menu.navigate', "Navigate"), [
				['Search Everywhere', 'studio.searchEverywhere'], ['Class…', 'studio.goToClass'], ['File…', 'studio.goToFile'], ['File Structure', 'studio.fileStructure'], ['Declaration or Definition', 'studio.goToDefinition'], ['Find Usages', 'studio.findUsages'], ['Recent Files', 'studio.recentFiles'], ['Back', 'studio.back'], ['Forward', 'studio.forward'], ['Last Edit Location', 'studio.lastEdit'], ['Line…', 'studio.goToLine'],
			]),
			submenu('code', localize('studio.menu.code', "Code"), [
				['Show Intention Actions', 'studio.quickFix'], ['Reformat Code', 'studio.format'], ['Optimize Imports', 'studio.organizeImports'], ['Auto-Indent Lines', 'studio.indent'], ['Comment with Line Comment', 'studio.lineComment'], ['Comment with Block Comment', 'studio.blockComment'], ['Extend Selection', 'studio.expandSelection'], ['Shrink Selection', 'studio.shrinkSelection'],
			]),
			submenu('refactor', localize('studio.menu.refactor', "Refactor"), [
				['Refactor This…', 'editor.action.refactor'], ['Rename…', 'studio.rename'],
			]),
			submenu('run', localize('studio.menu.run', "Run"), [
				['Run', 'studio.run'], ['Debug', 'studio.debug'], ['Stop', 'studio.stop'], ['Run/Debug Configurations…', 'studio.runConfigurations'], ['Resume Program', 'studio.resume'], ['Step Over', 'studio.stepOver'], ['Step Into', 'studio.stepInto'], ['Step Out', 'studio.stepOut'], ['Toggle Line Breakpoint', 'studio.breakpoint'],
			]),
			submenu('tools', localize('studio.menu.tools', "Tools"), [
				['Code Board', 'studio.codeBoard'], ['AI Mode', 'studio.aiMode'], ['Terminal', 'studio.terminal'], ['Run Task…', 'workbench.action.tasks.runTask'], ['Plugins', 'workbench.view.extensions'], ['Find Action…', 'studio.findAction'],
			]),
			submenu('git', localize('studio.menu.git', "Git"), [
				['Commit…', 'studio.commit'], ['Push…', 'studio.push'], ['Update Project…', 'studio.updateProject'], ['Branches…', 'studio.branches'], ['Show Git Log', 'studio.git'], ['Fetch', 'git.fetch'], ['Stash Changes…', 'git.stash'], ['Unstash Changes…', 'git.stashPop'],
			]),
			submenu('window', localize('studio.menu.window', "Window"), [
				['Next Editor Tab', 'studio.nextTab'], ['Previous Editor Tab', 'studio.previousTab'], ['Split Right', 'workbench.action.splitEditorRight'], ['Close Active Editor', 'studio.closeTab'], ['Restore Tool Window Layout', 'studio.restoreLayout'],
			]),
			submenu('help', localize('studio.menu.help', "Help"), [
				['Find Action…', 'studio.findAction'], ['Keyboard Shortcuts', 'workbench.action.openGlobalKeybindings'], ['About', 'workbench.action.showAboutDialog'],
			]),
		];
		const own = (element: HTMLElement) => { this._register(toDisposable(() => element.remove())); return element; };
		const feedback = own(append(layout.mainContainer, $('.studio-command-feedback')));
		feedback.setAttribute('role', 'status');
		feedback.setAttribute('aria-live', 'polite');
		feedback.hidden = true;
		let feedbackTimeout: ReturnType<typeof setTimeout> | undefined;
		this._register(toDisposable(() => clearTimeout(feedbackTimeout)));
		this._register(CommandsRegistry.registerCommand('studio.nativeActionFeedback', (_accessor, event: { id?: string; title?: string; message?: string; phase?: string; key?: string }) => {
			if (!event || typeof event.title !== 'string' || typeof event.message !== 'string') { return; }
			clearTimeout(feedbackTimeout);
			feedback.hidden = false;
			feedback.dataset.phase = event.phase;
			feedback.replaceChildren();
			append(feedback, $('strong', undefined, event.title.slice(0, 100)));
			append(feedback, $('span', undefined, event.message.slice(0, 250)));
			if (event.key) { append(feedback, $('kbd', undefined, event.key)); }
			for (const button of layout.mainContainer.querySelectorAll<HTMLElement>('[data-studio-command]')) {
				if (button.dataset.studioCommand === event.id) {
					button.classList.toggle('command-running', event.phase === 'running');
					button.setAttribute('aria-busy', String(event.phase === 'running'));
				}
			}
			if (event.phase !== 'running') { feedbackTimeout = setTimeout(() => feedback.hidden = true, event.phase === 'error' || event.phase === 'unavailable' ? 7000 : 3200); }
		}));
		this._register(CommandsRegistry.registerCommand('studio.nativeCapabilities', () => {
			const editor = getCodeEditor(editors.activeTextEditorControl);
			const model = editor?.getModel();
			if (editor && model) {
				return { format: languageFeatures.documentFormattingEditProvider.has(model), rename: languageFeatures.renameProvider.has(model), definition: languageFeatures.definitionProvider.has(model), references: languageFeatures.referenceProvider.has(model), readonly: editor.getOption(EditorOption.readOnly) };
			}
			const context = contextKeys.getContext(mainWindow.document.activeElement);
			return {
				format: context.getValue<boolean>('editorHasDocumentFormattingProvider'),
				rename: context.getValue<boolean>('editorHasRenameProvider'),
				definition: context.getValue<boolean>('editorHasDefinitionProvider'),
				references: context.getValue<boolean>('editorHasReferenceProvider'),
				readonly: context.getValue<boolean>('editorReadonly'),
			};
		}));
		const makeButton = (container: HTMLElement, icon: string, title: string, action: () => void, text?: string) => {
			const button = append(container, $('button.studio-control'));
			button.setAttribute('type', 'button');
			button.setAttribute('aria-label', title);
			button.title = title;
			if (icon) { append(button, $(`span.codicon.codicon-${icon}`)); }
			if (text) { append(button, $('span.studio-label', undefined, text)); }
			this._register(addDisposableListener(button, EventType.CLICK, action));
			return button;
		};
		const titlebar = layout.getContainer(mainWindow, Parts.TITLEBAR_PART);
		if (titlebar) {
			const header = own(append(titlebar, $('.studio-header')));
			header.setAttribute('role', 'toolbar');
			header.setAttribute('aria-label', localize('studio.header', "Main Toolbar"));
			const menu = makeButton(header, 'menu', localize('studio.menu', "Main Menu"), () => {
				menus.showContextMenu({ getActions: () => mainMenu, getAnchor: () => menu });
			});
			const project = makeButton(header, '', localize('studio.project', "Open or Switch Project"), () => { void execute('studio.projects'); });
			project.classList.add('studio-project-widget');
			project.dataset.studioCommand = 'studio.projects';
			const badge = append(project, $('span.studio-project-badge'));
			const projectName = append(project, $('span.studio-label'));
			append(project, $('span.codicon.codicon-chevron-down'));
			const updateProject = () => {
				const name = workspace.getWorkspace().folders[0]?.name || localize('studio.noProject', "studio-n-code");
				projectName.textContent = name;
				badge.textContent = name.split(/[-_\s]+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
			};
			updateProject();
			this._register(workspace.onDidChangeWorkspaceFolders(updateProject));
			const branch = makeButton(header, 'git-branch', localize('studio.vcs', "Branches and VCS Actions"), () => { void execute('studio.branches'); }, localize('studio.branch', "Git"));
			branch.classList.add('studio-vcs-widget'); append(branch, $('span.codicon.codicon-chevron-down'));
			branch.dataset.studioCommand = 'studio.branches';
			append(header, $('.studio-header-spacer'));
			const run = makeButton(header, '', localize('studio.configurations', "Run/Debug Configurations"), () => { void execute('studio.runConfigurations'); }, localize('studio.currentFile', "Current File"));
			run.classList.add('studio-run-widget'); append(run, $('span.codicon.codicon-chevron-down'));
			run.dataset.studioCommand = 'studio.runConfigurations';
			const runButton = makeButton(header, 'play', localize('studio.run', "Run (Shift+F10)"), () => { void execute('studio.run'); });
			runButton.classList.add('studio-run'); runButton.dataset.studioCommand = 'studio.run';
			const debugButton = makeButton(header, 'debug-alt', localize('studio.debug', "Debug (Shift+F9)"), () => { void execute('studio.debug'); });
			debugButton.classList.add('studio-run'); debugButton.dataset.studioCommand = 'studio.debug';
			makeButton(header, 'debug-stop', localize('studio.stop', "Stop (Ctrl+F2)"), () => { void execute('studio.stop'); }).dataset.studioCommand = 'studio.stop';
			append(header, $('.studio-header-divider'));
			makeButton(header, 'search', localize('studio.search', "Search Everywhere (Double Shift)"), () => { void execute('studio.searchEverywhere'); });
			makeButton(header, 'layout', localize('studio.board', "Code Board"), () => { void execute('studio.codeBoard'); }, localize('studio.boardShort', "Board")).dataset.studioCommand = 'studio.codeBoard';
			makeButton(header, 'sparkle', localize('studio.aiMode', "AI Mode"), () => { void execute('studio.aiMode'); }, localize('studio.aiShort', "AI")).dataset.studioCommand = 'studio.aiMode';
			makeButton(header, 'settings-gear', localize('studio.settings', "Settings (Ctrl+Alt+S)"), () => { void execute('studio.settings'); });
			this._register(CommandsRegistry.registerCommand('studio.nativeHeaderState', (_accessor, value: { branch?: string; project?: string; run?: string }) => {
				if (typeof value?.branch === 'string') { branch.querySelector('.studio-label')!.textContent = value.branch.slice(0, 100); }
				if (typeof value?.run === 'string') { run.querySelector('.studio-label')!.textContent = value.run.slice(0, 100); }
			}));
		}

		const activitybar = layout.getContainer(mainWindow, Parts.ACTIVITYBAR_PART);
		const left = activitybar ? own(append(activitybar, $('.studio-left-rail.studio-rail'))) : undefined;
		const right = own(append(layout.mainContainer, $('.studio-right-rail.studio-rail')));
		const railItems: { button: HTMLElement; view?: string; container?: string }[] = [];
		const tool = (container: HTMLElement, icon: string, title: string, command: string, view?: string, containerId?: string) => {
			const button = makeButton(container, icon, title, () => {
				if (view && views.isViewVisible(view)) { views.closeView(view); }
				else if (containerId && views.isViewContainerVisible(containerId)) { views.closeViewContainer(containerId); }
				else { void execute(command); }
			});
			button.dataset.studioCommand = command;
			railItems.push({ button, view, container: containerId });
		};
		if (left) {
			tool(left, 'folder', localize('studio.projectTool', "Project (Alt+1)"), 'studio.project', undefined, 'workbench.view.explorer');
			tool(left, 'git-commit', localize('studio.commitTool', "Commit (Alt+0)"), 'studio.commit', 'studio.commitView');
			tool(left, 'list-tree', localize('studio.structureTool', "Structure (Alt+7)"), 'studio.structure', 'outline');
			tool(left, 'layout', localize('studio.boardTool', "Code Board"), 'studio.codeBoard');
			tool(left, 'sparkle', localize('studio.aiTool', "AI Mode"), 'studio.aiMode');
			append(left, $('.studio-rail-separator'));
			tool(left, 'extensions', localize('studio.plugins', "Plugins"), 'workbench.view.extensions', undefined, 'workbench.view.extensions');
			tool(left, 'ellipsis', localize('studio.tools', "More Tool Windows"), 'studio.toolWindows');
			const bottom = append(left, $('.studio-rail-bottom'));
			tool(bottom, 'run-all', localize('studio.runTool', "Run (Alt+4)"), 'workbench.view.debug', undefined, 'workbench.view.debug');
			tool(bottom, 'terminal', localize('studio.terminalTool', "Terminal (Alt+F12)"), 'studio.terminal', 'terminal');
			tool(bottom, 'warning', localize('studio.problemsTool', "Problems (Alt+6)"), 'studio.problems', 'workbench.panel.markers');
			tool(bottom, 'git-branch', localize('studio.gitTool', "Git (Alt+9)"), 'studio.git', 'studio.gitLog');
		}
		tool(right, 'bell', localize('studio.notifications', "Notifications"), 'notifications.showList');
		tool(right, 'symbol-class', localize('studio.structure', "Structure"), 'studio.structure', 'outline');
		const rightBottom = append(right, $('.studio-rail-bottom'));
		tool(rightBottom, 'debug-alt', localize('studio.debugTool', "Debug (Alt+5)"), 'workbench.view.debug');
		const updateRails = () => {
			for (const item of railItems) {
				const active = item.view ? views.isViewVisible(item.view) : item.container ? views.isViewContainerVisible(item.container) : false;
				item.button.classList.toggle('active', active);
				item.button.setAttribute('aria-pressed', String(active));
			}
		};
		this._register(views.onDidChangeViewVisibility(updateRails));
		this._register(views.onDidChangeViewContainerVisibility(updateRails));
		updateRails();
		this._register(CommandsRegistry.registerCommand('studio.nativeStructure', async () => {
			const outline = descriptors.getViewDescriptorById('outline');
			if (outline) { descriptors.moveViewToLocation(outline, ViewContainerLocation.AuxiliaryBar, 'studio.structure'); await views.openView('outline', true); }
		}));
		this._register(CommandsRegistry.registerCommand('studio.nativeHideToolWindow', () => {
			for (const part of [Parts.PANEL_PART, Parts.AUXILIARYBAR_PART, Parts.SIDEBAR_PART]) {
				if (layout.hasFocus(part)) { layout.setPartHidden(true, part); break; }
			}
		}));
		let lastShift = 0;
		let bareShift = false;
		this._register(addDisposableListener(mainWindow, EventType.KEY_DOWN, (event: KeyboardEvent) => {
			if (event.key === 'Shift' && !event.repeat) { bareShift = !event.ctrlKey && !event.altKey && !event.metaKey; }
			else { bareShift = false; lastShift = 0; }
		}));
		this._register(addDisposableListener(mainWindow, EventType.KEY_UP, (event: KeyboardEvent) => {
			if (event.key !== 'Shift' || !bareShift) { return; }
			bareShift = false;
			const now = Date.now();
			if (now - lastShift < 400) { lastShift = 0; void execute('studio.searchEverywhere'); }
			else { lastShift = now; }
		}));
	}
}
registerWorkbenchContribution2(StudioShell.ID, StudioShell, WorkbenchPhase.AfterRestored);
