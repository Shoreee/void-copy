/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { QTEOption, QTEType, QTEDifficulty } from '../../../../common/studyModeParser.js';

/**
 * QTE Widget for Editor ViewZone
 * This component is designed to be mounted inside a Monaco editor ViewZone
 */

export interface QTEWidgetProps {
	/** QTE ID */
	qteId: string;
	/** QTE type */
	type: QTEType;
	/** Difficulty level */
	difficulty: QTEDifficulty;
	/** Question text */
	question: string;
	/** Available options */
	options?: QTEOption[];
	/** Optional hint */
	hint?: string;
	/** Time limit in seconds */
	timeLimit?: number;
	/** Default option ID */
	defaultOption?: string;
	/** Callback when option is selected */
	onSelect: (optionId: string) => void;
	/** Callback when dismissed */
	onDismiss?: () => void;
	/** Callback when height changes (for ViewZone resize) */
	onHeightChange?: (height: number) => void;
}

const difficultyColors = {
	easy: { bg: '#10B98120', text: '#10B981', label: '简单' },
	medium: { bg: '#F59E0B20', text: '#F59E0B', label: '中等' },
	hard: { bg: '#EF444420', text: '#EF4444', label: '困难' },
};

export const QTEWidget: React.FC<QTEWidgetProps> = ({
	qteId,
	type,
	difficulty,
	question,
	options = [],
	hint,
	timeLimit = 10,
	defaultOption,
	onSelect,
	onDismiss,
	onHeightChange,
}) => {
	const finalDefaultOption = defaultOption || (options.length > 0 ? options[0].id : null);
	const [selectedOption, setSelectedOption] = useState<string | null>(finalDefaultOption);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [timeRemaining, setTimeRemaining] = useState<number>(timeLimit);
	const [progressPercent, setProgressPercent] = useState(100);
	const [fillBlankValue, setFillBlankValue] = useState('');
	const containerRef = useRef<HTMLDivElement>(null);
	const startTimeRef = useRef<number>(Date.now());
	const animationFrameRef = useRef<number | null>(null);

	// Report height changes
	useEffect(() => {
		if (containerRef.current && onHeightChange) {
			const height = containerRef.current.offsetHeight;
			onHeightChange(height);
		}
	});

	const handleSubmit = useCallback((optionId: string) => {
		if (isSubmitted) return;
		setIsSubmitted(true);
		onSelect(optionId);
	}, [isSubmitted, onSelect]);

	// Countdown timer with smooth animation
	useEffect(() => {
		if (isSubmitted) return;

		const updateTimer = () => {
			const elapsed = (Date.now() - startTimeRef.current) / 1000;
			const remaining = Math.max(0, timeLimit - elapsed);
			const percent = (remaining / timeLimit) * 100;

			setTimeRemaining(Math.ceil(remaining));
			setProgressPercent(percent);

			if (remaining <= 0) {
				// Time's up - submit with current selection (or default)
				const finalOption = type === 'fillblank' ? fillBlankValue : (selectedOption || finalDefaultOption);
				if (finalOption) {
					handleSubmit(finalOption);
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
	}, [isSubmitted, timeLimit, type, fillBlankValue, selectedOption, finalDefaultOption, handleSubmit]);

	const handleOptionSelect = useCallback((optionId: string) => {
		if (isSubmitted) return;
		setSelectedOption(optionId);
	}, [isSubmitted]);

	const handleConfirm = useCallback(() => {
		if (isSubmitted) return;

		const answer = type === 'fillblank' ? fillBlankValue : selectedOption;
		if (!answer) return;

		handleSubmit(answer);
	}, [isSubmitted, type, fillBlankValue, selectedOption, handleSubmit]);

	const handleDismiss = useCallback(() => {
		onDismiss?.();
	}, [onDismiss]);

	const difficultyStyle = difficultyColors[difficulty];

	// Button gradient for countdown visualization
	const getButtonGradient = () => {
		if (isSubmitted) return 'var(--vscode-button-secondaryBackground)';
		const activeColor = (type === 'fillblank' ? fillBlankValue : selectedOption) ? '#14B8A6' : '#6B7280';
		const grayColor = '#374151';
		return `linear-gradient(to right, ${activeColor} ${progressPercent}%, ${grayColor} ${progressPercent}%)`;
	};

	return (
		<div
			ref={containerRef}
			className="qte-widget"
			style={{
				fontFamily: 'var(--vscode-font-family)',
				fontSize: '13px',
				padding: '16px',
				backgroundColor: 'var(--vscode-editor-background)',
				borderLeft: '3px solid #2DD4BF',
				borderRadius: '0 8px 8px 0',
				boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
			}}
		>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<span style={{ fontSize: '18px' }}>🎯</span>
					<span style={{ fontWeight: 600, color: 'var(--vscode-foreground)' }}>决策点</span>
					<span
						style={{
							padding: '2px 8px',
							borderRadius: '4px',
							fontSize: '11px',
							fontWeight: 500,
							backgroundColor: difficultyStyle.bg,
							color: difficultyStyle.text,
						}}
					>
						{difficultyStyle.label}
					</span>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{/* Timer */}
					{!isSubmitted && (
						<span
							style={{
								fontSize: '14px',
								fontWeight: 700,
								fontFamily: 'monospace',
								color: timeRemaining <= 3 ? '#EF4444' : '#2DD4BF',
								animation: timeRemaining <= 3 ? 'pulse 1s infinite' : 'none',
							}}
						>
							{timeRemaining}s
						</span>
					)}

					{/* Close button */}
					{onDismiss && (
						<button
							onClick={handleDismiss}
							style={{
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								color: 'var(--vscode-descriptionForeground)',
								fontSize: '16px',
								padding: '4px',
							}}
						>
							×
						</button>
					)}
				</div>
			</div>

			{/* Question */}
			<div style={{ marginBottom: '16px', color: 'var(--vscode-foreground)', fontWeight: 500 }}>
				{question}
			</div>

			{/* Options based on type */}
			{type === 'choice' && (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
					{options.map((option) => {
						const isSelected = selectedOption === option.id;
						return (
							<button
								key={option.id}
								onClick={() => handleOptionSelect(option.id)}
								disabled={isSubmitted}
								style={{
									display: 'flex',
									alignItems: 'flex-start',
									gap: '8px',
									padding: '12px',
									border: `2px solid ${isSelected ? '#2DD4BF' : 'var(--vscode-input-border)'}`,
									borderRadius: '6px',
									backgroundColor: isSelected ? '#2DD4BF10' : 'var(--vscode-input-background)',
									cursor: isSubmitted ? 'not-allowed' : 'pointer',
									opacity: isSubmitted ? 0.7 : 1,
									textAlign: 'left',
									transition: 'all 0.15s ease',
								}}
							>
								<span
									style={{
										width: '24px',
										height: '24px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: '50%',
										backgroundColor: isSelected ? '#2DD4BF' : 'var(--vscode-badge-background)',
										color: isSelected ? 'white' : 'var(--vscode-badge-foreground)',
										fontSize: '12px',
										fontWeight: 600,
										flexShrink: 0,
									}}
								>
									{option.id.toUpperCase()}
								</span>
								<span style={{ color: 'var(--vscode-foreground)', fontSize: '13px', flex: 1 }}>
									{option.text}
								</span>
							</button>
						);
					})}
				</div>
			)}

			{type === 'fillblank' && (
				<input
					type="text"
					value={fillBlankValue}
					onChange={(e) => setFillBlankValue(e.target.value)}
					placeholder="Type your answer..."
					disabled={isSubmitted}
					style={{
						width: '100%',
						padding: '10px 12px',
						border: '1px solid var(--vscode-input-border)',
						borderRadius: '6px',
						backgroundColor: 'var(--vscode-input-background)',
						color: 'var(--vscode-input-foreground)',
						fontSize: '13px',
						outline: 'none',
					}}
					onFocus={(e) => {
						e.target.style.borderColor = '#2DD4BF';
					}}
					onBlur={(e) => {
						e.target.style.borderColor = 'var(--vscode-input-border)';
					}}
				/>
			)}

			{/* Hint */}
			{hint && !isSubmitted && (
				<div
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: '8px',
						marginTop: '12px',
						padding: '10px 12px',
						backgroundColor: 'var(--vscode-textBlockQuote-background)',
						borderRadius: '6px',
					}}
				>
					<span>💡</span>
					<span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
						{hint}
					</span>
				</div>
			)}

			{/* Submit button with countdown gradient */}
			{!isSubmitted && (
				<button
					onClick={handleConfirm}
					disabled={type === 'fillblank' ? !fillBlankValue : !selectedOption}
					style={{
						width: '100%',
						marginTop: '16px',
						padding: '12px 16px',
						border: 'none',
						borderRadius: '6px',
						background: getButtonGradient(),
						color: 'white',
						fontSize: '13px',
						fontWeight: 500,
						cursor: (type === 'fillblank' ? fillBlankValue : selectedOption) ? 'pointer' : 'not-allowed',
						transition: 'opacity 0.15s ease',
						position: 'relative',
						overflow: 'hidden',
					}}
				>
					确认选择 {selectedOption ? `(${selectedOption.toUpperCase()})` : ''}
				</button>
			)}

			{/* Submitted state */}
			{isSubmitted && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						marginTop: '12px',
						padding: '10px 12px',
						backgroundColor: '#10B98120',
						borderRadius: '6px',
					}}
				>
					<span>✅</span>
					<span style={{ fontSize: '13px', color: '#10B981' }}>
						已选择: 选项 {selectedOption?.toUpperCase()}
					</span>
				</div>
			)}
		</div>
	);
};

/**
 * Mount function for ViewZone integration
 * Used by studyQTEService to mount QTEWidget in editor
 */
export interface QTEWidgetMountOptions extends Omit<QTEWidgetProps, 'qteId'> {
	qteId: string;
}

export type QTEWidgetMountFn = (
	container: HTMLElement,
	options: QTEWidgetMountOptions
) => { dispose: () => void };


