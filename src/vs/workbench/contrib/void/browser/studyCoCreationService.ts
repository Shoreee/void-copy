/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { isCodeEditor, ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Position } from '../../../../editor/common/core/position.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { TrackedRangeStickiness, IModelDeltaDecoration } from '../../../../editor/common/model.js';

import type { CoCreateContent, CoCreateBranch, CoCreateDifficulty } from '../common/studyModeParser.js';
import { IStudyProfileService } from './studyProfileService.js';

// ============== Session Types ==============

export type CoCreationSessionStatus =
	| 'pending'      // Initial state before activation
	| 'active'       // Ready for user input (basic mode)
	| 'typing'       // User is typing
	| 'matched'      // User input matched a branch
	| 'left_blank'   // Timeout, waiting for fill-in
	| 'timeout'      // Final timeout
	| 'completed'    // Successfully completed
	| 'skipped'      // User skipped
	// Streaming states
	| 'streaming'    // Code is being streamed character by character
	| 'qte_waiting'  // Paused at QTE point, waiting for user input
	| 'qte_correct'  // User input was correct
	| 'qte_wrong'    // User input was wrong
	| 'explaining'   // Showing explanation for error
	| 'abandoned';   // Too many errors or timeouts

// QTE Point definition for streaming co-creation
export interface QTEPoint {
	id: string;              // Unique identifier
	position: number;        // Character position in the full code
	expected: string;        // Expected user input
	alternatives: string[];  // Acceptable alternative answers
	hint: string;            // Hint to show user
	timeout: number;         // Timeout in seconds for this QTE
}

// Streaming state for tracking progress
export interface StreamingState {
	fullCode: string;           // Complete code to be streamed
	visibleCode: string;        // Currently visible portion
	currentIndex: number;       // Current streaming position
	qtePoints: QTEPoint[];      // All QTE points in the code
	currentQTEIndex: number;    // Index of current/next QTE point
	isPaused: boolean;          // Whether streaming is paused
	userInput: string;          // User's current input at QTE point
	errorCount: number;         // Number of errors in this session
	maxErrors: number;          // Max errors before abandoning
}

export interface CoCreationSession {
	id: string;
	file: string;
	line: number;
	timeout: number;
	difficulty: CoCreateDifficulty;
	skill: string;
	context: string;
	hint?: string;
	branches: CoCreateBranch[];
	defaultCode: string;
	status: CoCreationSessionStatus;
	selectedBranch?: string;
	userInput: string;
	startTime: number;
	matchedBranchId?: string;
	// Streaming state (optional, only used in streaming mode)
	streamingState?: StreamingState;
	// Current QTE explanation (shown when user makes an error)
	currentExplanation?: string;
}

export interface BranchMatchResult {
	matched: boolean;
	branchId?: string;
	branch?: CoCreateBranch;
	matchQuality: 'none' | 'partial' | 'full';
	remainingCode?: string;  // Code to show as ghost text
}

// Result of validating user input at a QTE point
export interface QTEValidationResult {
	matched: boolean;
	quality: 'exact' | 'alternative' | 'partial' | 'none';
	explanation?: string;  // Explanation if input was wrong
}

export interface CoCreationResult {
	sessionId: string;
	outcome: 'completed' | 'timeout' | 'skipped' | 'abandoned';
	selectedBranch?: string;
	userInput: string;
	timeTaken: number;
	skill: string;
	difficulty: CoCreateDifficulty;
	/** Feedback message to send to the teacher AI */
	feedbackMessage?: string;
	/** Number of errors made during the session */
	errorCount?: number;
}

// ============== Service Interface ==============

export interface IStudyCoCreationService {
	readonly _serviceBrand: undefined;

	/** Current active session */
	readonly currentSession: CoCreationSession | null;

	/** Whether a session is currently active */
	readonly isSessionActive: boolean;

	// Session Management
	startSession(content: CoCreateContent, threadId: string): string;
	endSession(sessionId: string, outcome: 'completed' | 'timeout' | 'skipped'): CoCreationResult | null;
	skipSession(sessionId: string): void;

	/** Check if content has been processed for a specific thread */
	isContentProcessed(threadId: string, contentId: string): boolean;

	/** Clear processed content for a specific thread (call when user explicitly wants to retry) */
	clearThreadProcessedContent(threadId: string): void;

	// User Input Handling
	handleUserInput(input: string): BranchMatchResult;
	confirmSelection(): void;

	// Streaming Co-Creation Methods
	/** Start streaming co-creation with QTE points */
	startStreamingSession(code: string, qtePoints: QTEPoint[], file: string, line: number, skill: string, difficulty: CoCreateDifficulty, threadId: string): string;
	/** Pause streaming at current position */
	pauseStreaming(): void;
	/** Resume streaming from paused position */
	resumeStreaming(): void;
	/** Validate user input at current QTE point */
	validateQTEInput(input: string): QTEValidationResult;
	/** Continue after correct QTE input */
	continueAfterQTE(): void;
	/** Show explanation after wrong QTE input */
	showExplanation(explanation: string): void;

	// Navigation
	focusCoCreationLocation(): Promise<void>;

	// Events
	readonly onDidChangeSession: Event<CoCreationSession | null>;
	readonly onDidComplete: Event<CoCreationResult>;
	readonly onTimeoutWarning: Event<{ sessionId: string; remainingSeconds: number }>;
	/** Fired when the user abandons the co-creation and teacher AI should provide feedback */
	readonly onNeedTeacherFeedback: Event<{ sessionId: string; skill: string; feedbackMessage: string }>;
	/** Fired when streaming progress updates (for UI updates) */
	readonly onStreamingProgress: Event<{ visibleCode: string; progress: number; isPaused: boolean }>;
	/** Fired when QTE point is reached */
	readonly onQTEReached: Event<{ qtePoint: QTEPoint; qteIndex: number }>;
}

export const IStudyCoCreationService = createDecorator<IStudyCoCreationService>('StudyCoCreationService');

// ============== Service Implementation ==============

class StudyCoCreationService extends Disposable implements IStudyCoCreationService {
	readonly _serviceBrand: undefined;

	private _currentSession: CoCreationSession | null = null;
	private _sessionIdCounter: number = 0;
	private _timeoutTimer: NodeJS.Timeout | null = null;
	private _warningTimer: NodeJS.Timeout | null = null;
	private _leftBlankTimer: NodeJS.Timeout | null = null;

	// Track processed content IDs per thread to prevent duplicate triggers
	// Key: threadId, Value: Set of contentIds that have been processed
	private readonly _processedContentByThread = new Map<string, Set<string>>();

	// Constants
	private static readonly LEFT_BLANK_TIMEOUT = 30; // 30 seconds to fill in after initial timeout

	// Events
	private readonly _onDidChangeSession = this._register(new Emitter<CoCreationSession | null>());
	readonly onDidChangeSession = this._onDidChangeSession.event;

	private readonly _onDidComplete = this._register(new Emitter<CoCreationResult>());
	readonly onDidComplete = this._onDidComplete.event;

	private readonly _onTimeoutWarning = this._register(new Emitter<{ sessionId: string; remainingSeconds: number }>());
	readonly onTimeoutWarning = this._onTimeoutWarning.event;

	private readonly _onNeedTeacherFeedback = this._register(new Emitter<{ sessionId: string; skill: string; feedbackMessage: string }>());
	readonly onNeedTeacherFeedback = this._onNeedTeacherFeedback.event;

	private readonly _onStreamingProgress = this._register(new Emitter<{ visibleCode: string; progress: number; isPaused: boolean }>());
	readonly onStreamingProgress = this._onStreamingProgress.event;

	private readonly _onQTEReached = this._register(new Emitter<{ qtePoint: QTEPoint; qteIndex: number }>());
	readonly onQTEReached = this._onQTEReached.event;

	// Streaming control
	private _streamingInterval: ReturnType<typeof setInterval> | null = null;
	private _streamingCharDelay = 50; // ms per character (increased from 30 for performance)
	private _qteTimer: ReturnType<typeof setTimeout> | null = null;
	private _decorationUpdateCounter = 0; // Throttle decoration updates

	// Decoration management for streaming code display
	private _decorationIds: string[] = [];
	private _currentEditor: ICodeEditor | null = null;

	// Decoration options for ghost text (reserved for future use)
	// private static readonly GHOST_TEXT_DECORATION: IModelDecorationOptions = {
	// 	description: 'co-create-ghost-text',
	// 	after: {
	// 		content: '',
	// 		inlineClassName: 'co-create-ghost-text'
	// 	},
	// 	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
	// };

	constructor(
		@IEditorService private readonly _editorService: IEditorService,
		@IStudyProfileService private readonly _studyProfileService: IStudyProfileService,
		@ILanguageFeaturesService private readonly _langFeatureService: ILanguageFeaturesService,
	) {
		super();

		// Register InlineCompletionProvider for Ghost Text
		this._registerGhostTextProvider();
	}

	// ============== Ghost Text Provider ==============

	// Throttle ghost text to prevent performance issues
	private _lastGhostTextTime = 0;
	private _ghostTextThrottleMs = 500; // Only update every 500ms

	private _registerGhostTextProvider(): void {
		console.log('[CoCreation] Registering Ghost Text provider');
		this._register(this._langFeatureService.inlineCompletionsProvider.register('*', {
			provideInlineCompletions: async (model: ITextModel, position: Position) => {
				// Only provide ghost text when we have an active co-creation session
				if (!this._currentSession || !this.isSessionActive) {
					return { items: [] };
				}

				// DISABLE ghost text in streaming mode - we use decorations instead
				if (this._currentSession.status === 'streaming' || this._currentSession.streamingState) {
					return { items: [] };
				}

				// Throttle to prevent performance issues
				const now = Date.now();
				if (now - this._lastGhostTextTime < this._ghostTextThrottleMs) {
					return { items: [] };
				}
				this._lastGhostTextTime = now;

				// Check if we're in the correct file
				const currentUri = model.uri;
				const sessionUri = URI.file(this._currentSession.file);

				// Allow if same file or if the session file path is contained in the current URI
				const isMatchingFile = currentUri.fsPath === sessionUri.fsPath ||
					currentUri.fsPath.endsWith(this._currentSession.file);

				if (!isMatchingFile) {
					return { items: [] };
				}

				// Check if we're on the correct line (with some tolerance)
				const sessionLine = this._currentSession.line;
				const currentLine = position.lineNumber;
				if (Math.abs(currentLine - sessionLine) > 5) {
					return { items: [] };
				}

				// Get user's current input on this line
				const lineContent = model.getLineContent(currentLine);
				const userInput = lineContent.slice(0, position.column - 1);

				// Update session with user input
				this._currentSession.userInput = userInput;

				// Match against branches
				const matchResult = this._matchBranches(userInput, this._currentSession.branches);

				let ghostText: string;
				if (matchResult.matched && matchResult.remainingCode) {
					ghostText = matchResult.remainingCode;
					this._currentSession.matchedBranchId = matchResult.branchId;
					if (this._currentSession.status !== 'matched') {
						this._currentSession.status = 'typing';
					}
				} else {
					// Show default code as ghost text
					const defaultCode = this._currentSession.defaultCode;
					ghostText = defaultCode.slice(userInput.length);
				}

				// Don't show ghost text if nothing to complete
				if (!ghostText || ghostText.length === 0) {
					return { items: [] };
				}

				// Don't fire session change on every keystroke - causes performance issues
				// this._onDidChangeSession.fire(this._currentSession);

				return {
					items: [{
						insertText: ghostText,
						range: new Range(
							position.lineNumber,
							position.column,
							position.lineNumber,
							position.column
						),
						// Show command to accept
						command: {
							id: 'void.coCreate.accept',
							title: 'Accept Co-Creation',
						}
					}]
				};
			},
			freeInlineCompletions: () => {
				// Called when inline completions are dismissed
			}
		}));
	}

	// ============== Getters ==============

	get currentSession(): CoCreationSession | null {
		return this._currentSession;
	}

	get isSessionActive(): boolean {
		return this._currentSession !== null &&
			['pending', 'active', 'typing', 'matched', 'left_blank'].includes(this._currentSession.status);
	}

	// ============== Content Processing Tracking ==============

	isContentProcessed(threadId: string, contentId: string): boolean {
		return this._processedContentByThread.get(threadId)?.has(contentId) ?? false;
	}

	clearThreadProcessedContent(threadId: string): void {
		console.log('[CoCreation] Clearing processed content for thread:', threadId);
		this._processedContentByThread.delete(threadId);
	}

	private _markContentProcessed(threadId: string, contentId: string): void {
		let threadSet = this._processedContentByThread.get(threadId);
		if (!threadSet) {
			threadSet = new Set<string>();
			this._processedContentByThread.set(threadId, threadSet);
		}
		threadSet.add(contentId);
	}

	// ============== Session Management ==============

	startSession(content: CoCreateContent, threadId: string): string {
		// Create a content ID to detect duplicate triggers
		const contentId = `${content.file}:${content.line}:${content.skill}`;
		console.log('[CoCreation] Starting session:', contentId, 'thread:', threadId, 'timeout:', content.timeout, 's');

		// Check if this content has already been processed for this thread
		if (this.isContentProcessed(threadId, contentId)) {
			console.log('[CoCreation] Content already processed for this thread, skipping:', contentId);
			return '';  // Return empty string to indicate no new session
		}

		// If there's already an active session for the SAME content, don't recreate
		if (this._currentSession && this.isSessionActive) {
			const currentContentId = `${this._currentSession.file}:${this._currentSession.line}:${this._currentSession.skill}`;
			if (currentContentId === contentId) {
				// Same content already running, just return existing session ID
				console.log('[CoCreation] Session already exists, skipping');
				return this._currentSession.id;
			}
			// Different content, end the old session
			console.log('[CoCreation] Ending old session for new content');
			this.endSession(this._currentSession.id, 'skipped');
		}

		// Mark this content as processed for this thread
		this._markContentProcessed(threadId, contentId);

		const sessionId = `co-create-${++this._sessionIdCounter}-${Date.now()}`;

		this._currentSession = {
			id: sessionId,
			file: content.file,
			line: content.line,
			timeout: content.timeout,
			difficulty: content.difficulty,
			skill: content.skill,
			context: content.context,
			hint: content.hint,
			branches: content.branches,
			defaultCode: content.defaultCode,
			status: 'active',  // Start as active to trigger countdown immediately
			userInput: '',
			startTime: Date.now(),
		};

		// Start timeout timer
		this._startTimeoutTimer(sessionId, content.timeout);
		console.log('[CoCreation] Timer started, session created:', sessionId);

		// Notify listeners
		this._onDidChangeSession.fire(this._currentSession);

		// Focus the editor at the co-creation location
		this.focusCoCreationLocation();

		return sessionId;
	}

	endSession(sessionId: string, outcome: 'completed' | 'timeout' | 'skipped'): CoCreationResult | null {
		console.log('[CoCreation] Ending session:', sessionId, 'outcome:', outcome);
		if (!this._currentSession || this._currentSession.id !== sessionId) {
			console.log('[CoCreation] Session not found or mismatch');
			return null;
		}

		// Clear timers
		this._clearTimers();

		const session = this._currentSession;
		const timeTaken = (Date.now() - session.startTime) / 1000;

		// Update session status
		session.status = outcome;

		const result: CoCreationResult = {
			sessionId: session.id,
			outcome,
			selectedBranch: session.matchedBranchId,
			userInput: session.userInput,
			timeTaken,
			skill: session.skill,
			difficulty: session.difficulty,
		};

		// Record result to profile service
		this._recordResultToProfile(result);

		// Clear current session
		this._currentSession = null;

		// Notify listeners
		this._onDidChangeSession.fire(null);
		this._onDidComplete.fire(result);

		console.log('[CoCreation] Session ended, result:', result.outcome, 'timeTaken:', result.timeTaken.toFixed(1), 's');
		return result;
	}

	skipSession(sessionId: string): void {
		this.endSession(sessionId, 'skipped');
	}

	// ============== User Input Handling ==============

	handleUserInput(input: string): BranchMatchResult {
		if (!this._currentSession || !this.isSessionActive) {
			return { matched: false, matchQuality: 'none' };
		}

		// Update session state
		this._currentSession.userInput = input;
		if (this._currentSession.status === 'pending' || this._currentSession.status === 'active') {
			this._currentSession.status = 'typing';
		}

		// Try to match branches
		const matchResult = this._matchBranches(input, this._currentSession.branches);

		if (matchResult.matched && matchResult.branchId) {
			this._currentSession.matchedBranchId = matchResult.branchId;
			this._currentSession.status = 'matched';
		}

		// Notify listeners
		this._onDidChangeSession.fire(this._currentSession);

		return matchResult;
	}

	confirmSelection(): void {
		if (!this._currentSession || !this.isSessionActive) {
			return;
		}

		this.endSession(this._currentSession.id, 'completed');
	}

	// ============== Navigation ==============

	async focusCoCreationLocation(): Promise<void> {
		if (!this._currentSession) {
			console.log('[CoCreation] Focus: No current session');
			return;
		}

		const { file, line } = this._currentSession;
		console.log('[CoCreation] Focus: Attempting to focus file:', file, 'line:', line);

		// Validate file path - don't attempt to open clearly invalid paths
		if (!file || file.trim() === '' || file.includes('...') || file.startsWith('<')) {
			console.warn('[CoCreation] Focus: Invalid file path, skipping focus:', file);
			// Still mark as active since the session exists
			if (this._currentSession.status === 'pending') {
				this._currentSession.status = 'active';
				this._onDidChangeSession.fire(this._currentSession);
			}
			return;
		}

		try {
			const uri = URI.file(file);
			console.log('[CoCreation] Focus: URI created:', uri.toString());

			// Try to open the file directly - it might be created by the tool
			const editor = await this._editorService.openEditor({
				resource: uri,
				options: {
					selection: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
				}
			});

			// Set cursor position but DON'T steal focus from sidebar
			if (editor) {
				const control = editor.getControl();
				if (control && isCodeEditor(control)) {
					control.setPosition({ lineNumber: line, column: 1 });
					// DON'T call control.focus() - this steals focus from sidebar input
					console.log('[CoCreation] Focus: Editor position set (focus preserved for sidebar)');
					// Note: Ghost text will appear when user clicks in editor and starts typing
				} else {
					console.warn('[CoCreation] Focus: Could not get code editor control');
				}
			} else {
				console.warn('[CoCreation] Focus: Could not open editor for file:', file);
			}

			// Update session status to active
			if (this._currentSession.status === 'pending') {
				this._currentSession.status = 'active';
				this._onDidChangeSession.fire(this._currentSession);
			}
		} catch (e) {
			console.error('[CoCreation] Focus: Failed to focus location:', e);
			// Still mark as active to prevent infinite retries
			if (this._currentSession && this._currentSession.status === 'pending') {
				this._currentSession.status = 'active';
				this._onDidChangeSession.fire(this._currentSession);
			}
		}
	}

	// ============== Streaming Co-Creation Methods ==============

	startStreamingSession(
		code: string,
		qtePoints: QTEPoint[],
		file: string,
		line: number,
		skill: string,
		difficulty: CoCreateDifficulty,
		threadId: string
	): string {
		// Create content ID for deduplication
		const contentId = `streaming:${file}:${line}:${skill}`;
		console.log('[CoCreation] Starting streaming session:', contentId);

		// Check if already processed
		if (this.isContentProcessed(threadId, contentId)) {
			console.log('[CoCreation] Streaming content already processed, skipping');
			return '';
		}

		// End any existing session
		if (this._currentSession && this.isSessionActive) {
			this.endSession(this._currentSession.id, 'skipped');
		}

		// Mark as processed
		this._markContentProcessed(threadId, contentId);

		const sessionId = `streaming-${++this._sessionIdCounter}-${Date.now()}`;

		// Sort QTE points by position
		const sortedQTEs = [...qtePoints].sort((a, b) => a.position - b.position);

		// Initialize streaming state
		const streamingState: StreamingState = {
			fullCode: code,
			visibleCode: '',
			currentIndex: 0,
			qtePoints: sortedQTEs,
			currentQTEIndex: 0,
			isPaused: false,
			userInput: '',
			errorCount: 0,
			maxErrors: 3,
		};

		this._currentSession = {
			id: sessionId,
			file,
			line,
			timeout: sortedQTEs[0]?.timeout || 15,
			difficulty,
			skill,
			context: '',
			branches: [],
			defaultCode: code,
			status: 'streaming',
			userInput: '',
			startTime: Date.now(),
			streamingState,
		};

		// Notify listeners
		this._onDidChangeSession.fire(this._currentSession);

		// Start the streaming
		this._startStreamingCode();

		// Focus editor
		this.focusCoCreationLocation();

		console.log('[CoCreation] Streaming session started:', sessionId, 'with', qtePoints.length, 'QTE points');
		return sessionId;
	}

	private _startStreamingCode(): void {
		if (!this._currentSession?.streamingState) return;

		const state = this._currentSession.streamingState;

		// Clear any existing interval
		this._stopStreamingCode();

		console.log('[CoCreation] Starting streaming code from index:', state.currentIndex);

		this._decorationUpdateCounter = 0;

		this._streamingInterval = setInterval(() => {
			if (!this._currentSession?.streamingState) {
				this._stopStreamingCode();
				return;
			}

			const st = this._currentSession.streamingState;

			// Check if paused
			if (st.isPaused) {
				return;
			}

			// Check if we've reached a QTE point
			const nextQTE = st.qtePoints[st.currentQTEIndex];
			if (nextQTE && st.currentIndex >= nextQTE.position) {
				this._pauseAtQTE(nextQTE, st.currentQTEIndex);
				return;
			}

			// Check if we've reached the end
			if (st.currentIndex >= st.fullCode.length) {
				this._completeStreaming();
				return;
			}

			// Add next character
			st.currentIndex++;
			st.visibleCode = st.fullCode.slice(0, st.currentIndex);

			// Calculate progress
			const progress = (st.currentIndex / st.fullCode.length) * 100;

			// Throttle decoration updates - only update every 5 characters
			this._decorationUpdateCounter++;
			if (this._decorationUpdateCounter >= 5) {
				this._decorationUpdateCounter = 0;
				this._updateStreamingDecorations();
			}

			// Throttle progress events - only fire every 10 characters
			if (st.currentIndex % 10 === 0 || st.currentIndex === st.fullCode.length) {
				this._onStreamingProgress.fire({
					visibleCode: st.visibleCode,
					progress,
					isPaused: false,
				});
				this._onDidChangeSession.fire(this._currentSession);
			}
		}, this._streamingCharDelay);
	}

	private _stopStreamingCode(): void {
		if (this._streamingInterval) {
			clearInterval(this._streamingInterval);
			this._streamingInterval = null;
		}
	}

	private _pauseAtQTE(qtePoint: QTEPoint, qteIndex: number): void {
		if (!this._currentSession?.streamingState) return;

		console.log('[CoCreation] Pausing at QTE point:', qteIndex, 'hint:', qtePoint.hint);

		const st = this._currentSession.streamingState;
		st.isPaused = true;
		st.userInput = '';

		// Update session status
		this._currentSession.status = 'qte_waiting';
		this._currentSession.timeout = qtePoint.timeout;
		this._currentSession.startTime = Date.now(); // Reset timer for QTE
		this._currentSession.hint = qtePoint.hint;

		// Fire QTE reached event
		this._onQTEReached.fire({ qtePoint, qteIndex });

		// Start QTE timeout
		this._startQTETimer(qtePoint.timeout);

		// Notify listeners
		this._onStreamingProgress.fire({
			visibleCode: st.visibleCode,
			progress: (st.currentIndex / st.fullCode.length) * 100,
			isPaused: true,
		});

		this._onDidChangeSession.fire(this._currentSession);
	}

	private _startQTETimer(timeoutSeconds: number): void {
		this._clearQTETimer();

		// Warning at 5 seconds
		if (timeoutSeconds > 5) {
			setTimeout(() => {
				if (this._currentSession?.status === 'qte_waiting') {
					this._onTimeoutWarning.fire({
						sessionId: this._currentSession.id,
						remainingSeconds: 5,
					});
				}
			}, (timeoutSeconds - 5) * 1000);
		}

		// Actual timeout
		this._qteTimer = setTimeout(() => {
			if (this._currentSession?.status === 'qte_waiting') {
				this._handleQTETimeout();
			}
		}, timeoutSeconds * 1000);
	}

	private _clearQTETimer(): void {
		if (this._qteTimer) {
			clearTimeout(this._qteTimer);
			this._qteTimer = null;
		}
	}

	private _handleQTETimeout(): void {
		if (!this._currentSession?.streamingState) return;

		console.log('[CoCreation] QTE timeout, entering left_blank state');

		// Enter left_blank state
		this._currentSession.status = 'left_blank';
		this._onDidChangeSession.fire(this._currentSession);

		// Start left blank timer
		this._leftBlankTimer = setTimeout(() => {
			if (this._currentSession?.status === 'left_blank') {
				this._handleAbandonedSession(this._currentSession.id);
			}
		}, StudyCoCreationService.LEFT_BLANK_TIMEOUT * 1000);
	}

	private _completeStreaming(): void {
		if (!this._currentSession) return;

		console.log('[CoCreation] Streaming completed');

		this._stopStreamingCode();
		this._clearQTETimer();

		this._currentSession.status = 'completed';
		this._onDidChangeSession.fire(this._currentSession);

		// Create result
		const result: CoCreationResult = {
			sessionId: this._currentSession.id,
			outcome: 'completed',
			userInput: this._currentSession.userInput,
			timeTaken: (Date.now() - this._currentSession.startTime) / 1000,
			skill: this._currentSession.skill,
			difficulty: this._currentSession.difficulty,
			errorCount: this._currentSession.streamingState?.errorCount || 0,
		};

		this._recordResultToProfile(result);
		this._onDidComplete.fire(result);

		// Clear decorations
		this._clearStreamingDecorations();

		this._currentSession = null;
		this._onDidChangeSession.fire(null);
	}

	// ============== Decoration Methods ==============

	private async _updateStreamingDecorations(): Promise<void> {
		if (!this._currentSession?.streamingState) return;

		const st = this._currentSession.streamingState;
		const editor = await this._getActiveEditor();
		if (!editor) return;

		const model = editor.getModel();
		if (!model) return;

		// Clear previous decorations
		this._clearStreamingDecorations();

		// Calculate decoration content - show remaining code as ghost text
		const visibleLength = st.currentIndex;
		const remainingCode = st.fullCode.slice(visibleLength);

		if (!remainingCode) return;

		// Get the line and column where we want to show the ghost text
		const line = this._currentSession.line;
		const lineContent = model.getLineContent(line);

		// Create decoration with remaining code as after content
		const decorations: IModelDeltaDecoration[] = [{
			range: new Range(line, lineContent.length + 1, line, lineContent.length + 1),
			options: {
				description: 'co-create-streaming-ghost-text',
				after: {
					content: remainingCode.split('\n')[0], // Show first line of remaining
					inlineClassName: 'co-create-ghost-text',
					cursorStops: 0 // Don't stop cursor
				},
				stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
			}
		}];

		this._decorationIds = model.deltaDecorations(this._decorationIds, decorations);
		this._currentEditor = editor;
	}

	private _clearStreamingDecorations(): void {
		if (this._currentEditor) {
			const model = this._currentEditor.getModel();
			if (model) {
				this._decorationIds = model.deltaDecorations(this._decorationIds, []);
			}
			this._currentEditor = null;
		}
		this._decorationIds = [];
	}

	private async _getActiveEditor(): Promise<ICodeEditor | null> {
		const activePane = this._editorService.activeEditorPane;
		if (!activePane) return null;

		const control = activePane.getControl();
		if (control && isCodeEditor(control)) {
			return control;
		}
		return null;
	}

	pauseStreaming(): void {
		if (!this._currentSession?.streamingState) return;
		this._currentSession.streamingState.isPaused = true;
		console.log('[CoCreation] Streaming paused');
	}

	resumeStreaming(): void {
		if (!this._currentSession?.streamingState) return;

		const st = this._currentSession.streamingState;
		if (!st.isPaused) return;

		console.log('[CoCreation] Resuming streaming');
		st.isPaused = false;
		this._currentSession.status = 'streaming';
		this._onDidChangeSession.fire(this._currentSession);
	}

	validateQTEInput(input: string): QTEValidationResult {
		if (!this._currentSession?.streamingState) {
			return { matched: false, quality: 'none' };
		}

		const st = this._currentSession.streamingState;
		const currentQTE = st.qtePoints[st.currentQTEIndex];
		if (!currentQTE) {
			return { matched: false, quality: 'none' };
		}

		// Update user input
		st.userInput = input;

		// Check for exact match
		if (input === currentQTE.expected) {
			console.log('[CoCreation] QTE exact match');
			return { matched: true, quality: 'exact' };
		}

		// Check for alternative matches
		if (currentQTE.alternatives.includes(input)) {
			console.log('[CoCreation] QTE alternative match');
			return { matched: true, quality: 'alternative' };
		}

		// Check for partial match (user is still typing)
		if (currentQTE.expected.startsWith(input)) {
			return { matched: true, quality: 'partial' };
		}

		// Check if any alternative starts with input
		for (const alt of currentQTE.alternatives) {
			if (alt.startsWith(input)) {
				return { matched: true, quality: 'partial' };
			}
		}

		// No match - this is an error
		console.log('[CoCreation] QTE input mismatch. Expected:', currentQTE.expected, 'Got:', input);
		return {
			matched: false,
			quality: 'none',
			explanation: `输入不正确。预期: "${currentQTE.expected}"${currentQTE.hint ? `\n提示: ${currentQTE.hint}` : ''}`,
		};
	}

	continueAfterQTE(): void {
		if (!this._currentSession?.streamingState) return;

		console.log('[CoCreation] Continuing after QTE');

		const st = this._currentSession.streamingState;
		this._clearQTETimer();

		// Move to next QTE
		st.currentQTEIndex++;
		st.isPaused = false;
		st.userInput = '';

		// Update status
		this._currentSession.status = 'streaming';
		this._onDidChangeSession.fire(this._currentSession);

		// Resume streaming (will auto-start from interval check)
	}

	showExplanation(explanation: string): void {
		if (!this._currentSession?.streamingState) return;

		console.log('[CoCreation] Showing explanation:', explanation);

		const st = this._currentSession.streamingState;
		st.errorCount++;

		// Update session
		this._currentSession.status = 'explaining';
		this._currentSession.currentExplanation = explanation;
		this._onDidChangeSession.fire(this._currentSession);

		// Check if too many errors
		if (st.errorCount >= st.maxErrors) {
			console.log('[CoCreation] Too many errors, abandoning session');
			setTimeout(() => {
				if (this._currentSession) {
					this._handleTooManyErrors();
				}
			}, 2000); // Give user time to see explanation
		}
	}

	private _handleTooManyErrors(): void {
		if (!this._currentSession) return;

		const session = this._currentSession;
		const feedbackMessage = `学生在共创编码中错误次数过多。技能: ${session.skill}，错误次数: ${session.streamingState?.errorCount || 0}/${session.streamingState?.maxErrors || 3}。建议简化教学或换一个练习。`;

		this._onNeedTeacherFeedback.fire({
			sessionId: session.id,
			skill: session.skill,
			feedbackMessage,
		});

		// End session as abandoned
		this._stopStreamingCode();
		this._clearQTETimer();
		this._clearTimers();

		const result: CoCreationResult = {
			sessionId: session.id,
			outcome: 'abandoned',
			userInput: session.userInput,
			timeTaken: (Date.now() - session.startTime) / 1000,
			skill: session.skill,
			difficulty: session.difficulty,
			feedbackMessage,
			errorCount: session.streamingState?.errorCount,
		};

		this._recordResultToProfile(result);
		session.status = 'abandoned';
		this._onDidChangeSession.fire(session);
		this._onDidComplete.fire(result);

		this._currentSession = null;
		this._onDidChangeSession.fire(null);
	}

	// ============== Private Methods ==============

	private _matchBranches(input: string, branches: CoCreateBranch[]): BranchMatchResult {
		const trimmedInput = input.trim();

		if (!trimmedInput) {
			return { matched: false, matchQuality: 'none' };
		}

		// Find best matching branch
		for (const branch of branches) {
			// Check if input starts with branch trigger
			if (trimmedInput.startsWith(branch.trigger)) {
				// Full match of trigger
				const afterTrigger = trimmedInput.slice(branch.trigger.length);

				// Check if there's a 'next' pattern to match
				if (branch.next) {
					if (afterTrigger.trim().startsWith(branch.next.trim())) {
						// Full match including next pattern
						const remainingCode = branch.code.slice(trimmedInput.length);
						return {
							matched: true,
							branchId: branch.id,
							branch,
							matchQuality: 'full',
							remainingCode
						};
					} else if (afterTrigger.length > 0) {
						// Partial match - user is typing after trigger
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

			// Check partial trigger match
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

	private _startTimeoutTimer(sessionId: string, timeoutSeconds: number): void {
		this._clearTimers();

		// Warning at 5 seconds remaining
		const warningTime = Math.max(0, (timeoutSeconds - 5) * 1000);
		if (warningTime > 0) {
			this._warningTimer = setTimeout(() => {
				if (this._currentSession?.id === sessionId) {
					this._onTimeoutWarning.fire({ sessionId, remainingSeconds: 5 });
				}
			}, warningTime);
		}

		// First timeout - enter "left_blank" state instead of ending session
		this._timeoutTimer = setTimeout(() => {
			if (this._currentSession?.id === sessionId && this.isSessionActive) {
				this._enterLeftBlankState(sessionId);
			}
		}, timeoutSeconds * 1000);
	}

	private _enterLeftBlankState(sessionId: string): void {
		if (!this._currentSession || this._currentSession.id !== sessionId) {
			return;
		}

		console.log('[CoCreation] Entering left_blank state for session:', sessionId);

		// Update session status to left_blank
		this._currentSession.status = 'left_blank';
		this._onDidChangeSession.fire(this._currentSession);

		// Start second timer for filling in the blank
		this._leftBlankTimer = setTimeout(() => {
			if (this._currentSession?.id === sessionId && this._currentSession.status === 'left_blank') {
				// User still hasn't filled in - send feedback to teacher AI and end session
				this._handleAbandonedSession(sessionId);
			}
		}, StudyCoCreationService.LEFT_BLANK_TIMEOUT * 1000);
	}

	private _handleAbandonedSession(sessionId: string): void {
		if (!this._currentSession || this._currentSession.id !== sessionId) {
			return;
		}

		console.log('[CoCreation] User abandoned session:', sessionId);

		const session = this._currentSession;
		const feedbackMessage = `学生在共创编码练习中超时且未完成填空。技能: ${session.skill}，难度: ${session.difficulty}，用户输入: "${session.userInput || '(无)'}"。建议：简化教学内容或提供更详细的解释。`;

		// Fire event for teacher AI to handle
		this._onNeedTeacherFeedback.fire({
			sessionId,
			skill: session.skill,
			feedbackMessage
		});

		// End the session with 'abandoned' outcome
		this._clearTimers();

		const timeTaken = (Date.now() - session.startTime) / 1000;
		const result: CoCreationResult = {
			sessionId: session.id,
			outcome: 'abandoned',
			selectedBranch: session.matchedBranchId,
			userInput: session.userInput,
			timeTaken,
			skill: session.skill,
			difficulty: session.difficulty,
			feedbackMessage
		};

		// Record to profile
		this._recordResultToProfile(result);

		// Clear current session
		this._currentSession = null;

		// Notify listeners
		this._onDidChangeSession.fire(null);
		this._onDidComplete.fire(result);
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
		if (this._leftBlankTimer) {
			clearTimeout(this._leftBlankTimer);
			this._leftBlankTimer = null;
		}
	}

	private _recordResultToProfile(result: CoCreationResult): void {
		// Reset timeout counter if user completed successfully
		if (result.outcome === 'completed') {
			this._studyProfileService.resetTimeoutCounter();
		} else if (result.outcome === 'timeout') {
			this._studyProfileService.recordTimeoutEvent();
		}

		// Record as QTE result for skill tracking
		this._studyProfileService.recordQTEResult({
			qteId: result.sessionId,
			type: 'fillblank', // Co-creation is similar to fill-in-the-blank
			isCorrect: result.outcome === 'completed',
			timeTaken: result.timeTaken,
			difficulty: result.difficulty,
			concept: result.skill,
			timestamp: Date.now(),
		});
	}

	override dispose(): void {
		this._clearTimers();
		super.dispose();
	}
}

// Register the service
registerSingleton(IStudyCoCreationService, StudyCoCreationService, InstantiationType.Delayed);

// Register the accept command for co-creation inline completions
registerAction2(class CoCreateAcceptAction extends Action2 {
	constructor() {
		super({
			id: 'void.coCreate.accept',
			title: 'Accept Co-Creation Suggestion',
		});
	}

	run(accessor: ServicesAccessor): void {
		const coCreationService = accessor.get(IStudyCoCreationService);
		if (coCreationService.isSessionActive) {
			console.log('[CoCreation] Accept command triggered, confirming selection');
			coCreationService.confirmSelection();
		}
	}
});
