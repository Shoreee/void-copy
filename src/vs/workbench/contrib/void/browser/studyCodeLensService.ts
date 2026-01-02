/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { registerWorkbenchContribution2, WorkbenchPhase, IWorkbenchContribution } from '../../../common/contributions.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Range } from '../../../../editor/common/core/range.js';
import { CodeLens, CodeLensList } from '../../../../editor/common/languages.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { IStudyQTEService, LensAnnotation } from './studyQTEService.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { URI } from '../../../../base/common/uri.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';

// ============== Service Interface ==============

export interface IStudyCodeLensService {
	readonly _serviceBrand: undefined;

	/** Refresh CodeLens for a specific file */
	refreshLenses(uri: URI): void;

	/** Refresh all CodeLens */
	refreshAllLenses(): void;
}

export const IStudyCodeLensService = createDecorator<IStudyCodeLensService>('StudyCodeLensService');

// ============== Action for showing concept detail ==============

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.study.showConcept',
			title: localize2('showConcept', 'Show Concept'),
			f1: false,  // Don't show in command palette
		});
	}

	async run(accessor: ServicesAccessor, annotation: LensAnnotation): Promise<void> {
		const notificationService = accessor.get(INotificationService);

		// For now, show a notification with the concept info
		// In production, this would open a sidebar panel or modal with detailed explanation
		notificationService.info(`🎓 ${annotation.conceptName}\n\n${annotation.content}`);
	}
});

// ============== CodeLens Provider ==============

class StudyCodeLensProvider {
	constructor(
		private readonly _qteService: IStudyQTEService,
		private readonly _settingsService: IVoidSettingsService,
	) { }

	provideCodeLenses(model: ITextModel, token: CancellationToken): CodeLensList | null {
		// Only provide lenses in study mode
		if (this._settingsService.state.globalSettings.chatMode !== 'study') {
			return null;
		}

		const uri = model.uri;
		const annotations = this._qteService.getAnnotationsForFile(uri);

		if (annotations.length === 0) {
			return null;
		}

		const lenses: CodeLens[] = annotations.map(annotation => ({
			range: new Range(annotation.line, 1, annotation.line, 1),
			command: {
				id: 'void.study.showConcept',
				title: `🎓 ${annotation.conceptName}`,
				arguments: [annotation],
			},
		}));

		return {
			lenses,
			dispose: () => { },
		};
	}

	resolveCodeLens(model: ITextModel, codeLens: CodeLens, token: CancellationToken): CodeLens {
		// CodeLens is already resolved with command
		return codeLens;
	}
}

// ============== Service Implementation ==============

class StudyCodeLensService extends Disposable implements IStudyCodeLensService, IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.void.studyCodeLens';
	readonly _serviceBrand: undefined;

	private _provider: StudyCodeLensProvider | null = null;
	private _disposables = new DisposableStore();

	constructor(
		@ICodeEditorService private readonly _codeEditorService: ICodeEditorService,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IStudyQTEService private readonly _qteService: IStudyQTEService,
		@IVoidSettingsService private readonly _settingsService: IVoidSettingsService,
	) {
		super();

		this._registerProvider();
		this._registerListeners();
	}

	private _registerProvider(): void {
		this._provider = new StudyCodeLensProvider(this._qteService, this._settingsService);

		// Register the CodeLens provider for all languages
		const registration = this._languageFeaturesService.codeLensProvider.register(
			{ pattern: '**/*' },  // All files
			{
				provideCodeLenses: (model, token) => this._provider?.provideCodeLenses(model, token) ?? null,
				resolveCodeLens: (model, codeLens, token) => this._provider?.resolveCodeLens(model, codeLens, token) ?? codeLens,
			}
		);

		this._disposables.add(registration);
	}

	private _registerListeners(): void {
		// Refresh lenses when annotations change
		this._disposables.add(
			this._qteService.onDidChangeAnnotations((uri) => {
				this.refreshLenses(uri);
			})
		);

		// Refresh all lenses when mode changes
		this._disposables.add(
			this._settingsService.onDidChangeState(() => {
				this.refreshAllLenses();
			})
		);
	}

	refreshLenses(uri: URI): void {
		// Trigger a refresh by re-registering the provider
		// Monaco will re-query the provider for lenses
		for (const editor of this._codeEditorService.listCodeEditors()) {
			const model = editor.getModel();
			if (model && model.uri.toString() === uri.toString()) {
				// Force refresh by triggering a model change notification
				// This is a workaround - ideally Monaco would have a proper refresh API
				editor.trigger('void.study', 'editor.action.showHover', {});
			}
		}
	}

	refreshAllLenses(): void {
		for (const editor of this._codeEditorService.listCodeEditors()) {
			const model = editor.getModel();
			if (model) {
				this.refreshLenses(model.uri);
			}
		}
	}

	override dispose(): void {
		this._disposables.dispose();
		super.dispose();
	}
}

// Register service and workbench contribution
registerSingleton(IStudyCodeLensService, StudyCodeLensService, InstantiationType.Delayed);
registerWorkbenchContribution2(StudyCodeLensService.ID, StudyCodeLensService, WorkbenchPhase.AfterRestored);


