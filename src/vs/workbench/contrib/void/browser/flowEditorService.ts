/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Position } from '../../../../editor/common/core/position.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

import {
	FlowSession,
	FlowPoint,
	FlowBranch,
	FlowPointResult,
	FlowSessionResult,
	BranchMatchResult,
	ParsedFlowPoint,
	ParseFlowPointsResult,
	FlowPointReachedEvent,
	TimeoutWarningEvent,
	DEFAULT_FLOW_TIMEOUT,
	FLOW_TIMEOUT_WARNING,
} from './flowEditorTypes.js';

import { IStudyProfileService } from './studyProfileService.js';

// ============== Service Interface ==============

export interface IFlowEditorService {
	readonly _serviceBrand: undefined;

	// Session state
	readonly currentSession: FlowSession | null;
	readonly isSessionActive: boolean;

	// Session management
	startSession(file: string, content: string): Promise<string>;
	endSession(outcome: 'completed' | 'cancelled'): FlowSessionResult | null;
	skipCurrentPoint(): void;

	// User interaction
	handleUserInput(input: string): BranchMatchResult;
	acceptCurrentSuggestion(): void;

	// Navigation
	focusCurrentFlowPoint(): Promise<void>;

	// Events
	readonly onDidChangeSession: Event<FlowSession | null>;
	readonly onDidReachFlowPoint: Event<FlowPointReachedEvent>;
	readonly onDidComplete: Event<FlowSessionResult>;
	readonly onTimeoutWarning: Event<TimeoutWarningEvent>;
}

export const IFlowEditorService = createDecorator<IFlowEditorService>('FlowEditorService');

// ============== Service Implementation ==============

class FlowEditorService extends Disposable implements IFlowEditorService {
	readonly _serviceBrand: undefined;

	private _currentSession: FlowSession | null = null;
	private _sessionIdCounter: number = 0;
	private _timeoutTimer: NodeJS.Timeout | null = null;
	private _warningTimer: NodeJS.Timeout | null = null;
	private _pointResults: FlowPointResult[] = [];

	// Events
	private readonly _onDidChangeSession = this._register(new Emitter<FlowSession | null>());
	readonly onDidChangeSession = this._onDidChangeSession.event;

	private readonly _onDidReachFlowPoint = this._register(new Emitter<FlowPointReachedEvent>());
	readonly onDidReachFlowPoint = this._onDidReachFlowPoint.event;

	private readonly _onDidComplete = this._register(new Emitter<FlowSessionResult>());
	readonly onDidComplete = this._onDidComplete.event;

	private readonly _onTimeoutWarning = this._register(new Emitter<TimeoutWarningEvent>());
	readonly onTimeoutWarning = this._onTimeoutWarning.event;

	constructor(
		@IEditorService private readonly _editorService: IEditorService,
		@IStudyProfileService private readonly _studyProfileService: IStudyProfileService,
		@ILanguageFeaturesService private readonly _langFeatureService: ILanguageFeaturesService,
		@IModelService _modelService: IModelService, // Reserved for future use
		@IFileService private readonly _fileService: IFileService,
	) {
		super();
		this._registerGhostTextProvider();
	}

	// ============== Getters ==============

	get currentSession(): FlowSession | null {
		return this._currentSession;
	}

	get isSessionActive(): boolean {
		return this._currentSession !== null &&
			['streaming', 'waiting', 'user_typing', 'matched', 'completing'].includes(this._currentSession.status);
	}

	// ============== Ghost Text Provider ==============

	private _registerGhostTextProvider(): void {
		this._register(this._langFeatureService.inlineCompletionsProvider.register('*', {
			provideInlineCompletions: async (model: ITextModel, position: Position) => {
				// Only provide completions when we have an active session waiting for input
				if (!this._currentSession || this._currentSession.status !== 'waiting') {
					return { items: [] };
				}

				const currentPoint = this._currentSession.points[this._currentSession.currentPointIndex];
				if (!currentPoint) {
					return { items: [] };
				}

				// Check if we're in the correct file
				const currentUri = model.uri;
				const sessionUri = URI.file(this._currentSession.file);
				const isMatchingFile = currentUri.fsPath === sessionUri.fsPath ||
					currentUri.fsPath.endsWith(this._currentSession.file);

				if (!isMatchingFile) {
					return { items: [] };
				}

				// Check if we're near the correct line
				const pointLine = currentPoint.line;
				const currentLine = position.lineNumber;
				if (Math.abs(currentLine - pointLine) > 3) {
					return { items: [] };
				}

				// Get user's current input on this line
				const lineContent = model.getLineContent(currentLine);
				const userInput = lineContent.slice(currentPoint.column - 1, position.column - 1);

				// Update session status
				if (userInput.length > 0 && this._currentSession.status === 'waiting') {
					this._currentSession.status = 'user_typing';
					this._onDidChangeSession.fire(this._currentSession);
				}

				// Match against branches
				const matchResult = this._matchBranches(userInput, currentPoint.branches);

				let ghostText: string;
				if (matchResult.matched && matchResult.remainingCode) {
					ghostText = matchResult.remainingCode;
					this._currentSession.selectedBranches.set(currentPoint.id, matchResult.branchId!);
					if (matchResult.matchQuality === 'full') {
						this._currentSession.status = 'matched';
						this._onDidChangeSession.fire(this._currentSession);
					}
				} else {
					// Show default code as ghost text
					ghostText = currentPoint.defaultCode.slice(userInput.length);
				}

				// Don't show ghost text if nothing to complete
				if (!ghostText || ghostText.length === 0) {
					return { items: [] };
				}

				return {
					items: [{
						insertText: ghostText,
						range: new Range(
							position.lineNumber,
							position.column,
							position.lineNumber,
							position.column
						),
						command: {
							id: 'void.flowEditor.accept',
							title: 'Accept Flow Suggestion',
						}
					}]
				};
			},
			freeInlineCompletions: () => {
				// Called when inline completions are dismissed
			}
		}));
	}

	// ============== Session Management ==============

	async startSession(file: string, content: string): Promise<string> {
		// End any existing session
		if (this._currentSession && this.isSessionActive) {
			this.endSession('cancelled');
		}

		// Parse flow points from content
		const { cleanCode, flowPoints } = this._parseFlowPoints(content);

		// If no flow points, just write the file normally
		if (flowPoints.length === 0) {
			await this._writeFile(file, cleanCode);
			return '';
		}

		// Create session
		const sessionId = `flow-${++this._sessionIdCounter}-${Date.now()}`;

		// Calculate line/column positions for each flow point
		const points: FlowPoint[] = flowPoints.map((parsed, index) => {
			const beforeMarker = cleanCode.slice(0, parsed.startOffset);
			const lines = beforeMarker.split('\n');
			const line = lines.length;
			const column = (lines[lines.length - 1]?.length || 0) + 1;

			return {
				id: `point-${index}`,
				file,
				line,
				column,
				...parsed.point,
			};
		});

		this._currentSession = {
			id: sessionId,
			file,
			points,
			currentPointIndex: 0,
			status: 'streaming',
			userInputs: new Map(),
			selectedBranches: new Map(),
			startTime: Date.now(),
			codeWritten: '',
		};

		this._pointResults = [];

		// Notify listeners
		this._onDidChangeSession.fire(this._currentSession);

		// Start writing code up to first flow point
		await this._writeCodeUntilNextFlowPoint(cleanCode);

		return sessionId;
	}

	endSession(outcome: 'completed' | 'cancelled'): FlowSessionResult | null {
		if (!this._currentSession) {
			return null;
		}

		// Clear timers
		this._clearTimers();

		const session = this._currentSession;
		const totalTime = (Date.now() - session.startTime) / 1000;

		// Calculate summary
		const completedByUser = this._pointResults.filter(r => r.outcome === 'completed').length;
		const timeouts = this._pointResults.filter(r => r.outcome === 'timeout').length;
		const skipped = this._pointResults.filter(r => r.outcome === 'skipped').length;
		const skills = [...new Set(this._pointResults.map(r => r.skill))];
		const avgTime = this._pointResults.length > 0
			? this._pointResults.reduce((sum, r) => sum + r.timeTaken, 0) / this._pointResults.length
			: 0;

		const result: FlowSessionResult = {
			sessionId: session.id,
			file: session.file,
			pointResults: this._pointResults,
			totalTime,
			summary: {
				totalPoints: session.points.length,
				completedByUser,
				timeouts,
				skipped,
				averageResponseTime: avgTime,
				skills,
			},
		};

		// Update session status
		session.status = outcome === 'completed' ? 'completed' : 'cancelled';

		// Clear session
		this._currentSession = null;

		// Notify listeners
		this._onDidChangeSession.fire(null);
		this._onDidComplete.fire(result);

		return result;
	}

	skipCurrentPoint(): void {
		if (!this._currentSession || this._currentSession.status !== 'waiting') {
			return;
		}

		const currentPoint = this._currentSession.points[this._currentSession.currentPointIndex];
		if (!currentPoint) {
			return;
		}

		// Record result
		this._recordPointResult(currentPoint, 'skipped', '');

		// Apply default code
		this._applyCodeAtCurrentPoint(currentPoint.defaultCode);

		// Move to next point
		this._moveToNextPoint();
	}

	// ============== User Interaction ==============

	handleUserInput(input: string): BranchMatchResult {
		if (!this._currentSession || !['waiting', 'user_typing'].includes(this._currentSession.status)) {
			return { matched: false, matchQuality: 'none' };
		}

		const currentPoint = this._currentSession.points[this._currentSession.currentPointIndex];
		if (!currentPoint) {
			return { matched: false, matchQuality: 'none' };
		}

		// Store user input
		this._currentSession.userInputs.set(currentPoint.id, input);

		// Match against branches
		return this._matchBranches(input, currentPoint.branches);
	}

	acceptCurrentSuggestion(): void {
		if (!this._currentSession || !['waiting', 'user_typing', 'matched'].includes(this._currentSession.status)) {
			return;
		}

		const currentPoint = this._currentSession.points[this._currentSession.currentPointIndex];
		if (!currentPoint) {
			return;
		}

		// Get user input
		const userInput = this._currentSession.userInputs.get(currentPoint.id) || '';

		// Get selected branch or default
		const selectedBranchId = this._currentSession.selectedBranches.get(currentPoint.id);
		const selectedBranch = selectedBranchId
			? currentPoint.branches.find(b => b.id === selectedBranchId)
			: undefined;

		const codeToApply = selectedBranch?.code || currentPoint.defaultCode;

		// Record result
		this._recordPointResult(currentPoint, 'completed', userInput, selectedBranchId);

		// Apply code
		this._applyCodeAtCurrentPoint(codeToApply);

		// Move to next point
		this._moveToNextPoint();
	}

	// ============== Navigation ==============

	async focusCurrentFlowPoint(): Promise<void> {
		if (!this._currentSession) {
			return;
		}

		const currentPoint = this._currentSession.points[this._currentSession.currentPointIndex];
		if (!currentPoint) {
			return;
		}

		const uri = URI.file(currentPoint.file);

		try {
			const editor = await this._editorService.openEditor({
				resource: uri,
				options: {
					selection: {
						startLineNumber: currentPoint.line,
						startColumn: currentPoint.column,
						endLineNumber: currentPoint.line,
						endColumn: currentPoint.column
					},
				}
			});

			if (editor) {
				const control = editor.getControl();
				if (control && isCodeEditor(control)) {
					control.setPosition({ lineNumber: currentPoint.line, column: currentPoint.column });
					control.focus();
				}
			}
		} catch (e) {
			console.error('[FlowEditor] Failed to focus flow point:', e);
		}
	}

	// ============== Private: Flow Point Parsing ==============

	private _parseFlowPoints(content: string): ParseFlowPointsResult {
		const flowPoints: ParsedFlowPoint[] = [];
		let cleanCode = content;
		let offset = 0;

		// Regular expression to match flow markers
		// Format: <<<FLOW:type attr1="value1" attr2="value2" ... >>>
		const markerRegex = /<<<FLOW:(\w+)([\s\S]*?)>>>/g;

		let match;
		while ((match = markerRegex.exec(content)) !== null) {
			const fullMatch = match[0];
			const type = match[1] as 'blank' | 'choice' | 'prediction';
			const attrsString = match[2];

			// Parse attributes
			const attrs = this._parseFlowAttributes(attrsString);

			// Parse branches if present
			const branches = this._parseBranches(attrs.branches || '[]');

			const parsedPoint: ParsedFlowPoint = {
				raw: fullMatch,
				startOffset: match.index - offset,
				endOffset: match.index + fullMatch.length - offset,
				point: {
					type,
					hint: attrs.hint || '',
					branches,
					defaultCode: attrs.default || '',
					timeout: parseInt(attrs.timeout || String(DEFAULT_FLOW_TIMEOUT), 10),
					skill: attrs.skill || 'general',
					context: attrs.context || '',
				},
			};

			flowPoints.push(parsedPoint);

			// Remove marker from clean code
			cleanCode = cleanCode.slice(0, match.index - offset) + cleanCode.slice(match.index + fullMatch.length - offset);
			offset += fullMatch.length;
		}

		return { cleanCode, flowPoints };
	}

	private _parseFlowAttributes(attrsString: string): Record<string, string> {
		const attrs: Record<string, string> = {};

		// Match attribute="value" patterns
		const attrRegex = /(\w+)="([^"]*)"/g;
		let match;
		while ((match = attrRegex.exec(attrsString)) !== null) {
			attrs[match[1]] = match[2];
		}

		// Match attribute=[...] for arrays (branches)
		const arrayRegex = /(\w+)=\[([\s\S]*?)\]/g;
		while ((match = arrayRegex.exec(attrsString)) !== null) {
			attrs[match[1]] = `[${match[2]}]`;
		}

		return attrs;
	}

	private _parseBranches(branchesStr: string): FlowBranch[] {
		if (!branchesStr || branchesStr === '[]') {
			return [];
		}

		try {
			// Try to parse as JSON
			const parsed = JSON.parse(branchesStr.replace(/'/g, '"'));
			if (Array.isArray(parsed)) {
				return parsed.map((b, i) => ({
					id: b.id || `branch-${i}`,
					trigger: b.trigger || '',
					next: b.next,
					code: b.code || '',
					explanation: b.explanation,
				}));
			}
		} catch {
			// If JSON parse fails, try simple format
			// Format: {trigger:"...", code:"..."}, {trigger:"...", code:"..."}
			const branches: FlowBranch[] = [];
			const branchRegex = /\{trigger:"([^"]*)",\s*code:"([^"]*)"\}/g;
			let match;
			let idx = 0;
			while ((match = branchRegex.exec(branchesStr)) !== null) {
				branches.push({
					id: `branch-${idx++}`,
					trigger: match[1],
					code: match[2].replace(/\\n/g, '\n'),
				});
			}
			return branches;
		}

		return [];
	}

	// ============== Private: Branch Matching ==============

	private _matchBranches(input: string, branches: FlowBranch[]): BranchMatchResult {
		const trimmedInput = input.trim();

		if (!trimmedInput || branches.length === 0) {
			return { matched: false, matchQuality: 'none' };
		}

		// Find best matching branch
		for (const branch of branches) {
			// Check if input starts with branch trigger
			if (trimmedInput.startsWith(branch.trigger)) {
				const afterTrigger = trimmedInput.slice(branch.trigger.length);

				// Check next pattern if present
				if (branch.next) {
					if (afterTrigger.trim().startsWith(branch.next.trim())) {
						const remainingCode = branch.code.slice(trimmedInput.length);
						return {
							matched: true,
							branchId: branch.id,
							branch,
							matchQuality: 'full',
							remainingCode
						};
					} else if (afterTrigger.length > 0) {
						const remainingCode = branch.code.slice(trimmedInput.length);
						return {
							matched: true,
							branchId: branch.id,
							branch,
							matchQuality: 'partial',
							remainingCode
						};
					}
				}

				// Just trigger matched
				const remainingCode = branch.code.slice(trimmedInput.length);
				return {
					matched: true,
					branchId: branch.id,
					branch,
					matchQuality: afterTrigger.length > 0 ? 'partial' : 'full',
					remainingCode
				};
			}

			// Check partial trigger match (user is typing the trigger)
			if (branch.trigger.startsWith(trimmedInput)) {
				return {
					matched: true,
					branchId: branch.id,
					branch,
					matchQuality: 'partial',
					remainingCode: branch.code.slice(trimmedInput.length)
				};
			}
		}

		return { matched: false, matchQuality: 'none' };
	}

	// ============== Private: Code Writing ==============

	private async _writeFile(file: string, content: string): Promise<void> {
		const uri = URI.file(file);
		await this._fileService.writeFile(uri, VSBuffer.fromString(content));
	}

	private async _writeCodeUntilNextFlowPoint(fullCode: string): Promise<void> {
		if (!this._currentSession) {
			return;
		}

		const currentPointIndex = this._currentSession.currentPointIndex;
		const currentPoint = this._currentSession.points[currentPointIndex];

		if (!currentPoint) {
			// No more flow points, write remaining code
			await this._writeFile(this._currentSession.file, fullCode);
			this.endSession('completed');
			return;
		}

		// Calculate code before this flow point
		// For now, write the full code and position cursor at flow point
		await this._writeFile(this._currentSession.file, fullCode);

		// Update status to waiting
		this._currentSession.status = 'waiting';
		this._currentSession.codeWritten = fullCode;

		// Start timeout timer
		this._startTimeoutTimer(currentPoint);

		// Focus editor at flow point
		await this.focusCurrentFlowPoint();

		// Notify listeners
		this._onDidChangeSession.fire(this._currentSession);
		this._onDidReachFlowPoint.fire({
			sessionId: this._currentSession.id,
			point: currentPoint,
			pointIndex: currentPointIndex,
		});
	}

	private _applyCodeAtCurrentPoint(code: string): void {
		// In a real implementation, this would insert the code at the current position
		// For now, we just track that it was applied
		if (this._currentSession) {
			this._currentSession.codeWritten += code;
		}
	}

	private _moveToNextPoint(): void {
		if (!this._currentSession) {
			return;
		}

		// Clear timers
		this._clearTimers();

		// Move to next point
		this._currentSession.currentPointIndex++;

		if (this._currentSession.currentPointIndex >= this._currentSession.points.length) {
			// No more points, session complete
			this.endSession('completed');
		} else {
			// Start waiting for next point
			const nextPoint = this._currentSession.points[this._currentSession.currentPointIndex];
			this._currentSession.status = 'waiting';
			this._startTimeoutTimer(nextPoint);
			this.focusCurrentFlowPoint();

			this._onDidChangeSession.fire(this._currentSession);
			this._onDidReachFlowPoint.fire({
				sessionId: this._currentSession.id,
				point: nextPoint,
				pointIndex: this._currentSession.currentPointIndex,
			});
		}
	}

	// ============== Private: Timeout Management ==============

	private _startTimeoutTimer(point: FlowPoint): void {
		this._clearTimers();

		const warningTime = Math.max(FLOW_TIMEOUT_WARNING, point.timeout - FLOW_TIMEOUT_WARNING);

		// Warning timer
		this._warningTimer = setTimeout(() => {
			if (this._currentSession) {
				this._onTimeoutWarning.fire({
					sessionId: this._currentSession.id,
					pointId: point.id,
					remainingSeconds: FLOW_TIMEOUT_WARNING,
				});
			}
		}, warningTime * 1000);

		// Timeout timer
		this._timeoutTimer = setTimeout(() => {
			this._handleTimeout(point);
		}, point.timeout * 1000);
	}

	private _handleTimeout(point: FlowPoint): void {
		if (!this._currentSession) {
			return;
		}

		// Record timeout result
		this._recordPointResult(point, 'timeout', this._currentSession.userInputs.get(point.id) || '');

		// Apply default code
		this._applyCodeAtCurrentPoint(point.defaultCode);

		// Move to next point
		this._moveToNextPoint();
	}

	private _clearTimers(): void {
		if (this._timeoutTimer) {
			clearTimeout(this._timeoutTimer);
			this._timeoutTimer = null;
		}
		if (this._warningTimer) {
			clearTimeout(this._warningTimer);
			this._warningTimer = null;
		}
	}

	// ============== Private: Result Recording ==============

	private _recordPointResult(
		point: FlowPoint,
		outcome: 'completed' | 'timeout' | 'skipped',
		userInput: string,
		selectedBranch?: string
	): void {
		if (!this._currentSession) {
			return;
		}

		const timeTaken = (Date.now() - this._currentSession.startTime) / 1000;

		const result: FlowPointResult = {
			pointId: point.id,
			outcome,
			selectedBranch,
			userInput,
			timeTaken,
			skill: point.skill,
		};

		this._pointResults.push(result);

		// Record to study profile if available
		if (this._studyProfileService) {
			// Could add method to record flow results to profile
		}
	}

	override dispose(): void {
		this._clearTimers();
		super.dispose();
	}
}

registerSingleton(IFlowEditorService, FlowEditorService, InstantiationType.Eager);
