/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Flow Editor Types
 *
 * Type definitions for the Flow Editor system that enables
 * collaborative coding between AI and users in Study Mode.
 */

// ============== Flow Point Types ==============

/**
 * Type of flow point interaction
 * - blank: Fill in the blank - user types code
 * - choice: Select from branches - user picks an option
 * - prediction: Simple prediction - Tab to accept
 */
export type FlowPointType = 'blank' | 'choice' | 'prediction';

/**
 * Difficulty level for flow points
 */
export type FlowDifficulty = 'easy' | 'medium' | 'hard';

/**
 * A branch represents one possible code path the user can choose
 */
export interface FlowBranch {
	/** Unique identifier for this branch */
	id: string;
	/** Trigger word - when user types this, this branch is selected */
	trigger: string;
	/** Optional next pattern to match after trigger */
	next?: string;
	/** The complete code for this branch */
	code: string;
	/** Optional explanation shown after selection */
	explanation?: string;
}

/**
 * A flow point is a location in the code where the user participates
 */
export interface FlowPoint {
	/** Unique identifier */
	id: string;
	/** File path (relative or absolute) */
	file: string;
	/** Line number (1-indexed) */
	line: number;
	/** Column number (1-indexed) */
	column: number;
	/** Type of interaction */
	type: FlowPointType;
	/** Hint text shown to user */
	hint?: string;
	/** Available branches for choice/blank types */
	branches: FlowBranch[];
	/** Default code to use on timeout or skip */
	defaultCode: string;
	/** Timeout in seconds */
	timeout: number;
	/** Skill being practiced */
	skill: string;
	/** Context code shown before the flow point */
	context?: string;
}

// ============== Session Types ==============

/**
 * Status of a flow editor session
 */
export type FlowSessionStatus =
	| 'idle'        // No active session
	| 'streaming'   // AI is streaming code
	| 'waiting'     // Waiting at a flow point for user input
	| 'user_typing' // User is typing at flow point
	| 'matched'     // User input matched a branch
	| 'completing'  // Auto-completing with ghost text
	| 'completed'   // Session finished
	| 'cancelled';  // Session was cancelled

/**
 * A flow editor session tracks the state of collaborative coding
 */
export interface FlowSession {
	/** Unique session ID */
	id: string;
	/** Target file being edited */
	file: string;
	/** All flow points in this session */
	points: FlowPoint[];
	/** Index of current flow point */
	currentPointIndex: number;
	/** Session status */
	status: FlowSessionStatus;
	/** Map of point ID to user's input */
	userInputs: Map<string, string>;
	/** Map of point ID to selected branch ID */
	selectedBranches: Map<string, string>;
	/** Session start time */
	startTime: number;
	/** Total code written so far */
	codeWritten: string;
}

// ============== Result Types ==============

/**
 * Result of a single flow point interaction
 */
export interface FlowPointResult {
	/** Flow point ID */
	pointId: string;
	/** How the point was completed */
	outcome: 'completed' | 'timeout' | 'skipped';
	/** Branch ID if a branch was selected */
	selectedBranch?: string;
	/** What the user typed */
	userInput: string;
	/** Time taken in seconds */
	timeTaken: number;
	/** Skill practiced */
	skill: string;
}

/**
 * Result of a complete flow session
 */
export interface FlowSessionResult {
	/** Session ID */
	sessionId: string;
	/** File that was edited */
	file: string;
	/** Results for each flow point */
	pointResults: FlowPointResult[];
	/** Total session duration in seconds */
	totalTime: number;
	/** Summary statistics */
	summary: {
		totalPoints: number;
		completedByUser: number;
		timeouts: number;
		skipped: number;
		averageResponseTime: number;
		skills: string[];
	};
}

// ============== Branch Match Types ==============

/**
 * Quality of branch match
 */
export type MatchQuality = 'none' | 'partial' | 'full';

/**
 * Result of matching user input against branches
 */
export interface BranchMatchResult {
	/** Whether any branch was matched */
	matched: boolean;
	/** ID of matched branch */
	branchId?: string;
	/** The matched branch */
	branch?: FlowBranch;
	/** Quality of the match */
	matchQuality: MatchQuality;
	/** Remaining code to show as ghost text */
	remainingCode?: string;
}

// ============== Parsing Types ==============

/**
 * Parsed flow point from LLM output
 */
export interface ParsedFlowPoint {
	/** Raw marker content */
	raw: string;
	/** Start position in original content */
	startOffset: number;
	/** End position in original content */
	endOffset: number;
	/** Parsed flow point data */
	point: Omit<FlowPoint, 'id' | 'file' | 'line' | 'column'>;
}

/**
 * Result of parsing LLM output for flow points
 */
export interface ParseFlowPointsResult {
	/** Clean code with markers removed */
	cleanCode: string;
	/** Extracted flow points with positions */
	flowPoints: ParsedFlowPoint[];
}

// ============== Event Types ==============

/**
 * Event fired when reaching a flow point
 */
export interface FlowPointReachedEvent {
	/** Session ID */
	sessionId: string;
	/** The flow point */
	point: FlowPoint;
	/** Index in the session */
	pointIndex: number;
}

/**
 * Event fired for timeout warning
 */
export interface TimeoutWarningEvent {
	/** Session ID */
	sessionId: string;
	/** Flow point ID */
	pointId: string;
	/** Seconds remaining */
	remainingSeconds: number;
}

// ============== Constants ==============

/**
 * Flow point marker format in LLM output
 * Example: <<<FLOW:blank hint="..." skill="..." timeout=20 default="..." branches=[...]>>>
 */
export const FLOW_MARKER_START = '<<<FLOW:';
export const FLOW_MARKER_END = '>>>';

/**
 * Default timeout for flow points in seconds
 */
export const DEFAULT_FLOW_TIMEOUT = 15;

/**
 * Warning time before timeout (seconds before end)
 */
export const FLOW_TIMEOUT_WARNING = 5;
