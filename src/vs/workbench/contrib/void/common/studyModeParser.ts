/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Study Mode Parser
 *
 * Parses LLM output containing special study mode tags:
 * - <qte> - Quick Time Event decision points
 * - <diagram> - Visual diagrams (Mermaid/ASCII)
 * - <thought> - AI thinking process
 * - <action> - Code action cards
 * - <curriculum> - Learning progress/roadmap
 * - <lens> - Knowledge anchor points for code
 */

// ============== Type Definitions ==============

// QTE Types:
// - prediction: Level 1 - Ghost text style, simple confirmation
// - choice: Level 2 - Card selection for architecture decisions
// - fillblank: Level 3 - Fill in the blank for deep understanding
// - parsons: Level 3 - Code sorting puzzle
export type QTEType = 'prediction' | 'choice' | 'fillblank' | 'parsons';
export type QTEDifficulty = 'easy' | 'medium' | 'hard';

export interface QTEOption {
	id: string;
	text: string;
}

export interface QTEContent {
	type: QTEType;
	difficulty: QTEDifficulty;
	question: string;
	options: QTEOption[];
	hint?: string;
	timeout?: number;  // Countdown in seconds (default varies by type)
	defaultOption?: string;  // Default option id if timeout (for choice)

	// Level 1 Prediction specific
	action?: string;  // Action text for prediction (e.g., "Press Tab to confirm")
	preview?: string;  // Code preview for prediction

	// Level 3 FillBlank specific
	context?: string;  // Code context with ___ placeholder
	answer?: string;   // Expected answer (for validation)

	// Level 3 Parsons specific
	codeBlocks?: string[];  // Shuffled code blocks for parsons puzzle
}

export type DiagramType = 'mermaid' | 'svg' | 'ascii';

export interface DiagramContent {
	type: DiagramType;
	content: string;
	caption?: string;
}

export interface ThoughtContent {
	content: string;
	status: 'thinking' | 'complete';
}

export interface ActionContent {
	title: string;
	file?: string;
	content: string;
	status: 'pending' | 'streaming' | 'complete';
}

export type CurriculumStepStatus = 'pending' | 'current' | 'complete' | 'skipped';

export interface CurriculumStep {
	id: string;
	title: string;
	status: CurriculumStepStatus;
}

export interface CurriculumContent {
	steps: CurriculumStep[];
}

export interface LensContent {
	line: number;
	concept: string;
	content: string;
}

// Background Task Types
export type BackgroundTaskType = 'fix' | 'dev' | 'refactor' | 'test' | 'install';

export interface BackgroundTaskContent {
	type: BackgroundTaskType;
	trigger: 'auto' | 'manual';
	description: string;
	context: string;
}

// Co-Create Types for Ghost Text Co-Creation
export type CoCreateDifficulty = 'easy' | 'medium' | 'hard';

export interface CoCreateBranch {
	id: string;
	trigger: string;  // What user types to match this branch (e.g., "try", "const")
	next?: string;     // Additional text to expect after trigger
	code: string;      // Full code for this branch
}

// QTE Point for streaming co-creation (embedded in code)
export interface CoCreateQTEPoint {
	id: string;              // Unique identifier
	position: number;        // Character position in the full code
	expected: string;        // Expected user input
	alternatives: string[];  // Acceptable alternative answers (comma-separated in markup)
	hint: string;            // Hint to show user
	timeout: number;         // Timeout in seconds for this QTE point
}

export interface CoCreateContent {
	file: string;          // Target file path
	line: number;          // Line number to insert at
	timeout: number;       // Seconds before auto-complete
	difficulty: CoCreateDifficulty;
	skill: string;         // The skill being practiced (e.g., "async-await", "error-handling")
	context: string;       // Code context before the blank
	hint?: string;         // Hint to show user
	branches: CoCreateBranch[];
	defaultCode: string;   // Default code if timeout/no match
	// Streaming mode fields
	isStreamingMode?: boolean;  // Whether this is streaming mode with QTE points
	code?: string;              // Full code (for streaming mode)
	qtePoints?: CoCreateQTEPoint[];  // QTE points embedded in code
}

export type ParsedContentType = 'text' | 'qte' | 'diagram' | 'thought' | 'action' | 'curriculum' | 'lens' | 'background-task' | 'co-create';

export interface ParsedStudyContent {
	type: ParsedContentType;
	content: string;  // Raw content string
	parsed?: QTEContent | DiagramContent | ThoughtContent | ActionContent | CurriculumContent | LensContent | BackgroundTaskContent | CoCreateContent;
}

// ============== Parser Functions ==============

/**
 * Parse QTE tag content
 *
 * Level 1 Prediction Example:
 * <qte type="prediction" timeout="5">
 *   <question>Next we should handle exceptions</question>
 *   <action>Press Tab to complete try/catch block</action>
 *   <preview>try { ... } catch (error) { ... }</preview>
 * </qte>
 *
 * Level 2 Choice Example:
 * <qte type="choice" difficulty="medium" timeout="15" default="a">
 *   <question>Select authentication method</question>
 *   <option id="a">JWT Token</option>
 *   <option id="b">Session</option>
 *   <hint>JWT is more common for microservices</hint>
 * </qte>
 *
 * Level 3 FillBlank Example:
 * <qte type="fillblank" difficulty="hard" timeout="30" default="0.001">
 *   <question>What should learning_rate be?</question>
 *   <context>model.compile(optimizer=Adam(learning_rate=___))</context>
 *   <hint>Usually between 0.0001 and 0.01</hint>
 * </qte>
 */
function parseQTE(content: string): QTEContent | null {
	try {
		// Extract attributes from opening tag
		const typeMatch = content.match(/type=["'](\w+)["']/);
		const difficultyMatch = content.match(/difficulty=["'](\w+)["']/);
		const timeoutMatch = content.match(/timeout=["'](\d+)["']/);
		const defaultMatch = content.match(/default=["']([^"']+)["']/);

		const type = (typeMatch?.[1] || 'choice') as QTEType;
		const difficulty = (difficultyMatch?.[1] || 'medium') as QTEDifficulty;

		// Default timeout varies by type
		const defaultTimeouts: Record<QTEType, number> = {
			prediction: 5,
			choice: 15,
			fillblank: 30,
			parsons: 60
		};
		const timeout = timeoutMatch ? parseInt(timeoutMatch[1], 10) : defaultTimeouts[type];
		const defaultOption = defaultMatch?.[1];

		// Extract question
		const questionMatch = content.match(/<question>([\s\S]*?)<\/question>/);
		const question = questionMatch?.[1]?.trim() || '';

		// Extract options (for choice type)
		const optionRegex = /<option\s+id=["'](\w+)["']>([\s\S]*?)<\/option>/g;
		const options: QTEOption[] = [];
		let optionMatch;
		while ((optionMatch = optionRegex.exec(content)) !== null) {
			options.push({
				id: optionMatch[1],
				text: optionMatch[2].trim()
			});
		}

		// Extract hint (optional, all types)
		const hintMatch = content.match(/<hint>([\s\S]*?)<\/hint>/);
		const hint = hintMatch?.[1]?.trim();

		// Level 1 Prediction specific fields
		const actionMatch = content.match(/<action>([\s\S]*?)<\/action>/);
		const action = actionMatch?.[1]?.trim();

		const previewMatch = content.match(/<preview>([\s\S]*?)<\/preview>/);
		const preview = previewMatch?.[1]?.trim();

		// Level 3 FillBlank specific fields
		const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/);
		const context = contextMatch?.[1]?.trim();

		const answerMatch = content.match(/<answer>([\s\S]*?)<\/answer>/);
		const answer = answerMatch?.[1]?.trim();

		// Level 3 Parsons specific fields
		const codeBlockRegex = /<code>([\s\S]*?)<\/code>/g;
		const codeBlocks: string[] = [];
		let codeMatch;
		while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
			codeBlocks.push(codeMatch[1].trim());
		}

		// Determine final default based on type
		let finalDefaultOption: string | undefined;
		if (type === 'choice') {
			finalDefaultOption = defaultOption || (options.length > 0 ? options[0].id : undefined);
		} else if (type === 'prediction') {
			finalDefaultOption = 'confirm';  // Always "confirm" for prediction
		} else if (type === 'fillblank') {
			finalDefaultOption = defaultOption || answer;  // Use answer as default if not specified
		}

		return {
			type,
			difficulty,
			question,
			options,
			hint,
			timeout,
			defaultOption: finalDefaultOption,
			// Level 1
			action,
			preview,
			// Level 3
			context,
			answer,
			codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined
		};
	} catch (e) {
		console.error('Failed to parse QTE:', e);
		return null;
	}
}

/**
 * Parse diagram tag content
 * Example:
 * <diagram type="mermaid">
 *   graph LR
 *     A --> B
 * </diagram>
 */
function parseDiagram(content: string): DiagramContent | null {
	try {
		const typeMatch = content.match(/type=["'](\w+)["']/);
		const type = (typeMatch?.[1] || 'mermaid') as DiagramType;

		// Extract inner content (between opening and closing tags)
		const innerMatch = content.match(/<diagram[^>]*>([\s\S]*?)<\/diagram>/);
		const diagramContent = innerMatch?.[1]?.trim() || content.trim();

		// Extract caption if present
		const captionMatch = content.match(/<caption>([\s\S]*?)<\/caption>/);
		const caption = captionMatch?.[1]?.trim();

		return { type, content: diagramContent, caption };
	} catch (e) {
		console.error('Failed to parse diagram:', e);
		return null;
	}
}

/**
 * Parse thought tag content
 * Example:
 * <thought>
 *   Analyzing project structure...
 * </thought>
 */
function parseThought(content: string): ThoughtContent | null {
	try {
		const innerMatch = content.match(/<thought[^>]*>([\s\S]*?)<\/thought>/);
		const thoughtContent = innerMatch?.[1]?.trim() || content.trim();

		// Status could be determined by streaming state
		return {
			content: thoughtContent,
			status: 'complete'
		};
	} catch (e) {
		console.error('Failed to parse thought:', e);
		return null;
	}
}

/**
 * Parse action tag content
 * Example:
 * <action title="Create auth middleware" file="src/middleware/auth.ts">
 *   Implementing JWT verification...
 * </action>
 */
function parseAction(content: string): ActionContent | null {
	try {
		const titleMatch = content.match(/title=["']([^"']+)["']/);
		const fileMatch = content.match(/file=["']([^"']+)["']/);

		const title = titleMatch?.[1] || 'Code Action';
		const file = fileMatch?.[1];

		const innerMatch = content.match(/<action[^>]*>([\s\S]*?)<\/action>/);
		const actionContent = innerMatch?.[1]?.trim() || '';

		return {
			title,
			file,
			content: actionContent,
			status: 'complete'
		};
	} catch (e) {
		console.error('Failed to parse action:', e);
		return null;
	}
}

/**
 * Parse curriculum tag content
 * Example:
 * <curriculum>
 *   <step id="1" status="complete">Understand project structure</step>
 *   <step id="2" status="current">Learn core dependencies</step>
 *   <step id="3" status="pending">Implement first feature</step>
 * </curriculum>
 */
function parseCurriculum(content: string): CurriculumContent | null {
	try {
		const stepRegex = /<step\s+id=["'](\w+)["']\s+status=["'](\w+)["']>([\s\S]*?)<\/step>/g;
		const steps: CurriculumStep[] = [];

		let stepMatch;
		while ((stepMatch = stepRegex.exec(content)) !== null) {
			steps.push({
				id: stepMatch[1],
				status: stepMatch[2] as CurriculumStepStatus,
				title: stepMatch[3].trim()
			});
		}

		return { steps };
	} catch (e) {
		console.error('Failed to parse curriculum:', e);
		return null;
	}
}

/**
 * Parse lens tag content
 * Example:
 * <lens line="15" concept="Decorator Pattern">
 *   This uses the decorator pattern to implement cross-cutting concerns...
 * </lens>
 */
function parseLens(content: string): LensContent | null {
	try {
		const lineMatch = content.match(/line=["'](\d+)["']/);
		const conceptMatch = content.match(/concept=["']([^"']+)["']/);

		const line = parseInt(lineMatch?.[1] || '1', 10);
		const concept = conceptMatch?.[1] || 'Concept';

		const innerMatch = content.match(/<lens[^>]*>([\s\S]*?)<\/lens>/);
		const lensContent = innerMatch?.[1]?.trim() || '';

		return { line, concept, content: lensContent };
	} catch (e) {
		console.error('Failed to parse lens:', e);
		return null;
	}
}

/**
 * Parse background-task tag content
 * Example:
 * <background-task type="fix" trigger="auto">
 *   <description>Fix null pointer exception in parseUserData</description>
 *   <context>TypeError: Cannot read property 'name' of undefined</context>
 * </background-task>
 */
function parseBackgroundTask(content: string): BackgroundTaskContent | null {
	try {
		const typeMatch = content.match(/type=["'](\w+)["']/);
		const triggerMatch = content.match(/trigger=["'](\w+)["']/);

		const type = (typeMatch?.[1] || 'fix') as BackgroundTaskType;
		const trigger = (triggerMatch?.[1] || 'auto') as 'auto' | 'manual';

		// Extract description
		const descMatch = content.match(/<description>([\s\S]*?)<\/description>/);
		const description = descMatch?.[1]?.trim() || '';

		// Extract context
		const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/);
		const context = contextMatch?.[1]?.trim() || '';

		return { type, trigger, description, context };
	} catch (e) {
		console.error('Failed to parse background-task:', e);
		return null;
	}
}

/**
 * Parse co-create tag content for Ghost Text co-creation
 * Example:
 * <co-create
 *   file="src/utils/api.ts"
 *   line="42"
 *   timeout="15"
 *   difficulty="medium"
 *   skill="async-await"
 * >
 *   <context>
 *     export async function fetchData(url: string) {
 *   </context>
 *   <blank hint="Handle async request">
 *     ___CURSOR___
 *   </blank>
 *   <branches>
 *     <branch id="a" trigger="try" next="await fetch">
 *       try {
 *         const response = await fetch(url);
 *         return await response.json();
 *       } catch (error) {
 *         throw error;
 *       }
 *     </branch>
 *     <branch id="b" trigger="const" next="= await">
 *       const response = await fetch(url);
 *       return response.json();
 *     </branch>
 *   </branches>
 *   <default>
 *     try {
 *       const response = await fetch(url);
 *       return await response.json();
 *     } catch (error) {
 *       throw error;
 *     }
 *   </default>
 * </co-create>
 */
function parseCoCreate(content: string): CoCreateContent | null {
	try {
		// Extract main attributes
		const fileMatch = content.match(/file=["']([^"']+)["']/);
		const lineMatch = content.match(/line=["'](\d+)["']/);
		const timeoutMatch = content.match(/timeout=["'](\d+)["']/);
		const difficultyMatch = content.match(/difficulty=["'](\w+)["']/);
		const skillMatch = content.match(/skill=["']([^"']+)["']/);

		const file = fileMatch?.[1] || '';
		const line = parseInt(lineMatch?.[1] || '1', 10);
		const timeout = parseInt(timeoutMatch?.[1] || '15', 10);
		const difficulty = (difficultyMatch?.[1] || 'medium') as CoCreateDifficulty;
		const skill = skillMatch?.[1] || 'coding';

		// Check if this is streaming mode with <code> block
		const codeMatch = content.match(/<code>([\s\S]*?)<\/code>/);
		if (codeMatch) {
			// Streaming mode with QTE points
			return parseStreamingCoCreate(content, file, line, timeout, difficulty, skill, codeMatch[1]);
		}

		// Legacy mode with branches
		// Extract context
		const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/);
		const context = contextMatch?.[1]?.trim() || '';

		// Extract hint from blank tag
		const blankMatch = content.match(/<blank[^>]*hint=["']([^"']+)["'][^>]*>/);
		const hint = blankMatch?.[1];

		// Extract branches
		const branchRegex = /<branch\s+id=["'](\w+)["']\s+trigger=["']([^"']+)["'](?:\s+next=["']([^"']+)["'])?>([\s\S]*?)<\/branch>/g;
		const branches: CoCreateBranch[] = [];
		let branchMatch;
		while ((branchMatch = branchRegex.exec(content)) !== null) {
			branches.push({
				id: branchMatch[1],
				trigger: branchMatch[2],
				next: branchMatch[3],
				code: branchMatch[4].trim()
			});
		}

		// Extract default code
		const defaultMatch = content.match(/<default>([\s\S]*?)<\/default>/);
		const defaultCode = defaultMatch?.[1]?.trim() || '';

		return {
			file,
			line,
			timeout,
			difficulty,
			skill,
			context,
			hint,
			branches,
			defaultCode,
			isStreamingMode: false
		};
	} catch (e) {
		console.error('Failed to parse co-create:', e);
		return null;
	}
}

/**
 * Parse streaming mode co-create with embedded QTE points
 * Example:
 * <co-create file="xxx.ts" line="10">
 *   <code>
 * async function fetchUser(id: string) {
 *   const response = await fetch(`/users/${id}`);
 *   <qte id="1" hint="处理响应" timeout="10" expected="return await response.json();">___</qte>
 * }
 *   </code>
 * </co-create>
 */
function parseStreamingCoCreate(
	content: string,
	file: string,
	line: number,
	timeout: number,
	difficulty: CoCreateDifficulty,
	skill: string,
	codeContent: string
): CoCreateContent {
	const qtePoints: CoCreateQTEPoint[] = [];

	// Parse QTE points from code content
	// Format: <qte id="1" hint="..." timeout="10" expected="..." alternatives="alt1,alt2">___</qte>
	const qteRegex = /<qte\s+id=["']([^"']+)["']\s+hint=["']([^"']+)["']\s+timeout=["'](\d+)["']\s+expected=["']([^"']+)["'](?:\s+alternatives=["']([^"']+)["'])?\s*>([^<]*)<\/qte>/g;

	let qteMatch;
	let cleanCode = codeContent;
	const qtePositions: { start: number; end: number; id: string }[] = [];

	// First pass: find all QTE tags and their positions
	while ((qteMatch = qteRegex.exec(codeContent)) !== null) {
		const fullMatch = qteMatch[0];
		const id = qteMatch[1];
		const hint = qteMatch[2];
		const qteTimeout = parseInt(qteMatch[3], 10);
		const expected = qteMatch[4];
		const alternativesStr = qteMatch[5] || '';
		const alternatives = alternativesStr ? alternativesStr.split(',').map(s => s.trim()) : [];

		qtePositions.push({
			start: qteMatch.index,
			end: qteMatch.index + fullMatch.length,
			id
		});

		qtePoints.push({
			id,
			position: 0, // Will be calculated after cleaning
			expected,
			alternatives,
			hint,
			timeout: qteTimeout
		});
	}

	// Calculate clean code and QTE positions
	// Replace QTE tags with empty string to get clean code
	let offset = 0;
	for (let i = 0; i < qtePositions.length; i++) {
		const pos = qtePositions[i];
		const qte = qtePoints[i];

		// Position in clean code is the start position minus previous offsets
		qte.position = pos.start - offset;

		// Update offset for next iteration
		const tagLength = pos.end - pos.start;
		offset += tagLength;
	}

	// Remove QTE tags from code to get clean code
	cleanCode = codeContent.replace(/<qte[^>]*>[^<]*<\/qte>/g, '').trim();

	// Extract hint from the first QTE point if available
	const hint = qtePoints[0]?.hint;

	return {
		file,
		line,
		timeout,
		difficulty,
		skill,
		context: '',
		hint,
		branches: [],
		defaultCode: cleanCode,
		isStreamingMode: true,
		code: cleanCode,
		qtePoints
	};
}

// ============== Main Parser ==============

/**
 * Parse study mode output into structured content segments
 *
 * @param raw - Raw LLM output string
 * @returns Array of parsed content segments
 */
export function parseStudyModeOutput(raw: string): ParsedStudyContent[] {
	const results: ParsedStudyContent[] = [];

	// Regular expression to match all study mode tags
	const tagRegex = /<(qte|diagram|thought|action|curriculum|lens|background-task|co-create)[\s\S]*?<\/\1>/gi;

	let lastIndex = 0;
	let match;

	while ((match = tagRegex.exec(raw)) !== null) {
		// Add text before this match
		if (match.index > lastIndex) {
			const textBefore = raw.slice(lastIndex, match.index).trim();
			if (textBefore) {
				results.push({
					type: 'text',
					content: textBefore
				});
			}
		}

		const fullMatch = match[0];
		const tagName = match[1].toLowerCase() as ParsedContentType;

		let parsed: ParsedStudyContent['parsed'] = undefined;

		switch (tagName) {
			case 'qte':
				parsed = parseQTE(fullMatch) || undefined;
				break;
			case 'diagram':
				parsed = parseDiagram(fullMatch) || undefined;
				break;
			case 'thought':
				parsed = parseThought(fullMatch) || undefined;
				break;
			case 'action':
				parsed = parseAction(fullMatch) || undefined;
				break;
			case 'curriculum':
				parsed = parseCurriculum(fullMatch) || undefined;
				break;
			case 'lens':
				parsed = parseLens(fullMatch) || undefined;
				break;
			case 'background-task':
				parsed = parseBackgroundTask(fullMatch) || undefined;
				break;
			case 'co-create':
				parsed = parseCoCreate(fullMatch) || undefined;
				break;
		}

		results.push({
			type: tagName,
			content: fullMatch,
			parsed
		});

		lastIndex = match.index + fullMatch.length;
	}

	// Add remaining text after last match
	if (lastIndex < raw.length) {
		const remainingText = raw.slice(lastIndex).trim();
		if (remainingText) {
			results.push({
				type: 'text',
				content: remainingText
			});
		}
	}

	// If no special tags found, return the entire content as text
	if (results.length === 0 && raw.trim()) {
		results.push({
			type: 'text',
			content: raw.trim()
		});
	}

	return results;
}

/**
 * Extract all QTE content from parsed segments
 */
export function extractQTEs(segments: ParsedStudyContent[]): QTEContent[] {
	return segments
		.filter(s => s.type === 'qte' && s.parsed)
		.map(s => s.parsed as QTEContent);
}

/**
 * Extract curriculum from parsed segments
 */
export function extractCurriculum(segments: ParsedStudyContent[]): CurriculumContent | null {
	const curriculumSegment = segments.find(s => s.type === 'curriculum' && s.parsed);
	return curriculumSegment?.parsed as CurriculumContent || null;
}

/**
 * Extract background tasks from parsed segments
 */
export function extractBackgroundTasks(segments: ParsedStudyContent[]): BackgroundTaskContent[] {
	return segments
		.filter(s => s.type === 'background-task' && s.parsed)
		.map(s => s.parsed as BackgroundTaskContent);
}

/**
 * Extract co-create content from parsed segments
 */
export function extractCoCreate(segments: ParsedStudyContent[]): CoCreateContent | null {
	const coCreateSegment = segments.find(s => s.type === 'co-create' && s.parsed);
	return coCreateSegment?.parsed as CoCreateContent || null;
}

/**
 * Check if content contains any study mode tags
 */
export function hasStudyModeTags(content: string): boolean {
	return /<(qte|diagram|thought|action|curriculum|lens|background-task|co-create)\s/i.test(content);
}

/**
 * Information about incomplete/streaming block
 */
export interface IncompleteBlockInfo {
	tagName: string;
	startIndex: number;
	partialContent: string;
}

/**
 * Detect if content has an incomplete (unclosed) study mode block
 * This is used during streaming to show a buffering indicator
 */
export function detectIncompleteBlock(content: string): IncompleteBlockInfo | null {
	const tagNames = ['qte', 'diagram', 'thought', 'action', 'curriculum', 'lens', 'background-task', 'co-create'];

	for (const tagName of tagNames) {
		// Find opening tag
		const openTagRegex = new RegExp(`<${tagName}[^>]*>`, 'gi');
		const closeTagRegex = new RegExp(`</${tagName}>`, 'gi');

		// Count opening and closing tags
		const openMatches = content.match(openTagRegex) || [];
		const closeMatches = content.match(closeTagRegex) || [];

		if (openMatches.length > closeMatches.length) {
			// Find the last unclosed opening tag
			let lastOpenIndex = -1;
			let match;
			openTagRegex.lastIndex = 0;
			while ((match = openTagRegex.exec(content)) !== null) {
				lastOpenIndex = match.index;
			}

			if (lastOpenIndex !== -1) {
				return {
					tagName,
					startIndex: lastOpenIndex,
					partialContent: content.slice(lastOpenIndex)
				};
			}
		}
	}

	return null;
}

/**
 * Get display name for a tag type
 */
export function getTagDisplayName(tagName: string): string {
	const displayNames: Record<string, string> = {
		'qte': '🎮 准备测验问题',
		'diagram': '📊 生成图表',
		'thought': '🤔 思考中',
		'action': '⚡ 准备代码操作',
		'curriculum': '📚 构建学习路径',
		'lens': '🔍 标注知识点',
		'background-task': '⏳ 启动后台任务',
		'co-create': '👨‍💻 准备共创编码'
	};
	return displayNames[tagName.toLowerCase()] || `📝 处理 ${tagName}`;
}

/**
 * Parse study mode output with streaming support
 * Returns both parsed content and information about any incomplete block
 */
export interface StreamingParseResult {
	segments: ParsedStudyContent[];
	incompleteBlock: IncompleteBlockInfo | null;
	/** Content before the incomplete block (safe to render) */
	safeContent: string;
}

export function parseStudyModeOutputStreaming(raw: string): StreamingParseResult {
	const incompleteBlock = detectIncompleteBlock(raw);

	if (incompleteBlock) {
		// Only parse content before the incomplete block
		const safeContent = raw.slice(0, incompleteBlock.startIndex);
		const segments = parseStudyModeOutput(safeContent);
		return {
			segments,
			incompleteBlock,
			safeContent
		};
	}

	// No incomplete block, parse everything
	return {
		segments: parseStudyModeOutput(raw),
		incompleteBlock: null,
		safeContent: raw
	};
}


