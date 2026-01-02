/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import type { CurriculumStep, BackgroundTaskType } from '../../../../common/studyModeParser.js';
import { CurriculumProgress } from './CurriculumCard.js';

/**
 * Mission Radar Component
 * Top-of-sidebar sticky progress indicator with expandable Mermaid graph
 * Supports background task status display with amber color
 */

// Background task status text mapping
const BackgroundTaskStatusText: Record<BackgroundTaskType, string> = {
	fix: '🔧 后台修复中...',
	dev: '🛠️ 后台开发中...',
	refactor: '♻️ 后台重构中...',
	test: '🧪 后台测试中...',
	install: '📦 后台安装中...',
};

export interface BackgroundTaskState {
	type: BackgroundTaskType;
	status: 'pending' | 'running' | 'complete' | 'failed';
	description?: string;
}

export interface MissionRadarProps {
	/** Current step in the curriculum */
	currentStep: number;
	/** Total number of steps */
	totalSteps: number;
	/** Name of current step */
	stepName: string;
	/** Curriculum steps for progress dots */
	steps?: CurriculumStep[];
	/** Optional Mermaid graph content */
	mermaidGraph?: string;
	/** Background task state (if a task is running) */
	backgroundTask?: BackgroundTaskState | null;
	/** Additional CSS classes */
	className?: string;
}

export const MissionRadar: React.FC<MissionRadarProps> = ({
	currentStep,
	totalSteps,
	stepName,
	steps,
	mermaidGraph,
	backgroundTask,
	className = '',
}) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const [showComplete, setShowComplete] = useState(false);

	// Calculate progress from steps array if available (for consistency with dots)
	// Otherwise fall back to currentStep/totalSteps props
	const calculatedProgress = React.useMemo(() => {
		if (steps && steps.length > 0) {
			const completedCount = steps.filter(s => s.status === 'complete').length;
			const currentIdx = steps.findIndex(s => s.status === 'current');
			// Progress includes completed steps + partial progress on current step
			// If current step exists, add 0.5 to show partial progress
			const effectiveProgress = completedCount + (currentIdx >= 0 ? 0.5 : 0);
			const percent = (effectiveProgress / steps.length) * 100;

			return {
				completed: completedCount,
				total: steps.length,
				percent,
			};
		}
		return {
			completed: currentStep,
			total: totalSteps,
			percent: totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0,
		};
	}, [steps, currentStep, totalSteps]);

	const progressPercent = calculatedProgress.percent;

	// Determine if we're in background task mode
	const isBackgroundTaskMode = backgroundTask && (backgroundTask.status === 'pending' || backgroundTask.status === 'running');
	const isTaskComplete = backgroundTask?.status === 'complete';

	// Show completion state briefly then fade
	useEffect(() => {
		if (isTaskComplete) {
			setShowComplete(true);
			const timer = setTimeout(() => setShowComplete(false), 2000);
			return () => clearTimeout(timer);
		}
	}, [isTaskComplete]);

	// Determine colors and text based on state
	const getProgressBarColor = () => {
		if (showComplete) return '#10B981'; // green-500
		if (isBackgroundTaskMode) return '#F59E0B'; // amber-500
		return '#14B8A6'; // teal-500
	};

	const getStatusTextColor = () => {
		if (showComplete) return '#10B981'; // green-500
		if (isBackgroundTaskMode) return '#F59E0B'; // amber-500
		return '#14B8A6'; // teal-500
	};

	const getDisplayText = () => {
		if (showComplete) return '✅ 任务完成';
		if (isBackgroundTaskMode && backgroundTask) {
			return BackgroundTaskStatusText[backgroundTask.type] || '⏳ 后台处理中...';
		}
		return stepName;
	};

	return (
		<div
			className={`
				flex-shrink-0
				bg-void-bg-2
				border-b border-void-border-2
				${className}
			`}
		>
			{/* Collapsed view - Always visible */}
			<div className="flex items-center gap-3 px-3 py-2">
				{/* Progress indicator */}
				<div className="flex items-center gap-2 flex-1 min-w-0">
					{/* Progress bar */}
					<div className="w-16 h-1.5 bg-void-bg-3 rounded-full overflow-hidden flex-shrink-0">
						<div
							className="h-full transition-all duration-300"
							style={{
								width: `${Math.max(progressPercent, 0)}%`,
								minWidth: progressPercent > 0 ? '2px' : '0px',  // Ensure visibility when > 0
								backgroundColor: getProgressBarColor(),
							}}
						/>
					</div>

					{/* Step info */}
					<span className="text-xs text-void-fg-2 truncate">
						<span
							className="font-medium"
							style={{ color: getStatusTextColor() }}
						>
							{calculatedProgress.completed}/{calculatedProgress.total}
						</span>
						{' '}
						{getDisplayText()}
					</span>
				</div>

				{/* Curriculum dots (if steps provided) */}
				{steps && steps.length > 0 && (
					<div className="hidden sm:flex gap-0.5">
						{steps.slice(0, 8).map((step, index) => {
							let dotColor = '#374151'; // default: void-bg-3
							if (step.status === 'complete') dotColor = '#10B981'; // green-500
							else if (step.status === 'current') dotColor = '#14B8A6'; // teal-500
							else if (step.status === 'skipped') dotColor = '#EF4444'; // red-500

							return (
								<div
									key={step.id}
									className={`
										w-1.5 h-1.5 rounded-full
										${step.status === 'current' ? 'animate-pulse' : ''}
									`}
									style={{ backgroundColor: dotColor }}
									title={step.title}
								/>
							);
						})}
						{steps.length > 8 && (
							<span className="text-xs text-void-fg-3 ml-1">+{steps.length - 8}</span>
						)}
					</div>
				)}

				{/* Expand button */}
				{mermaidGraph && (
					<button
						onClick={() => setIsExpanded(!isExpanded)}
						className={`
							p-1 rounded
							text-void-fg-3 hover:text-void-fg-1
							hover:bg-void-bg-3
							transition-colors
						`}
						title={isExpanded ? 'Collapse learning path' : 'Expand learning path'}
					>
						<svg
							className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
				)}
			</div>

			{/* Expanded view - Mermaid graph */}
			{isExpanded && mermaidGraph && (
				<div className="border-t border-void-border-2">
					<div className="p-3">
						{/* Mermaid diagram placeholder */}
						<div className="bg-void-bg-1 rounded-lg p-4 overflow-auto max-h-64">
							<MermaidRenderer content={mermaidGraph} />
						</div>

						{/* Legend */}
						<div className="flex items-center gap-4 mt-3 text-xs text-void-fg-3">
							<div className="flex items-center gap-1">
								<div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }} />
								<span>Complete</span>
							</div>
							<div className="flex items-center gap-1">
								<div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#14B8A6' }} />
								<span>Current</span>
							</div>
							<div className="flex items-center gap-1">
								<div className="w-2 h-2 rounded-full bg-void-bg-3" />
								<span>Pending</span>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

/**
 * Simple Mermaid Renderer
 * Note: For production, integrate mermaid.js library
 */
const MermaidRenderer: React.FC<{ content: string }> = ({ content }) => {
	// For now, just display as formatted text
	// TODO: Integrate mermaid.js for actual rendering

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 text-xs text-void-fg-3">
				<span>📊</span>
				<span>Learning Path Diagram</span>
			</div>
			<pre className="text-xs font-mono text-void-fg-2 whitespace-pre-wrap">
				{content}
			</pre>
			<div className="text-xs text-void-fg-3 italic">
				(Mermaid rendering will be enabled in future update)
			</div>
		</div>
	);
};

/**
 * Compact version for minimal space usage
 */
export const MissionRadarCompact: React.FC<{
	currentStep: number;
	totalSteps: number;
	stepName: string;
}> = ({ currentStep, totalSteps, stepName }) => {
	const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

	return (
		<div className="flex items-center gap-2 px-2 py-1 bg-void-bg-2 rounded">
			<div className="w-12 h-1 bg-void-bg-3 rounded-full overflow-hidden">
				<div
					className="h-full"
					style={{
						width: `${progressPercent}%`,
						backgroundColor: '#14B8A6' // teal-500
					}}
				/>
			</div>
			<span className="text-xs text-void-fg-3">
				{currentStep}/{totalSteps}
			</span>
		</div>
	);
};

