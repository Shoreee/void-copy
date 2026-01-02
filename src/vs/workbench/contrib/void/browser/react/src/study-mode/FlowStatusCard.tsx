/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { FlowSession, FlowPoint } from '../../../flowEditorTypes.js';
import { LearningCard } from './LearningCard.js';

/**
 * Flow Status Card Component
 * Displays the current state of a flow editing session in the sidebar
 */

export interface FlowStatusCardProps {
	/** Current flow session */
	session: FlowSession;
	/** Callback when skip button is clicked */
	onSkip?: () => void;
	/** Callback to focus on current flow point in editor */
	onFocus?: () => void;
	/** Callback when accept is clicked */
	onAccept?: () => void;
}

export const FlowStatusCard: React.FC<FlowStatusCardProps> = ({
	session,
	onSkip,
	onFocus,
	onAccept,
}) => {
	const currentPoint = session.points[session.currentPointIndex];
	const [timeRemaining, setTimeRemaining] = useState(currentPoint?.timeout || 15);
	const timerRef = useRef<number | null>(null);
	const startTimeRef = useRef<number>(Date.now());

	// Reset timer when point changes
	useEffect(() => {
		if (currentPoint) {
			setTimeRemaining(currentPoint.timeout);
			startTimeRef.current = Date.now();
		}
	}, [currentPoint?.id]);

	// Countdown timer using requestAnimationFrame
	useEffect(() => {
		if (!currentPoint || session.status !== 'waiting') {
			return;
		}

		const animate = () => {
			const elapsed = (Date.now() - startTimeRef.current) / 1000;
			const remaining = Math.max(0, currentPoint.timeout - elapsed);
			setTimeRemaining(Math.ceil(remaining));

			if (remaining > 0) {
				timerRef.current = requestAnimationFrame(animate);
			}
		};

		timerRef.current = requestAnimationFrame(animate);

		return () => {
			if (timerRef.current) {
				cancelAnimationFrame(timerRef.current);
			}
		};
	}, [currentPoint, session.status]);

	if (!currentPoint) {
		return null;
	}

	const isUrgent = timeRemaining <= 5;
	const progressPercent = ((session.currentPointIndex + 1) / session.points.length) * 100;

	// Get status text based on session status
	const getStatusText = () => {
		switch (session.status) {
			case 'streaming':
				return '📝 AI 正在编写代码...';
			case 'waiting':
				return '✏️ 轮到你了！';
			case 'user_typing':
				return '⌨️ 正在输入...';
			case 'matched':
				return '✅ 已匹配分支';
			case 'completing':
				return '🔄 自动补全中...';
			default:
				return '🎯 心流编码';
		}
	};

	// Get skill badge color
	const getSkillColor = () => {
		switch (currentPoint.type) {
			case 'blank':
				return 'void-bg-teal-500/20 void-text-teal-400';
			case 'choice':
				return 'void-bg-amber-500/20 void-text-amber-400';
			case 'prediction':
				return 'void-bg-blue-500/20 void-text-blue-400';
			default:
				return 'void-bg-void-bg-3 void-text-void-fg-2';
		}
	};

	return (
		<LearningCard
			type="action"
			title={getStatusText()}
			icon="🎯"
		>
			<div className="void-space-y-3">
				{/* Progress indicator */}
				<div className="void-flex void-items-center void-gap-2">
					<div className="void-flex-1 void-h-1.5 void-bg-void-bg-3 void-rounded-full void-overflow-hidden">
						<div
							className="void-h-full void-bg-teal-500 void-transition-all void-duration-300"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					<span className="void-text-xs void-text-void-fg-3">
						{session.currentPointIndex + 1}/{session.points.length}
					</span>
				</div>

				{/* Skill badge */}
				<div className="void-flex void-items-center void-gap-2">
					<span className={`void-px-2 void-py-0.5 void-rounded void-text-xs ${getSkillColor()}`}>
						{currentPoint.skill}
					</span>
					<span className="void-text-xs void-text-void-fg-3">
						{currentPoint.type === 'blank' ? '填空' :
							currentPoint.type === 'choice' ? '选择' : '预测'}
					</span>
				</div>

				{/* Hint */}
				{currentPoint.hint && (
					<div className="void-text-sm void-text-void-fg-2 void-p-2 void-bg-void-bg-3 void-rounded">
						💡 {currentPoint.hint}
					</div>
				)}

				{/* Timer - only show when waiting */}
				{session.status === 'waiting' && (
					<div className={`void-flex void-items-center void-gap-2 void-text-sm ${isUrgent ? 'void-text-red-400' : 'void-text-void-fg-3'}`}>
						<span>⏱️</span>
						<span className={isUrgent ? 'void-animate-pulse' : ''}>
							{timeRemaining}s
						</span>
					</div>
				)}

				{/* File location */}
				<div className="void-text-xs void-text-void-fg-3 void-truncate">
					📁 {currentPoint.file}:{currentPoint.line}
				</div>

				{/* Action buttons */}
				<div className="void-flex void-gap-2 void-pt-1">
					{onFocus && (
						<button
							onClick={onFocus}
							className="void-flex-1 void-px-3 void-py-1.5 void-text-xs void-rounded void-bg-teal-500/20 void-text-teal-400 hover:void-bg-teal-500/30 void-transition-colors"
						>
							定位到编辑器
						</button>
					)}
					{session.status === 'matched' && onAccept && (
						<button
							onClick={onAccept}
							className="void-flex-1 void-px-3 void-py-1.5 void-text-xs void-rounded void-bg-green-500/20 void-text-green-400 hover:void-bg-green-500/30 void-transition-colors"
						>
							确认
						</button>
					)}
					{onSkip && (
						<button
							onClick={onSkip}
							className="void-px-3 void-py-1.5 void-text-xs void-rounded void-bg-void-bg-3 void-text-void-fg-3 hover:void-bg-void-bg-2 void-transition-colors"
						>
							跳过
						</button>
					)}
				</div>

				{/* Keyboard hints */}
				<div className="void-text-xs void-text-void-fg-3 void-pt-1 void-border-t void-border-void-border-2">
					<span className="void-opacity-70">
						按 <kbd className="void-px-1 void-py-0.5 void-bg-void-bg-3 void-rounded void-text-[10px]">Tab</kbd> 接受建议，
						<kbd className="void-px-1 void-py-0.5 void-bg-void-bg-3 void-rounded void-text-[10px]">Esc</kbd> 跳过
					</span>
				</div>
			</div>
		</LearningCard>
	);
};

/**
 * Compact version for minimal display
 */
export const FlowStatusCardCompact: React.FC<{
	session: FlowSession;
	onFocus?: () => void;
}> = ({ session, onFocus }) => {
	const currentPoint = session.points[session.currentPointIndex];

	if (!currentPoint) {
		return null;
	}

	return (
		<div
			onClick={onFocus}
			className="void-flex void-items-center void-gap-2 void-px-2 void-py-1.5 void-bg-teal-500/10 void-border void-border-teal-500/30 void-rounded void-cursor-pointer hover:void-bg-teal-500/20 void-transition-colors"
		>
			<span>🎯</span>
			<span className="void-text-xs void-text-teal-400 void-flex-1 void-truncate">
				心流编码中: {currentPoint.skill}
			</span>
			<span className="void-text-xs void-text-void-fg-3">
				{session.currentPointIndex + 1}/{session.points.length}
			</span>
		</div>
	);
};
