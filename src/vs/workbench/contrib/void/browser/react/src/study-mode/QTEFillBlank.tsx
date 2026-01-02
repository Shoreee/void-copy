/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LearningCard } from './LearningCard.js';
import type { QTEContent } from '../../../../common/studyModeParser.js';

/**
 * QTE FillBlank Component (Level 3)
 * Fill-in-the-blank style for deep understanding
 * Shows code context with a blank to fill in
 */

export interface QTEFillBlankProps {
	content: QTEContent;
	className?: string;
	onSelect?: (answer: string, meta?: { wasTimeout?: boolean }) => void;
	disabled?: boolean;
}

export const QTEFillBlank: React.FC<QTEFillBlankProps> = ({
	content,
	className = '',
	onSelect,
	disabled = false,
}) => {
	const timeLimit = content.timeout ?? 30;
	const defaultAnswer = content.defaultOption || content.answer || '';

	const [inputValue, setInputValue] = useState('');
	const [timeRemaining, setTimeRemaining] = useState<number>(timeLimit);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [progressPercent, setProgressPercent] = useState(100);
	const startTimeRef = useRef<number>(Date.now());
	const animationFrameRef = useRef<number | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleSubmit = useCallback((wasTimeout: boolean = false) => {
		if (isSubmitted || disabled) return;
		const answer = inputValue.trim() || defaultAnswer;
		setIsSubmitted(true);
		onSelect?.(answer, { wasTimeout });
	}, [isSubmitted, disabled, inputValue, defaultAnswer, onSelect]);

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
				handleSubmit(true);  // Timeout - use default answer
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
	}, [isSubmitted, disabled, timeLimit, handleSubmit]);

	// Auto-focus input
	useEffect(() => {
		if (!isSubmitted && !disabled && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isSubmitted, disabled]);

	const difficultyConfig = {
		easy: { color: '#10B981', label: '简单' },
		medium: { color: '#F59E0B', label: '中等' },
		hard: { color: '#EF4444', label: '困难' },
	};

	const difficulty = difficultyConfig[content.difficulty];

	// Render code context with blank highlighted
	const renderContext = () => {
		if (!content.context) return null;

		// Split by ___ placeholder
		const parts = content.context.split(/___+/);

		return (
			<pre className="p-3 rounded-lg font-mono text-sm bg-void-bg-3 border border-void-border-2 overflow-x-auto whitespace-pre-wrap">
				{parts.map((part, index) => (
					<React.Fragment key={index}>
						<span className="text-void-fg-2">{part}</span>
						{index < parts.length - 1 && (
							<span className={`
								inline-block min-w-[80px] px-2 py-0.5 mx-1
								rounded border-2 border-dashed
								${isSubmitted
									? 'border-green-500 bg-green-500/10 text-green-400'
									: 'border-teal-500 bg-teal-500/10 text-teal-400 animate-pulse'
								}
							`}>
								{isSubmitted ? (inputValue || defaultAnswer) : (inputValue || '???')}
							</span>
						)}
					</React.Fragment>
				))}
			</pre>
		);
	};

	// Button gradient for countdown visualization
	const getButtonGradient = () => {
		if (isSubmitted) return '#374151';
		const activeColor = inputValue ? '#14B8A6' : '#6B7280';
		const grayColor = '#374151';
		return `linear-gradient(to right, ${activeColor} ${progressPercent}%, ${grayColor} ${progressPercent}%)`;
	};

	return (
		<LearningCard
			icon="✏️"
			title="填空题"
			borderColor="#EF4444"  // Red for hard challenge
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
						<span className={`
							text-sm font-mono font-bold
							${timeRemaining <= 5 ? 'text-red-500 animate-pulse' : 'text-teal-500'}
						`}>
							{timeRemaining}s
						</span>
					)}
				</div>

				{/* Question */}
				<div className="text-void-fg-1 font-medium">
					{content.question}
				</div>

				{/* Code context with blank */}
				{content.context && renderContext()}

				{/* Input field */}
				{!isSubmitted && (
					<div className="flex gap-2">
						<input
							ref={inputRef}
							type="text"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSubmit(false);
								}
							}}
							placeholder="输入你的答案..."
							disabled={disabled || isSubmitted}
							className="
								flex-1 px-3 py-2 rounded-lg
								bg-void-bg-2 border border-void-border-2
								text-void-fg-1 placeholder-void-fg-3
								focus:outline-none focus:border-teal-500
								font-mono
							"
						/>
					</div>
				)}

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
						onClick={() => handleSubmit(false)}
						disabled={disabled}
						className={`
							w-full py-2.5 rounded-lg font-medium text-sm
							text-white cursor-pointer hover:opacity-90
							transition-opacity
						`}
						style={{
							background: getButtonGradient(),
						}}
					>
						提交答案
					</button>
				)}

				{/* Submitted state */}
				{isSubmitted && (
					<div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
						<span className="text-sm">✅</span>
						<span className="text-sm text-green-500">
							已提交: <code className="bg-void-bg-3 px-1 rounded">{inputValue || defaultAnswer}</code>
						</span>
					</div>
				)}
			</div>
		</LearningCard>
	);
};

