/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LearningCard } from './LearningCard.js';
import type { QTEContent } from '../../../../common/studyModeParser.js';

/**
 * QTE Prediction Component (Level 1)
 * Ghost Text style - simple confirmation to maintain attention
 * Shows a code preview with a simple confirm action
 */

export interface QTEPredictionProps {
	content: QTEContent;
	className?: string;
	onSelect?: (optionId: string, meta?: { wasTimeout?: boolean }) => void;
	disabled?: boolean;
}

export const QTEPrediction: React.FC<QTEPredictionProps> = ({
	content,
	className = '',
	onSelect,
	disabled = false,
}) => {
	const timeLimit = content.timeout ?? 5;
	const [timeRemaining, setTimeRemaining] = useState<number>(timeLimit);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [progressPercent, setProgressPercent] = useState(100);
	const startTimeRef = useRef<number>(Date.now());
	const animationFrameRef = useRef<number | null>(null);

	const handleSubmit = useCallback((wasTimeout: boolean = false) => {
		if (isSubmitted || disabled) return;
		setIsSubmitted(true);
		onSelect?.('confirm', { wasTimeout });
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
				handleSubmit(true);  // Timeout - auto confirm
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

	// Handle keyboard shortcut (Tab or Enter to confirm)
	useEffect(() => {
		if (isSubmitted || disabled) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Tab' || e.key === 'Enter') {
				e.preventDefault();
				handleSubmit(false);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isSubmitted, disabled, handleSubmit]);

	// Button gradient for countdown visualization
	const getButtonGradient = () => {
		if (isSubmitted) return '#374151';
		const activeColor = '#14B8A6';
		const grayColor = '#374151';
		return `linear-gradient(to right, ${activeColor} ${progressPercent}%, ${grayColor} ${progressPercent}%)`;
	};

	return (
		<LearningCard
			icon="⚡"
			title="继续确认"
			borderColor="#10B981"  // Green for prediction
			className={className}
		>
			<div className="space-y-3">
				{/* Question/Description */}
				<div className="text-void-fg-1 text-sm">
					{content.question}
				</div>

				{/* Code Preview - Ghost Text Style */}
				{content.preview && (
					<div className="relative">
						<pre className={`
							p-3 rounded-lg font-mono text-sm
							bg-void-bg-3 border border-void-border-2
							${isSubmitted ? 'text-void-fg-1' : 'text-void-fg-3'}
							overflow-x-auto
							transition-colors duration-300
						`}>
							{content.preview}
						</pre>
						{!isSubmitted && (
							<div className="absolute top-2 right-2">
								<span className={`
									px-2 py-0.5 rounded text-xs font-mono
									${timeRemaining <= 2 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-teal-500/20 text-teal-400'}
								`}>
									{timeRemaining}s
								</span>
							</div>
						)}
					</div>
				)}

				{/* Action hint */}
				{!isSubmitted && (
					<div className="flex items-center justify-between">
						<span className="text-xs text-void-fg-3">
							{content.action || '按 Tab 或 Enter 确认继续'}
						</span>
					</div>
				)}

				{/* Confirm button with countdown visualization */}
				{!isSubmitted && (
					<button
						onClick={() => handleSubmit(false)}
						disabled={disabled}
						className={`
							w-full py-2 rounded-lg font-medium text-sm
							text-white cursor-pointer hover:opacity-90
							transition-opacity
						`}
						style={{
							background: getButtonGradient(),
						}}
					>
						✓ 确认继续
					</button>
				)}

				{/* Submitted state */}
				{isSubmitted && (
					<div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
						<span className="text-sm">✅</span>
						<span className="text-sm text-green-500">
							已确认，继续学习...
						</span>
					</div>
				)}
			</div>
		</LearningCard>
	);
};

