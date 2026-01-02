/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LearningCard } from './LearningCard.js';
import type { CoCreationSession } from '../../../studyCoCreationService.js';

/**
 * Co-Create Card Component
 * Displays in sidebar when a co-creation session is active
 * Shows countdown timer, hints, and current status
 */

export interface CoCreateCardProps {
	session: CoCreationSession;
	className?: string;
	onSkip?: () => void;
	onFocus?: () => void;
}

// Difficulty config
const DifficultyConfig = {
	easy: { color: '#10B981', label: '简单', borderColor: '#10B981' },
	medium: { color: '#F59E0B', label: '中等', borderColor: '#F59E0B' },
	hard: { color: '#EF4444', label: '困难', borderColor: '#EF4444' },
};

// Status config - supports all streaming co-creation states
const StatusConfig: Record<string, { label: string; icon: string }> = {
	pending: { label: '等待开始', icon: '⏳' },
	active: { label: '等待输入', icon: '✏️' },
	typing: { label: '正在输入', icon: '⌨️' },
	matched: { label: '已匹配分支', icon: '✅' },
	left_blank: { label: '等待填补', icon: '📝' },
	timeout: { label: '已超时', icon: '⏰' },
	completed: { label: '已完成', icon: '🎉' },
	skipped: { label: '已跳过', icon: '⏭️' },
	// New streaming states
	streaming: { label: '流式输出中', icon: '📝' },
	qte_waiting: { label: '等待输入', icon: '⏸️' },
	qte_correct: { label: '输入正确', icon: '✅' },
	qte_wrong: { label: '输入错误', icon: '❌' },
	explaining: { label: '解释中', icon: '💡' },
	abandoned: { label: '已放弃', icon: '🚫' },
};

export const CoCreateCard: React.FC<CoCreateCardProps> = ({
	session,
	className = '',
	onSkip,
	onFocus,
}) => {
	const [timeRemaining, setTimeRemaining] = useState<number>(session.timeout);
	const [progressPercent, setProgressPercent] = useState(100);
	const [leftBlankTimeRemaining, setLeftBlankTimeRemaining] = useState<number>(30); // 30 seconds for left_blank
	const startTimeRef = useRef<number>(session.startTime);
	const sessionIdRef = useRef<string>(session.id);
	const leftBlankStartRef = useRef<number | null>(null);
	const animationFrameRef = useRef<number | null>(null);

	const isActive = ['pending', 'active', 'typing', 'matched', 'streaming', 'qte_waiting'].includes(session.status);
	const isLeftBlank = session.status === 'left_blank';
	const difficultyConfig = DifficultyConfig[session.difficulty];
	const statusConfig = StatusConfig[session.status];

	// Reset timer when session changes (new session started)
	useEffect(() => {
		if (sessionIdRef.current !== session.id) {
			console.log('[CoCreateCard] Session changed, resetting timer. Old:', sessionIdRef.current, 'New:', session.id);
			sessionIdRef.current = session.id;
			startTimeRef.current = session.startTime;
			setTimeRemaining(session.timeout);
			setProgressPercent(100);
			leftBlankStartRef.current = null;
		}
	}, [session.id, session.startTime, session.timeout]);

	// Countdown timer with smooth animation
	useEffect(() => {
		if (!isActive) {
			console.log('[CoCreateCard] Timer not active, status:', session.status);
			return;
		}

		console.log('[CoCreateCard] Starting countdown timer, timeout:', session.timeout, 'startTime:', startTimeRef.current);

		const updateTimer = () => {
			const elapsed = (Date.now() - startTimeRef.current) / 1000;
			const remaining = Math.max(0, session.timeout - elapsed);
			const percent = (remaining / session.timeout) * 100;

			setTimeRemaining(Math.ceil(remaining));
			setProgressPercent(percent);

			if (remaining > 0) {
				animationFrameRef.current = requestAnimationFrame(updateTimer);
			}
		};

		// Start immediately
		updateTimer();

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [isActive, session.timeout, session.status]);

	// Handle left_blank state countdown
	useEffect(() => {
		if (!isLeftBlank) {
			leftBlankStartRef.current = null;
			return;
		}

		// Initialize left_blank start time
		if (leftBlankStartRef.current === null) {
			leftBlankStartRef.current = Date.now();
		}

		const updateLeftBlankTimer = () => {
			if (leftBlankStartRef.current === null) return;
			const elapsed = (Date.now() - leftBlankStartRef.current) / 1000;
			const remaining = Math.max(0, 30 - elapsed);
			setLeftBlankTimeRemaining(Math.ceil(remaining));

			if (remaining > 0) {
				animationFrameRef.current = requestAnimationFrame(updateLeftBlankTimer);
			}
		};

		animationFrameRef.current = requestAnimationFrame(updateLeftBlankTimer);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [isLeftBlank]);

	// Update start time if session changes
	useEffect(() => {
		startTimeRef.current = session.startTime;
	}, [session.startTime]);

	// Get progress bar color based on time remaining
	const getProgressColor = useCallback(() => {
		if (progressPercent > 50) return 'bg-teal-500';
		if (progressPercent > 25) return 'bg-amber-500';
		return 'bg-red-500';
	}, [progressPercent]);

	// Format file path for display
	const formatFilePath = (file: string) => {
		const parts = file.split('/');
		if (parts.length <= 2) return file;
		return `.../${parts.slice(-2).join('/')}`;
	};

	return (
		<LearningCard
			icon="👨‍💻"
			title="共创编码"
			borderColor={difficultyConfig.borderColor}
			className={className}
		>
			<div className="space-y-3">
				{/* Status and Difficulty badges */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span
							className="px-2 py-0.5 rounded text-xs font-medium"
							style={{ backgroundColor: `${difficultyConfig.color}20`, color: difficultyConfig.color }}
						>
							{difficultyConfig.label}
						</span>
						<span className="text-xs text-void-fg-3">
							{statusConfig.icon} {statusConfig.label}
						</span>
					</div>
					<span className="text-xs text-void-fg-3">
						{session.skill}
					</span>
				</div>

				{/* File and line info */}
				<div className="flex items-center gap-2 text-xs text-void-fg-2">
					<span>📄</span>
					<span className="font-mono">{formatFilePath(session.file)}:{session.line}</span>
				</div>

				{/* Countdown progress bar - for active/qte_waiting states */}
				{isActive && (
					<div className="space-y-1">
						<div className="flex items-center justify-between text-xs">
							<span className="text-void-fg-3">剩余时间</span>
							<span className={`font-mono ${timeRemaining <= 5 ? 'text-red-500 animate-pulse' : 'text-void-fg-2'}`}>
								{timeRemaining}s
							</span>
						</div>
						<div className="w-full h-1.5 bg-void-bg-3 rounded-full overflow-hidden">
							<div
								className={`h-full ${getProgressColor()} transition-all duration-100`}
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
					</div>
				)}

				{/* Streaming progress - show code generation progress */}
				{session.streamingState && session.status === 'streaming' && (
					<div className="space-y-2">
						<div className="bg-teal-500/10 border border-teal-500/30 rounded p-2">
							<div className="flex items-start gap-2">
								<span className="text-sm animate-pulse">📝</span>
								<div className="text-xs text-teal-400">
									<div className="font-medium">代码生成中...</div>
									<div className="mt-1 text-teal-300/80">
										进度: {Math.round((session.streamingState.currentIndex / session.streamingState.fullCode.length) * 100)}%
									</div>
								</div>
							</div>
						</div>
						<div className="w-full h-1.5 bg-void-bg-3 rounded-full overflow-hidden">
							<div
								className="h-full bg-teal-500 transition-all duration-100"
								style={{ width: `${(session.streamingState.currentIndex / session.streamingState.fullCode.length) * 100}%` }}
							/>
						</div>
					</div>
				)}

				{/* QTE Waiting - show expected input hint */}
				{session.status === 'qte_waiting' && session.streamingState && (
					<div className="space-y-2">
						<div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
							<div className="flex items-start gap-2">
								<span className="text-sm">⌨️</span>
								<div className="text-xs text-blue-400">
									<div className="font-medium">请在编辑器中输入代码</div>
									{session.streamingState.qtePoints[session.streamingState.currentQTEIndex] && (
										<div className="mt-1 text-blue-300/80">
											提示: {session.streamingState.qtePoints[session.streamingState.currentQTEIndex].hint}
										</div>
									)}
								</div>
							</div>
						</div>
						{/* Error counter if any errors */}
						{session.streamingState.errorCount > 0 && (
							<div className="text-xs text-amber-400">
								⚠️ 错误次数: {session.streamingState.errorCount}/{session.streamingState.maxErrors}
							</div>
						)}
					</div>
				)}

				{/* Explaining state - show explanation for wrong input */}
				{session.status === 'explaining' && session.currentExplanation && (
					<div className="bg-amber-500/10 border border-amber-500/30 rounded p-2">
						<div className="flex items-start gap-2">
							<span className="text-sm">💡</span>
							<div className="text-xs text-amber-400 whitespace-pre-wrap">
								{session.currentExplanation}
							</div>
						</div>
					</div>
				)}

				{/* Left blank state - waiting for user to fill in */}
				{isLeftBlank && (
					<div className="space-y-2">
						<div className="bg-amber-500/10 border border-amber-500/30 rounded p-2">
							<div className="flex items-start gap-2">
								<span className="text-sm">⚠️</span>
								<div className="text-xs text-amber-400">
									<div className="font-medium">等待填补代码</div>
									<div className="mt-1 text-amber-300/80">
										请在编辑器中完成代码填空。剩余 {leftBlankTimeRemaining}s
									</div>
								</div>
							</div>
						</div>
						<div className="w-full h-1.5 bg-void-bg-3 rounded-full overflow-hidden">
							<div
								className="h-full bg-amber-500 transition-all duration-100"
								style={{ width: `${(leftBlankTimeRemaining / 30) * 100}%` }}
							/>
						</div>
					</div>
				)}

				{/* Hint section */}
				{session.hint && (
					<div className="bg-void-bg-2 rounded p-2 border border-void-border-1">
						<div className="flex items-start gap-2">
							<span className="text-sm">💡</span>
							<span className="text-xs text-void-fg-2">{session.hint}</span>
						</div>
					</div>
				)}

				{/* Current input preview */}
				{session.userInput && (
					<div className="bg-void-bg-3 rounded p-2 font-mono text-xs text-void-fg-2">
						<span className="text-void-fg-3">你的输入: </span>
						<span className="text-teal-400">{session.userInput}</span>
						{session.matchedBranchId && (
							<span className="ml-2 text-green-500">✓ 已匹配</span>
						)}
					</div>
				)}

				{/* Action buttons */}
				<div className="flex items-center gap-2 pt-1">
					{onFocus && (
						<button
							onClick={onFocus}
							className="flex-1 px-3 py-1.5 text-xs rounded bg-teal-600 hover:bg-teal-700 text-white transition-colors"
						>
							跳转到编辑器
						</button>
					)}
					{onSkip && isActive && (
						<button
							onClick={onSkip}
							className="px-3 py-1.5 text-xs rounded bg-void-bg-3 hover:bg-void-bg-2 text-void-fg-2 transition-colors"
						>
							跳过
						</button>
					)}
				</div>

				{/* Instructions */}
				{isActive && (
					<div className="text-xs text-void-fg-3 border-t border-void-border-2 pt-2 mt-2">
						<div className="flex items-center gap-1">
							<kbd className="px-1.5 py-0.5 rounded bg-void-bg-3 text-void-fg-2 font-mono text-[10px]">Tab</kbd>
							<span>接受建议</span>
							<span className="mx-1">·</span>
							<span>开始输入以选择分支</span>
						</div>
					</div>
				)}
			</div>
		</LearningCard>
	);
};

/**
 * Compact version for minimal display
 */
export const CoCreateCardCompact: React.FC<{
	session: CoCreationSession;
	onFocus?: () => void;
}> = ({ session, onFocus }) => {
	const [timeRemaining, setTimeRemaining] = useState<number>(session.timeout);

	const isActive = ['pending', 'active', 'typing', 'matched'].includes(session.status);

	useEffect(() => {
		if (!isActive) return;

		const interval = setInterval(() => {
			const elapsed = (Date.now() - session.startTime) / 1000;
			const remaining = Math.max(0, session.timeout - elapsed);
			setTimeRemaining(Math.ceil(remaining));
		}, 100);

		return () => clearInterval(interval);
	}, [isActive, session.startTime, session.timeout]);

	return (
		<div
			onClick={onFocus}
			className="flex items-center gap-2 px-2 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded cursor-pointer hover:bg-teal-500/20 transition-colors"
		>
			<span className="text-sm">👨‍💻</span>
			<span className="text-xs text-teal-400 flex-1 truncate">
				共创: {session.skill}
			</span>
			{isActive && (
				<span className={`text-xs font-mono ${timeRemaining <= 5 ? 'text-red-500' : 'text-void-fg-3'}`}>
					{timeRemaining}s
				</span>
			)}
		</div>
	);
};
