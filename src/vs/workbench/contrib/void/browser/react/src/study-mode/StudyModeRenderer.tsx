/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../../../common/chatThreadServiceTypes.js';
import {
	parseStudyModeOutput,
	parseStudyModeOutputStreaming,
	extractCurriculum,
	extractBackgroundTasks,
	extractCoCreate,
	getTagDisplayName,
	ParsedStudyContent,
	QTEContent,
	DiagramContent,
	ThoughtContent,
	ActionContent,
	CurriculumContent,
	BackgroundTaskContent,
	CoCreateContent,
	IncompleteBlockInfo,
} from '../../../../common/studyModeParser.js';

import { MissionRadar, BackgroundTaskState } from './MissionRadar.js';
import { LearningCard } from './LearningCard.js';
import { ThoughtBlock, ThinkingIndicator } from './ThoughtBlock.js';
import { DiagramCard } from './DiagramCard.js';
import { ActionCard } from './ActionCard.js';
import { QTECard } from './QTECard.js';
import { QTEPrediction } from './QTEPrediction.js';
import { QTEFillBlank } from './QTEFillBlank.js';
import { CurriculumCard } from './CurriculumCard.js';
import { CoCreateCard } from './CoCreateCard.js';
import { ChatMarkdownRender, ChatMessageLocation } from '../markdown/ChatMarkdownRender.js';
import { ChatBubble } from '../sidebar-tsx/SidebarChat.js';
import { IsRunningType } from '../../../chatThreadService.js';
import type { CoCreationSession } from '../../../studyCoCreationService.js';

/**
 * Study Mode Renderer
 * Main component that renders the learning stream in study mode
 */

export interface StudyModeRendererProps {
	/** Chat messages to render */
	messages: ChatMessage[];
	/** Thread ID for message location context */
	threadId: string;
	/** Whether the chat is currently streaming */
	isStreaming?: boolean;
	/** Chat running state for tool message rendering */
	chatIsRunning?: IsRunningType;
	/** Current checkpoint index for tool message rendering */
	currCheckpointIdx?: number;
	/** Callback when QTE option is selected */
	onQTESelect?: (qteId: string, optionId: string, meta?: { wasTimeout?: boolean }) => void;
	/** Callback to sync action to editor */
	onSyncToEditor?: (file: string) => void;
	/** Callback when a background task is triggered */
	onBackgroundTaskTrigger?: (task: BackgroundTaskContent) => void;
	/** Current background task state */
	backgroundTask?: BackgroundTaskState | null;
	/** Callback when a co-creation session is triggered */
	onCoCreateTrigger?: (content: CoCreateContent) => void;
	/** Current co-creation session state */
	coCreationSession?: CoCreationSession | null;
	/** Callback to skip co-creation */
	onCoCreateSkip?: () => void;
	/** Callback to focus on co-creation location */
	onCoCreateFocus?: () => void;
	/** Hide the internal MissionRadar (when it's rendered externally) */
	hideMissionRadar?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Render a single parsed study content segment
 */
const StudyContentSegment: React.FC<{
	segment: ParsedStudyContent;
	index: number;
	chatMessageLocation: ChatMessageLocation;
	onQTESelect?: (optionId: string, meta?: { wasTimeout?: boolean }) => void;
	onSyncToEditor?: (file: string) => void;
	onBackgroundTaskTrigger?: (task: BackgroundTaskContent) => void;
	onCoCreateTrigger?: (content: CoCreateContent) => void;
	coCreationSession?: CoCreationSession | null;
	onCoCreateSkip?: () => void;
	onCoCreateFocus?: () => void;
}> = ({ segment, index, chatMessageLocation, onQTESelect, onSyncToEditor, onBackgroundTaskTrigger, onCoCreateTrigger, coCreationSession, onCoCreateSkip, onCoCreateFocus }) => {
	switch (segment.type) {
		case 'qte': {
			const qteContent = segment.parsed as QTEContent;

			// Render different QTE components based on type
			switch (qteContent.type) {
				case 'prediction':
					return (
						<QTEPrediction
							key={`qte-prediction-${index}`}
							content={qteContent}
							onSelect={onQTESelect}
						/>
					);

				case 'fillblank':
					return (
						<QTEFillBlank
							key={`qte-fillblank-${index}`}
							content={qteContent}
							onSelect={onQTESelect}
						/>
					);

				case 'choice':
				default:
					return (
						<QTECard
							key={`qte-${index}`}
							content={qteContent}
							onSelect={onQTESelect}
						/>
					);
			}
		}

		case 'diagram':
			return (
				<DiagramCard
					key={`diagram-${index}`}
					content={segment.parsed as DiagramContent}
				/>
			);

		case 'thought':
			return (
				<ThoughtBlock
					key={`thought-${index}`}
					content={segment.parsed as ThoughtContent}
				/>
			);

		case 'action':
			return (
				<ActionCard
					key={`action-${index}`}
					content={segment.parsed as ActionContent}
					onSyncToEditor={onSyncToEditor}
				/>
			);

		case 'curriculum':
			return (
				<CurriculumCard
					key={`curriculum-${index}`}
					content={segment.parsed as CurriculumContent}
				/>
			);

		case 'background-task': {
			const taskContent = segment.parsed as BackgroundTaskContent;
			// Use dedicated component to handle side effects properly
			return (
				<BackgroundTaskSegment
					key={`bg-task-${index}`}
					content={taskContent}
					onTrigger={onBackgroundTaskTrigger}
				/>
			);
		}

		case 'co-create': {
			const coCreateContent = segment.parsed as CoCreateContent;

			// Use a dedicated component for co-create to properly handle side effects
			return (
				<CoCreateSegment
					key={`co-create-${index}`}
					content={coCreateContent}
					onTrigger={onCoCreateTrigger}
					session={coCreationSession}
					onSkip={onCoCreateSkip}
					onFocus={onCoCreateFocus}
				/>
			);
		}

		case 'text':
		default:
			// Render regular text using ChatMarkdownRender for markdown support
			return (
				<div key={`text-${index}`} className="study-text-segment">
					<ChatMarkdownRender
						string={segment.content}
						chatMessageLocation={chatMessageLocation}
					/>
				</div>
			);
	}
};

/**
 * BackgroundTask Segment Component
 * Properly handles side effects using useEffect to prevent duplicate task creation
 */
const BackgroundTaskSegment: React.FC<{
	content: BackgroundTaskContent;
	onTrigger?: (content: BackgroundTaskContent) => void;
}> = ({ content, onTrigger }) => {
	// Track if this specific task has been triggered - using a stable ID
	const hasTriggeredRef = useRef(false);
	const contentIdRef = useRef<string>(`${content.type}:${content.description}:${content.trigger}`);

	// Generate a stable content ID
	const contentId = `${content.type}:${content.description}:${content.trigger}`;

	// Use useEffect to trigger only once when content first appears
	useEffect(() => {
		// If the content changed significantly, reset the trigger flag
		if (contentIdRef.current !== contentId) {
			hasTriggeredRef.current = false;
			contentIdRef.current = contentId;
		}

		// Only trigger if not already triggered and callback exists
		if (!hasTriggeredRef.current && onTrigger) {
			hasTriggeredRef.current = true;
			// Small delay to ensure component is mounted
			const timer = setTimeout(() => {
				onTrigger(content);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [contentId, onTrigger]); // Intentionally not including content to prevent re-triggers

	// Render the task notification
	return (
		<div className="mb-4">
			<LearningCard
				icon={content.type === 'fix' ? '🔧' :
					content.type === 'dev' ? '🛠️' :
						content.type === 'refactor' ? '♻️' :
							content.type === 'test' ? '🧪' : '📦'}
				title="后台任务"
				borderColor="#F59E0B"
			>
				<div className="text-sm text-void-fg-2">
					<div className="void-font-medium void-text-amber-500">
						{content.trigger === 'auto' ? '自动启动' : '用户请求'}：{content.description}
					</div>
					{content.context && (
						<div className="mt-1 text-xs text-void-fg-3 bg-void-bg-3 p-2 rounded">
							{content.context.slice(0, 200)}
							{content.context.length > 200 && '...'}
						</div>
					)}
					<div className="mt-2 text-xs text-void-fg-3 italic">
						任务将在后台执行，你可以继续学习...
					</div>
				</div>
			</LearningCard>
		</div>
	);
};

/**
 * CoCreate Segment Component
 * Properly handles side effects using useEffect to prevent infinite loops
 */
const CoCreateSegment: React.FC<{
	content: CoCreateContent;
	onTrigger?: (content: CoCreateContent) => void;
	session?: CoCreationSession | null;
	onSkip?: () => void;
	onFocus?: () => void;
}> = ({ content, onTrigger, session, onSkip, onFocus }) => {
	// Track if this specific co-create has been triggered
	const hasTriggeredRef = useRef(false);
	const contentIdRef = useRef<string>(`${content.file}:${content.line}:${content.skill}`);

	// Check if the session matches this content
	const contentId = `${content.file}:${content.line}:${content.skill}`;
	const sessionMatches = session && `${session.file}:${session.line}:${session.skill}` === contentId;

	// Use useEffect to trigger only once when content first appears
	useEffect(() => {
		// If the content changed, reset the trigger flag
		if (contentIdRef.current !== contentId) {
			hasTriggeredRef.current = false;
			contentIdRef.current = contentId;
		}

		// Only trigger if not already triggered and callback exists
		if (!hasTriggeredRef.current && onTrigger) {
			hasTriggeredRef.current = true;
			// Small delay to ensure component is mounted
			const timer = setTimeout(() => {
				onTrigger(content);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [content, contentId, onTrigger]);

	// If there's an active co-creation session that matches THIS content, show the CoCreateCard
	if (sessionMatches) {
		return (
			<div className="mb-4">
				<CoCreateCard
					session={session}
					onSkip={onSkip}
					onFocus={onFocus}
				/>
			</div>
		);
	}

	// Show a placeholder while session is starting or for unmatched sessions
	return (
		<div className="mb-4">
			<LearningCard
				icon="👨‍💻"
				title="共创编码"
				borderColor="#14B8A6"
			>
				<div className="text-sm text-void-fg-2">
					<div className="font-medium text-teal-500">
						准备共创编码练习...
					</div>
					<div className="mt-1 text-xs text-void-fg-3">
						📄 {content.file}:{content.line}
					</div>
					<div className="mt-2 text-xs text-void-fg-3">
						技能: {content.skill} · 难度: {content.difficulty}
					</div>
					{content.hint && (
						<div className="mt-2 bg-void-bg-2 rounded p-2 text-xs">
							💡 {content.hint}
						</div>
					)}
				</div>
			</LearningCard>
		</div>
	);
};

/**
 * Buffering indicator for incomplete blocks during streaming
 */
const BlockBufferingIndicator: React.FC<{
	incompleteBlock: IncompleteBlockInfo;
}> = ({ incompleteBlock }) => {
	const displayName = getTagDisplayName(incompleteBlock.tagName);

	return (
		<div className="study-buffering-indicator mb-4">
			<LearningCard
				icon="⏳"
				title="Tutor"
				borderColor="#2DD4BF"
			>
				<div className="flex items-center gap-2 py-2">
					{/* Animated loading dots */}
					<div className="flex gap-1">
						<span className="void-w-2 void-h-2 void-bg-teal-400 void-rounded-full void-animate-bounce" style={{ animationDelay: '0ms' }} />
						<span className="void-w-2 void-h-2 void-bg-teal-400 void-rounded-full void-animate-bounce" style={{ animationDelay: '150ms' }} />
						<span className="void-w-2 void-h-2 void-bg-teal-400 void-rounded-full void-animate-bounce" style={{ animationDelay: '300ms' }} />
					</div>
					<span className="text-sm text-void-fg-2">{displayName}...</span>
				</div>
			</LearningCard>
		</div>
	);
};

/**
 * Render a single message in study mode
 */
const StudyMessage: React.FC<{
	message: ChatMessage;
	messageIdx: number;
	threadId: string;
	isStreaming?: boolean;  // Whether this specific message is currently streaming
	chatIsRunning?: IsRunningType;
	currCheckpointIdx?: number;
	onQTESelect?: (qteId: string, optionId: string, meta?: { wasTimeout?: boolean }) => void;
	onSyncToEditor?: (file: string) => void;
	onBackgroundTaskTrigger?: (task: BackgroundTaskContent) => void;
	onCoCreateTrigger?: (content: CoCreateContent) => void;
	coCreationSession?: CoCreationSession | null;
	onCoCreateSkip?: () => void;
	onCoCreateFocus?: () => void;
}> = ({ message, messageIdx, threadId, isStreaming = false, chatIsRunning, currCheckpointIdx, onQTESelect, onSyncToEditor, onBackgroundTaskTrigger, onCoCreateTrigger, coCreationSession, onCoCreateSkip, onCoCreateFocus }) => {
	// Skip checkpoint messages (internal Void state)
	if (message.role === 'checkpoint') {
		return null;
	}

	// For tool messages and interrupted_streaming_tool, use standard ChatBubble rendering
	if (message.role === 'tool' || message.role === 'interrupted_streaming_tool') {
		return (
			<ChatBubble
				chatMessage={message}
				messageIdx={messageIdx}
				threadId={threadId}
				chatIsRunning={chatIsRunning}
				currCheckpointIdx={currCheckpointIdx}
				isCommitted={true}
				_scrollToBottom={null}
			/>
		);
	}

	const chatMessageLocation: ChatMessageLocation = { threadId, messageIdx };

	// Get the display content - in Void, displayContent is the main text for assistant messages
	const textContent = message.displayContent || '';

	// Skip rendering empty assistant messages
	if (!textContent && message.role === 'assistant') {
		return null;
	}

	// Parse message content for study mode tags
	// Use streaming-aware parsing for messages that are currently streaming
	const parseResult = useMemo(() => {
		if (message.role !== 'assistant' || !textContent) {
			return null;
		}

		// If this message is streaming, use streaming-aware parsing to detect incomplete blocks
		if (isStreaming) {
			return parseStudyModeOutputStreaming(textContent);
		}

		// For completed messages, use regular parsing
		return {
			segments: parseStudyModeOutput(textContent),
			incompleteBlock: null,
			safeContent: textContent
		};
	}, [message.role, textContent, isStreaming]);

	// For user messages, use standard rendering
	if (message.role === 'user') {
		return (
			<div className="study-user-message mb-4">
				<LearningCard
					icon="👤"
					title="You"
					borderColor="#6B7280"
				>
					<div className="text-sm text-void-fg-1">
						{textContent}
					</div>
				</LearningCard>
			</div>
		);
	}

	// For assistant messages with parsed study content
	if (parseResult && parseResult.segments.length > 0) {
		return (
			<div className="study-assistant-message mb-4 space-y-3">
				{/* Render safe/complete segments */}
				{parseResult.segments.map((segment, index) => (
					<StudyContentSegment
						key={index}
						segment={segment}
						index={index}
						chatMessageLocation={chatMessageLocation}
						onQTESelect={
							onQTESelect
								? (optionId, meta) => onQTESelect(`${messageIdx}-${index}`, optionId, meta)
								: undefined
						}
						onSyncToEditor={onSyncToEditor}
						onBackgroundTaskTrigger={onBackgroundTaskTrigger}
						onCoCreateTrigger={onCoCreateTrigger}
						coCreationSession={coCreationSession}
						onCoCreateSkip={onCoCreateSkip}
						onCoCreateFocus={onCoCreateFocus}
					/>
				))}

				{/* Show buffering indicator if there's an incomplete block */}
				{parseResult.incompleteBlock && (
					<BlockBufferingIndicator incompleteBlock={parseResult.incompleteBlock} />
				)}
			</div>
		);
	}

	// Handle case where there's only an incomplete block (no complete segments yet)
	if (parseResult?.incompleteBlock && parseResult.segments.length === 0) {
		return (
			<div className="study-assistant-message mb-4 space-y-3">
				<BlockBufferingIndicator incompleteBlock={parseResult.incompleteBlock} />
			</div>
		);
	}

	// Fallback to standard ChatMarkdownRender (shouldn't reach here if textContent is empty)
	return (
		<div className="study-assistant-message mb-4">
			<LearningCard
				icon="🎓"
				title="Tutor"
				borderColor="#2DD4BF"
			>
				<ChatMarkdownRender
					string={textContent}
					chatMessageLocation={chatMessageLocation}
				/>
			</LearningCard>
		</div>
	);
};

export const StudyModeRenderer: React.FC<StudyModeRendererProps> = ({
	messages,
	threadId,
	isStreaming = false,
	chatIsRunning,
	currCheckpointIdx,
	onQTESelect,
	onSyncToEditor,
	onBackgroundTaskTrigger,
	backgroundTask,
	onCoCreateTrigger,
	coCreationSession,
	onCoCreateSkip,
	onCoCreateFocus,
	hideMissionRadar = false,
	className = '',
}) => {
	// Extract the LATEST curriculum from all messages (most recent curriculum wins)
	const curriculum = useMemo(() => {
		let latestCurriculum: CurriculumContent | null = null;

		for (const message of messages) {
			if (message.role !== 'assistant') continue;

			const textContent = message.displayContent;
			if (!textContent) continue;

			const parsed = parseStudyModeOutput(textContent);
			const curriculumInMsg = extractCurriculum(parsed);
			if (curriculumInMsg) {
				latestCurriculum = curriculumInMsg;  // Keep updating to get the latest
			}
		}

		return latestCurriculum;
	}, [messages]);

	// Calculate current step from curriculum
	const currentStepInfo = useMemo(() => {
		if (!curriculum) {
			return { currentStep: 0, totalSteps: 0, stepName: 'Getting started...' };
		}

		const currentStepIdx = curriculum.steps.findIndex(s => s.status === 'current');
		const completedCount = curriculum.steps.filter(s => s.status === 'complete').length;

		// For progress display: use completed count for the progress bar
		// currentStep here represents "progress made" (number of completed steps)
		return {
			currentStep: completedCount,
			totalSteps: curriculum.steps.length,
			stepName: currentStepIdx >= 0
				? `Step ${currentStepIdx + 1}: ${curriculum.steps[currentStepIdx]?.title}`
				: completedCount === curriculum.steps.length
					? '✅ All steps complete!'
					: 'Learning in progress...',
		};
	}, [curriculum]);

	// Debug: log whether MissionRadar should render
	const shouldShowMissionRadar = !hideMissionRadar && curriculum && curriculum.steps.length > 0;

	return (
		<div className={`study-mode-renderer ${className}`}>
			{/* Mission Radar - Sticky progress indicator (only show when curriculum exists and not hidden) */}
			{shouldShowMissionRadar && (
				<MissionRadar
					currentStep={currentStepInfo.currentStep}
					totalSteps={currentStepInfo.totalSteps}
					stepName={currentStepInfo.stepName}
					steps={curriculum!.steps}
					backgroundTask={backgroundTask}
				/>
			)}

			{/* Message stream */}
			<div className="study-message-stream p-3 space-y-4">
				{messages.map((message, idx) => {
					// The last assistant message is the one currently streaming
					const isLastMessage = idx === messages.length - 1;
					const isMessageStreaming = isStreaming && isLastMessage && message.role === 'assistant';

					return (
						<StudyMessage
							key={`${threadId}-${idx}`}
							message={message}
							messageIdx={idx}
							threadId={threadId}
							isStreaming={isMessageStreaming}
							chatIsRunning={chatIsRunning}
							currCheckpointIdx={currCheckpointIdx}
							onQTESelect={onQTESelect}
							onSyncToEditor={onSyncToEditor}
							onBackgroundTaskTrigger={onBackgroundTaskTrigger}
							onCoCreateTrigger={onCoCreateTrigger}
							coCreationSession={coCreationSession}
							onCoCreateSkip={onCoCreateSkip}
							onCoCreateFocus={onCoCreateFocus}
						/>
					);
				})}

				{/* General streaming indicator - only show when streaming but no content yet */}
				{isStreaming && messages.length === 0 && (
					<ThinkingIndicator message="Processing your request..." />
				)}
			</div>
		</div>
	);
};


