/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { LearningCard } from './LearningCard.js';
import type { CurriculumContent, CurriculumStep, CurriculumStepStatus } from '../../../../common/studyModeParser.js';

/**
 * Curriculum Card Component
 * Displays learning progress as a timeline
 */

export interface CurriculumCardProps {
	content: CurriculumContent;
	className?: string;
	onStepClick?: (stepId: string) => void;
}

const StepStatusConfig: Record<CurriculumStepStatus, {
	icon: string;
	color: string;
	bgColor: string;
	lineColor: string;
}> = {
	complete: {
		icon: '✓',
		color: '#10B981',
		bgColor: '#10B98120',
		lineColor: '#10B981',
	},
	current: {
		icon: '●',
		color: '#2DD4BF',
		bgColor: '#2DD4BF20',
		lineColor: '#2DD4BF',
	},
	pending: {
		icon: '○',
		color: '#6B7280',
		bgColor: '#6B728020',
		lineColor: '#374151',
	},
	skipped: {
		icon: '—',
		color: '#EF4444',
		bgColor: '#EF444420',
		lineColor: '#374151',
	},
};

const CurriculumStepItem: React.FC<{
	step: CurriculumStep;
	isLast: boolean;
	onClick?: () => void;
}> = ({ step, isLast, onClick }) => {
	// Use pending as fallback for invalid/undefined status
	const config = StepStatusConfig[step.status] || StepStatusConfig.pending;

	return (
		<div className="flex items-start">
			{/* Timeline indicator */}
			<div className="flex flex-col items-center mr-3">
				<div
					className={`
						w-6 h-6 rounded-full flex items-center justify-center
						text-xs font-bold
						${step.status === 'current' ? 'ring-2 ring-teal-500/50 animate-pulse' : ''}
					`}
					style={{
						backgroundColor: config.bgColor,
						color: config.color,
					}}
				>
					{config.icon}
				</div>
				{!isLast && (
					<div
						className="w-0.5 h-8 mt-1"
						style={{ backgroundColor: config.lineColor }}
					/>
				)}
			</div>

			{/* Step content */}
			<div
				className={`
					flex-1 pb-4
					${onClick ? 'cursor-pointer hover:opacity-80' : ''}
				`}
				onClick={onClick}
			>
				<div className={`
					text-sm
					${step.status === 'current' ? 'text-void-fg-1 font-medium' : 'text-void-fg-2'}
				`}>
					{step.title}
				</div>
				{step.status === 'current' && (
					<div className="void-text-xs void-text-teal-500 void-mt-0.5">
						Currently learning...
					</div>
				)}
			</div>
		</div>
	);
};

export const CurriculumCard: React.FC<CurriculumCardProps> = ({
	content,
	className = '',
	onStepClick,
}) => {
	// Calculate progress
	const completedSteps = content.steps.filter(s => s.status === 'complete').length;
	const totalSteps = content.steps.length;
	const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

	return (
		<LearningCard
			icon="📚"
			title="Learning Path"
			borderColor="#2DD4BF"
			collapsible={true}
			defaultCollapsed={false}
			className={className}
		>
			<div className="space-y-3">
				{/* Progress summary */}
				<div className="flex items-center gap-3">
					<div className="flex-1 h-2 bg-void-bg-3 rounded-full overflow-hidden">
						<div
							className="void-h-full void-bg-teal-500 void-transition-all void-duration-500"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					<span className="text-xs text-void-fg-3 whitespace-nowrap">
						{completedSteps}/{totalSteps} complete
					</span>
				</div>

				{/* Steps timeline */}
				<div className="mt-4">
					{content.steps.map((step, index) => (
						<CurriculumStepItem
							key={step.id}
							step={step}
							isLast={index === content.steps.length - 1}
							onClick={onStepClick ? () => onStepClick(step.id) : undefined}
						/>
					))}
				</div>
			</div>
		</LearningCard>
	);
};

/**
 * Compact curriculum display for MissionRadar
 */
export const CurriculumProgress: React.FC<{
	steps: CurriculumStep[];
	className?: string;
}> = ({ steps, className = '' }) => {
	const currentStep = steps.find(s => s.status === 'current');
	const currentIndex = currentStep ? steps.indexOf(currentStep) + 1 : 0;
	const totalSteps = steps.length;

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{/* Progress dots */}
			<div className="flex gap-1">
				{steps.map((step, index) => {
					// Use pending as fallback for invalid/undefined status
					const config = StepStatusConfig[step.status] || StepStatusConfig.pending;
					return (
						<div
							key={step.id}
							className={`
								w-2 h-2 rounded-full
								${step.status === 'current' ? 'animate-pulse' : ''}
							`}
							style={{ backgroundColor: config.color }}
							title={step.title}
						/>
					);
				})}
			</div>

			{/* Current step label */}
			{currentStep && (
				<span className="text-xs text-void-fg-2">
					Step {currentIndex}/{totalSteps}: {currentStep.title}
				</span>
			)}
		</div>
	);
};


