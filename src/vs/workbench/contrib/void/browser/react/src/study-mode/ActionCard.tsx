/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { LearningCard } from './LearningCard.js';
import type { ActionContent } from '../../../../common/studyModeParser.js';

/**
 * Action Card Component
 * Displays code actions with status and sync functionality
 */

export interface ActionCardProps {
	content: ActionContent;
	className?: string;
	onSyncToEditor?: (file: string) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
	content,
	className = '',
	onSyncToEditor,
}) => {
	const statusConfig = {
		pending: {
			icon: '⏳',
			color: '#F59E0B',  // Yellow
			label: 'Pending',
		},
		streaming: {
			icon: '⚡',
			color: '#3B82F6',  // Blue
			label: 'Writing...',
		},
		complete: {
			icon: '✅',
			color: '#10B981',  // Green
			label: 'Complete',
		},
	};

	const status = statusConfig[content.status];

	const handleSync = () => {
		if (content.file && onSyncToEditor) {
			onSyncToEditor(content.file);
		}
	};

	return (
		<LearningCard
			icon={status.icon}
			title={content.title}
			borderColor={status.color}
			className={className}
		>
			<div className="space-y-2">
				{/* Status indicator */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{content.status === 'streaming' && (
							<span className="inline-flex gap-1">
								<span className="void-w-1.5 void-h-1.5 void-bg-blue-500 void-rounded-full void-animate-pulse" />
								<span className="void-w-1.5 void-h-1.5 void-bg-blue-500 void-rounded-full void-animate-pulse" style={{ animationDelay: '150ms' }} />
								<span className="void-w-1.5 void-h-1.5 void-bg-blue-500 void-rounded-full void-animate-pulse" style={{ animationDelay: '300ms' }} />
							</span>
						)}
						<span className="text-xs text-void-fg-3">{status.label}</span>
					</div>

					{/* Sync button */}
					{content.file && content.status !== 'pending' && (
						<button
							onClick={handleSync}
							className="
								px-2 py-1
								text-xs
								bg-void-bg-2 hover:bg-void-bg-3
								border border-void-border-2
								rounded
								text-void-fg-2 hover:text-void-fg-1
								transition-colors
							"
						>
							🔗 Sync
						</button>
					)}
				</div>

				{/* Target file */}
				{content.file && (
					<div className="flex items-center gap-2 text-xs text-void-fg-3">
						<span>📁</span>
						<code className="bg-void-bg-2 px-1.5 py-0.5 rounded font-mono">
							{content.file}
						</code>
					</div>
				)}

				{/* Content description */}
				{content.content && (
					<div className="text-sm text-void-fg-2 mt-2">
						{content.content}
					</div>
				)}
			</div>
		</LearningCard>
	);
};


