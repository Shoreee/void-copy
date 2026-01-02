/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

/**
 * Base Learning Card component
 * All study mode cards inherit from this base component
 */

export interface LearningCardProps {
	/** Card title */
	title?: string;
	/** Left border color */
	borderColor?: string;
	/** Icon component or emoji */
	icon?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether the card is collapsible */
	collapsible?: boolean;
	/** Whether the card is initially collapsed */
	defaultCollapsed?: boolean;
	/** Card content */
	children: React.ReactNode;
}

export const LearningCard: React.FC<LearningCardProps> = ({
	title,
	borderColor = '#2DD4BF',  // Default teal color for study mode
	icon,
	className = '',
	collapsible = false,
	defaultCollapsed = false,
	children,
}) => {
	const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

	return (
		<div
			className={`
				relative
				bg-void-bg-1
				rounded-lg
				border border-void-border-2
				overflow-hidden
				mb-3
				${className}
			`}
			style={{
				borderLeftWidth: '3px',
				borderLeftColor: borderColor,
			}}
		>
			{/* Header */}
			{(title || icon) && (
				<div
					className={`
						flex items-center gap-2 px-3 py-2
						border-b border-void-border-2
						${collapsible ? 'cursor-pointer hover:bg-void-bg-2' : ''}
					`}
					onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
				>
					{icon && (
						<span className="text-sm flex-shrink-0">{icon}</span>
					)}
					{title && (
						<span className="text-sm font-medium text-void-fg-1 flex-1">
							{title}
						</span>
					)}
					{collapsible && (
						<span className={`text-void-fg-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
							▶
						</span>
					)}
				</div>
			)}

			{/* Content */}
			{(!collapsible || !isCollapsed) && (
				<div className="px-3 py-2">
					{children}
				</div>
			)}
		</div>
	);
};


