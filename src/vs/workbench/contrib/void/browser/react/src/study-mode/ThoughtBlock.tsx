/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { LearningCard } from './LearningCard.js';
import type { ThoughtContent } from '../../../../common/studyModeParser.js';

/**
 * Thought Block Component
 * Displays AI's thinking process with a distinctive style
 */

export interface ThoughtBlockProps {
	content: ThoughtContent;
	className?: string;
}

export const ThoughtBlock: React.FC<ThoughtBlockProps> = ({
	content,
	className = '',
}) => {
	const isThinking = content.status === 'thinking';

	return (
		<LearningCard
			icon={isThinking ? '🤔' : '💭'}
			title={isThinking ? 'Thinking...' : 'Analysis'}
			borderColor="#6B7280"  // Gray for thought blocks
			collapsible={!isThinking}
			defaultCollapsed={false}
			className={className}
		>
			<div className="text-sm text-void-fg-2">
				{isThinking ? (
					<div className="flex items-center gap-2">
						<span className="animate-pulse">{content.content}</span>
						<span className="inline-flex gap-1">
							<span className="w-1.5 h-1.5 bg-void-fg-3 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
							<span className="w-1.5 h-1.5 bg-void-fg-3 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
							<span className="w-1.5 h-1.5 bg-void-fg-3 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
						</span>
					</div>
				) : (
					<p className="whitespace-pre-wrap">{content.content}</p>
				)}
			</div>
		</LearningCard>
	);
};

/**
 * Simple Thought Block for streaming "Thinking..." status
 */
export const ThinkingIndicator: React.FC<{ message?: string }> = ({
	message = 'Analyzing...'
}) => {
	return (
		<ThoughtBlock
			content={{
				content: message,
				status: 'thinking'
			}}
		/>
	);
};


