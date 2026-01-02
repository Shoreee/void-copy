/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LearningCard } from './LearningCard.js';
import type { QTEContent } from '../../../../common/studyModeParser.js';

/**
 * QTE (Quick Time Event) Card Component
 * Interactive decision point for learning with countdown timer
 */

export interface QTECardProps {
	content: QTEContent;
	className?: string;
	onSelect?: (optionId: string, meta?: { wasTimeout?: boolean }) => void;
	disabled?: boolean;
}

export const QTECard: React.FC<QTECardProps> = ({
	content,
	className = '',
	onSelect,
	disabled = false,
}) => {
	// Use content's timeout or default to 10 seconds
	const timeLimit = content.timeout ?? 10;
	const defaultOption = content.defaultOption || (content.options.length > 0 ? content.options[0].id : null);

	const [selectedOption, setSelectedOption] = useState<string | null>(defaultOption);
	const [timeRemaining, setTimeRemaining] = useState<number>(timeLimit);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const startTimeRef = useRef<number>(Date.now());
	const animationFrameRef = useRef<number | null>(null);

	// Smooth countdown using requestAnimationFrame for button animation
	const [progressPercent, setProgressPercent] = useState(100);

	const handleSubmit = useCallback((optionId: string, wasTimeout: boolean = false) => {
		if (isSubmitted || disabled) return;
		setIsSubmitted(true);
		onSelect?.(optionId, { wasTimeout });
	}, [isSubmitted, disabled, onSelect]);

	// Countdown timer with smooth animation
	useEffect(() => {
		if (isSubmitted || disabled) return;

		const updateTimer = () => {
			const elapsed = (Date.now() - startTimeRef.current) / 1000;
			const remaining = Math.max(0, timeLimit - elapsed);
			const percent = (remaining / timeLimit) * 100;

			setTimeRemaining(Math.ceil(remaining));
			setProgressPercent(percent);

			if (remaining <= 0) {
				// Time's up - submit with current selection (or default)
				const finalOption = selectedOption || defaultOption;
				if (finalOption) {
					// Pass wasTimeout=true if user didn't actively select
					const wasTimeout = selectedOption === null || selectedOption === defaultOption;
					handleSubmit(finalOption, wasTimeout);
				}
			} else {
				animationFrameRef.current = requestAnimationFrame(updateTimer);
			}
		};

		animationFrameRef.current = requestAnimationFrame(updateTimer);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [isSubmitted, disabled, timeLimit, selectedOption, defaultOption, handleSubmit]);

	const difficultyConfig = {
		easy: { color: '#10B981', label: '简单' },
		medium: { color: '#F59E0B', label: '中等' },
		hard: { color: '#EF4444', label: '困难' },
	};

	const difficulty = difficultyConfig[content.difficulty];

	const handleSelect = (optionId: string) => {
		if (disabled || isSubmitted) return;
		setSelectedOption(optionId);
	};

	const handleConfirm = () => {
		if (!selectedOption || isSubmitted) return;
		handleSubmit(selectedOption, false);  // User actively clicked confirm
	};

	const renderChoiceOptions = () => (
		<div className="grid grid-cols-1 gap-2">
			{content.options.map((option) => {
				const isSelected = selectedOption === option.id;

				return (
					<button
						key={option.id}
						onClick={() => handleSelect(option.id)}
						disabled={disabled || isSubmitted}
						className={`
							p-3 text-left rounded-lg border-2 transition-all relative
							${isSelected
								? 'void-border-teal-500 void-bg-teal-500/10'
								: 'border-void-border-2 hover:border-void-border-1'
							}
							${disabled || isSubmitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
						`}
					>
						<div className="flex items-start gap-2">
							<span className={`
								w-6 h-6 flex items-center justify-center rounded-full
								text-xs font-bold flex-shrink-0
								${isSelected
									? 'bg-teal-500 text-white'
									: 'bg-void-bg-3 text-void-fg-2'
								}
							`}>
								{option.id.toUpperCase()}
							</span>
							<span className="text-sm text-void-fg-1 flex-1">{option.text}</span>
						</div>
					</button>
				);
			})}
		</div>
	);

	const renderFillBlankOptions = () => (
		<div className="space-y-2">
			<input
				type="text"
				placeholder="输入你的答案..."
				disabled={disabled || isSubmitted}
				className="
					w-full px-3 py-2 rounded-lg
					bg-void-bg-2 border border-void-border-2
					text-void-fg-1 placeholder-void-fg-3
					focus:outline-none focus:border-teal-500
				"
				onChange={(e) => setSelectedOption(e.target.value)}
			/>
		</div>
	);

	// Determine button color based on time remaining
	const getButtonGradient = () => {
		if (isSubmitted) return 'bg-void-bg-3';

		// Create a gradient effect: teal on left (remaining), gray on right (elapsed)
		const tealColor = selectedOption ? '#14B8A6' : '#6B7280';
		const grayColor = '#374151';

		return `linear-gradient(to right, ${tealColor} ${progressPercent}%, ${grayColor} ${progressPercent}%)`;
	};

	return (
		<LearningCard
			icon="🎯"
			title="决策点"
			borderColor="#2DD4BF"  // Teal
			className={className}
		>
			<div className="space-y-4">
				{/* Header with difficulty and timer */}
				<div className="flex items-center justify-between">
					<span
						className="px-2 py-0.5 rounded text-xs font-medium"
						style={{ backgroundColor: `${difficulty.color}20`, color: difficulty.color }}
					>
						{difficulty.label}
					</span>

					{!isSubmitted && (
						<div className="flex items-center gap-2">
							<span className={`text-sm font-mono font-bold ${timeRemaining <= 3 ? 'text-red-500 animate-pulse' : 'text-teal-500'}`}>
								{timeRemaining}s
							</span>
						</div>
					)}
				</div>

				{/* Question */}
				<div className="text-void-fg-1 font-medium">
					{content.question}
				</div>

				{/* Options based on type */}
				{content.type === 'choice' && renderChoiceOptions()}
				{content.type === 'fillblank' && renderFillBlankOptions()}

				{/* Hint */}
				{content.hint && !isSubmitted && (
					<div className="flex items-start gap-2 p-2 bg-void-bg-2 rounded-lg">
						<span className="text-sm">💡</span>
						<span className="text-xs text-void-fg-3 italic">{content.hint}</span>
					</div>
				)}

				{/* Submit button with countdown visualization */}
				{!isSubmitted && (
					<button
						onClick={handleConfirm}
						disabled={!selectedOption || disabled}
						className={`
							w-full py-2.5 rounded-lg font-medium text-sm transition-colors
							text-white relative overflow-hidden
							${!selectedOption || disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}
						`}
						style={{
							background: getButtonGradient(),
						}}
					>
						<span className="relative z-10">
							确认选择 {selectedOption ? `(${selectedOption.toUpperCase()})` : ''}
						</span>
					</button>
				)}

				{/* Submitted state */}
				{isSubmitted && (
					<div className="void-flex void-items-center void-gap-2 void-p-2 void-bg-green-500/10 void-rounded-lg">
						<span className="void-text-sm">✅</span>
						<span className="void-text-sm void-text-green-500">
							已选择: 选项 {selectedOption?.toUpperCase()}
						</span>
					</div>
				)}
			</div>
		</LearningCard>
	);
};


