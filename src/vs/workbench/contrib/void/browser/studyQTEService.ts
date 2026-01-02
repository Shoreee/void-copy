/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ICodeEditor, IViewZone } from '../../../../editor/browser/editorBrowser.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { URI } from '../../../../base/common/uri.js';

import type { QTEType, QTEDifficulty, QTEOption } from '../common/studyModeParser.js';

// ============== Types ==============

export interface QTEOptions {
	/** Type of QTE interaction */
	type: QTEType;
	/** Difficulty level */
	difficulty: QTEDifficulty;
	/** Question text */
	question: string;
	/** Available options for choice/parsons types */
	options?: QTEOption[];
	/** Optional hint */
	hint?: string;
	/** Target line in editor (optional) */
	targetLine?: number;
	/** Target editor ID (optional) */
	editorId?: string;
	/** Time limit in seconds (optional) */
	timeLimit?: number;
	/** URI of the file */
	uri?: URI;
}

export interface QTEInstance {
	/** Unique ID for this QTE */
	id: string;
	/** QTE options */
	options: QTEOptions;
	/** When the QTE was created */
	createdAt: number;
	/** Current status */
	status: 'pending' | 'answered' | 'timeout' | 'dismissed';
	/** Selected answer (if answered) */
	selectedOption?: string;
	/** Whether the answer was correct (for quizzes) */
	isCorrect?: boolean;
}

export interface QTECreatedEvent {
	qte: QTEInstance;
}

export interface QTESubmittedEvent {
	qteId: string;
	selectedOption: string;
	qte: QTEInstance;
}

export interface QTEDismissedEvent {
	qteId: string;
	reason: 'timeout' | 'user' | 'system';
}

export interface LensAnnotation {
	/** Unique ID */
	id: string;
	/** File URI */
	uri: URI;
	/** Line number */
	line: number;
	/** Concept name */
	conceptName: string;
	/** Explanation content */
	content: string;
}

// ============== Service Interface ==============

export interface IStudyQTEService {
	readonly _serviceBrand: undefined;

	// QTE Management
	createQTE(options: QTEOptions): Promise<QTEInstance>;
	submitQTEResponse(qteId: string, selectedOption: string): void;
	dismissQTE(qteId: string, reason?: 'user' | 'system'): void;
	getQTE(qteId: string): QTEInstance | undefined;
	getActiveQTEs(): QTEInstance[];

	// Lens Annotations
	addAnnotation(annotation: Omit<LensAnnotation, 'id'>): string;
	removeAnnotation(id: string): void;
	getAnnotationsForFile(uri: URI): LensAnnotation[];
	clearAnnotationsForFile(uri: URI): void;

	// Events
	readonly onDidCreateQTE: Event<QTECreatedEvent>;
	readonly onDidSubmitQTE: Event<QTESubmittedEvent>;
	readonly onDidDismissQTE: Event<QTEDismissedEvent>;
	readonly onDidChangeAnnotations: Event<URI>;
}

export const IStudyQTEService = createDecorator<IStudyQTEService>('StudyQTEService');

// ============== Service Implementation ==============

const ANNOTATION_STORAGE_KEY = 'void.study.annotations';

class StudyQTEService extends Disposable implements IStudyQTEService {
	readonly _serviceBrand: undefined;

	// QTE state
	private _qteInstances: Map<string, QTEInstance> = new Map();
	private _qteTimeouts: Map<string, NodeJS.Timeout> = new Map();

	// Annotations state
	private _annotations: Map<string, LensAnnotation> = new Map();
	private _annotationsByUri: Map<string, Set<string>> = new Map();

	// ViewZone state for editor integration
	private _viewZones: Map<string, { editor: ICodeEditor; zoneId: string; dispose: () => void }> = new Map();

	// Events
	private readonly _onDidCreateQTE = this._register(new Emitter<QTECreatedEvent>());
	readonly onDidCreateQTE = this._onDidCreateQTE.event;

	private readonly _onDidSubmitQTE = this._register(new Emitter<QTESubmittedEvent>());
	readonly onDidSubmitQTE = this._onDidSubmitQTE.event;

	private readonly _onDidDismissQTE = this._register(new Emitter<QTEDismissedEvent>());
	readonly onDidDismissQTE = this._onDidDismissQTE.event;

	private readonly _onDidChangeAnnotations = this._register(new Emitter<URI>());
	readonly onDidChangeAnnotations = this._onDidChangeAnnotations.event;

	constructor(
		@ICodeEditorService private readonly _codeEditorService: ICodeEditorService,
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();

		// Load persisted annotations
		this._loadAnnotations();
	}

	// ============== QTE Management ==============

	async createQTE(options: QTEOptions): Promise<QTEInstance> {
		const id = generateUuid();
		const qte: QTEInstance = {
			id,
			options,
			createdAt: Date.now(),
			status: 'pending',
		};

		this._qteInstances.set(id, qte);

		// Set up timeout if specified
		if (options.timeLimit) {
			const timeout = setTimeout(() => {
				this._handleQTETimeout(id);
			}, options.timeLimit * 1000);
			this._qteTimeouts.set(id, timeout);
		}

		// Create ViewZone in editor if target is specified
		if (options.editorId && options.targetLine !== undefined) {
			await this._createEditorViewZone(id, qte);
		}

		this._onDidCreateQTE.fire({ qte });

		return qte;
	}

	submitQTEResponse(qteId: string, selectedOption: string): void {
		const qte = this._qteInstances.get(qteId);
		if (!qte || qte.status !== 'pending') {
			return;
		}

		// Clear timeout
		const timeout = this._qteTimeouts.get(qteId);
		if (timeout) {
			clearTimeout(timeout);
			this._qteTimeouts.delete(qteId);
		}

		// Update QTE
		qte.status = 'answered';
		qte.selectedOption = selectedOption;

		// Check if correct (if applicable)
		// This would need additional logic based on the QTE type

		// Remove ViewZone
		this._removeEditorViewZone(qteId);

		this._onDidSubmitQTE.fire({ qteId, selectedOption, qte });
	}

	dismissQTE(qteId: string, reason: 'user' | 'system' = 'user'): void {
		const qte = this._qteInstances.get(qteId);
		if (!qte) return;

		// Clear timeout
		const timeout = this._qteTimeouts.get(qteId);
		if (timeout) {
			clearTimeout(timeout);
			this._qteTimeouts.delete(qteId);
		}

		qte.status = 'dismissed';

		// Remove ViewZone
		this._removeEditorViewZone(qteId);

		this._onDidDismissQTE.fire({ qteId, reason });
	}

	getQTE(qteId: string): QTEInstance | undefined {
		return this._qteInstances.get(qteId);
	}

	getActiveQTEs(): QTEInstance[] {
		return Array.from(this._qteInstances.values()).filter(q => q.status === 'pending');
	}

	// ============== Lens Annotations ==============

	addAnnotation(annotation: Omit<LensAnnotation, 'id'>): string {
		const id = generateUuid();
		const fullAnnotation: LensAnnotation = { ...annotation, id };

		this._annotations.set(id, fullAnnotation);

		// Index by URI
		const uriKey = annotation.uri.toString();
		if (!this._annotationsByUri.has(uriKey)) {
			this._annotationsByUri.set(uriKey, new Set());
		}
		this._annotationsByUri.get(uriKey)!.add(id);

		this._saveAnnotations();
		this._onDidChangeAnnotations.fire(annotation.uri);

		return id;
	}

	removeAnnotation(id: string): void {
		const annotation = this._annotations.get(id);
		if (!annotation) return;

		this._annotations.delete(id);

		const uriKey = annotation.uri.toString();
		this._annotationsByUri.get(uriKey)?.delete(id);

		this._saveAnnotations();
		this._onDidChangeAnnotations.fire(annotation.uri);
	}

	getAnnotationsForFile(uri: URI): LensAnnotation[] {
		const uriKey = uri.toString();
		const ids = this._annotationsByUri.get(uriKey);
		if (!ids) return [];

		return Array.from(ids)
			.map(id => this._annotations.get(id))
			.filter((a): a is LensAnnotation => a !== undefined);
	}

	clearAnnotationsForFile(uri: URI): void {
		const uriKey = uri.toString();
		const ids = this._annotationsByUri.get(uriKey);
		if (!ids) return;

		for (const id of ids) {
			this._annotations.delete(id);
		}
		this._annotationsByUri.delete(uriKey);

		this._saveAnnotations();
		this._onDidChangeAnnotations.fire(uri);
	}

	// ============== Private Methods ==============

	private _handleQTETimeout(qteId: string): void {
		const qte = this._qteInstances.get(qteId);
		if (!qte || qte.status !== 'pending') return;

		qte.status = 'timeout';
		this._qteTimeouts.delete(qteId);

		// Remove ViewZone
		this._removeEditorViewZone(qteId);

		this._onDidDismissQTE.fire({ qteId, reason: 'timeout' });
	}

	private async _createEditorViewZone(qteId: string, qte: QTEInstance): Promise<void> {
		const { editorId, targetLine } = qte.options;
		if (!editorId || targetLine === undefined) return;

		const editor = this._codeEditorService.listCodeEditors().find(e => e.getId() === editorId);
		if (!editor) return;

		const domNode = document.createElement('div');
		domNode.className = 'void-qte-viewzone';
		domNode.style.zIndex = '10';
		domNode.style.backgroundColor = 'var(--vscode-editor-background)';
		domNode.style.borderLeft = '3px solid #2DD4BF';
		domNode.style.padding = '12px';
		domNode.style.margin = '4px 0';

		// Note: In production, this would mount a React component
		// For now, create a simple placeholder
		domNode.innerHTML = `
			<div style="font-size: 14px; color: var(--vscode-foreground);">
				<div style="margin-bottom: 8px; font-weight: bold;">🎯 ${qte.options.question}</div>
				<div style="display: flex; gap: 8px; flex-wrap: wrap;">
					${(qte.options.options || []).map(opt => `
						<button
							data-qte-id="${qteId}"
							data-option-id="${opt.id}"
							style="
								padding: 8px 16px;
								border: 1px solid #2DD4BF;
								border-radius: 4px;
								background: transparent;
								color: var(--vscode-foreground);
								cursor: pointer;
							"
						>
							${opt.id.toUpperCase()}: ${opt.text}
						</button>
					`).join('')}
				</div>
			</div>
		`;

		// Add click handlers
		domNode.querySelectorAll('button').forEach(btn => {
			btn.addEventListener('click', () => {
				const optionId = btn.getAttribute('data-option-id');
				if (optionId) {
					this.submitQTEResponse(qteId, optionId);
				}
			});
		});

		const viewZone: IViewZone = {
			afterLineNumber: targetLine - 1,
			domNode,
			heightInPx: 100,
			suppressMouseDown: false,
		};

		let zoneId: string | null = null;
		editor.changeViewZones(accessor => {
			zoneId = accessor.addZone(viewZone);
		});

		if (zoneId) {
			this._viewZones.set(qteId, {
				editor,
				zoneId,
				dispose: () => {
					editor.changeViewZones(accessor => {
						if (zoneId) accessor.removeZone(zoneId);
					});
				}
			});
		}
	}

	private _removeEditorViewZone(qteId: string): void {
		const zone = this._viewZones.get(qteId);
		if (zone) {
			zone.dispose();
			this._viewZones.delete(qteId);
		}
	}

	private _loadAnnotations(): void {
		try {
			const data = this._storageService.get(ANNOTATION_STORAGE_KEY, StorageScope.WORKSPACE);
			if (data) {
				const annotations: LensAnnotation[] = JSON.parse(data);
				for (const ann of annotations) {
					ann.uri = URI.parse(ann.uri.toString());
					this._annotations.set(ann.id, ann);

					const uriKey = ann.uri.toString();
					if (!this._annotationsByUri.has(uriKey)) {
						this._annotationsByUri.set(uriKey, new Set());
					}
					this._annotationsByUri.get(uriKey)!.add(ann.id);
				}
			}
		} catch (e) {
			console.error('Failed to load study annotations:', e);
		}
	}

	private _saveAnnotations(): void {
		try {
			const annotations = Array.from(this._annotations.values());
			this._storageService.store(
				ANNOTATION_STORAGE_KEY,
				JSON.stringify(annotations),
				StorageScope.WORKSPACE,
				StorageTarget.USER
			);
		} catch (e) {
			console.error('Failed to save study annotations:', e);
		}
	}

	override dispose(): void {
		// Clear all timeouts
		for (const timeout of this._qteTimeouts.values()) {
			clearTimeout(timeout);
		}

		// Remove all ViewZones
		for (const zone of this._viewZones.values()) {
			zone.dispose();
		}

		super.dispose();
	}
}

// Register the service
registerSingleton(IStudyQTEService, StudyQTEService, InstantiationType.Delayed);


