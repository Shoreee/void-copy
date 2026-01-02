/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef } from 'react';
import { LearningCard } from './LearningCard.js';
import type { DiagramContent } from '../../../../common/studyModeParser.js';

/**
 * Diagram Card Component
 * Displays visual diagrams (Mermaid, SVG, ASCII)
 */

export interface DiagramCardProps {
	content: DiagramContent;
	className?: string;
	onExpand?: () => void;
}

export const DiagramCard: React.FC<DiagramCardProps> = ({
	content,
	className = '',
	onExpand,
}) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const [renderError, setRenderError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Render Mermaid diagrams
	useEffect(() => {
		if (content.type === 'mermaid' && containerRef.current) {
			// Note: Mermaid rendering will be handled by a separate utility
			// For now, we just display the raw content
			// TODO: Integrate mermaid.js for actual rendering
		}
	}, [content]);

	const handleExpand = () => {
		setIsExpanded(true);
		onExpand?.();
	};

	const handleClose = () => {
		setIsExpanded(false);
	};

	const renderDiagramContent = () => {
		switch (content.type) {
			case 'mermaid':
				return (
					<div
						ref={containerRef}
						className="bg-void-bg-2 rounded p-3 overflow-auto"
					>
						{/* Mermaid diagram will be rendered here */}
						<pre className="text-xs text-void-fg-2 font-mono whitespace-pre-wrap">
							{content.content}
						</pre>
						<div className="mt-2 text-xs text-void-fg-3 italic">
							(Mermaid diagram - click to expand)
						</div>
					</div>
				);

			case 'ascii':
				return (
					<pre className="bg-void-bg-2 rounded p-3 text-xs font-mono text-void-fg-2 overflow-auto whitespace-pre">
						{content.content}
					</pre>
				);

			case 'svg':
				return (
					<div
						className="bg-void-bg-2 rounded p-3 overflow-auto"
						dangerouslySetInnerHTML={{ __html: content.content }}
					/>
				);

			default:
				return (
					<div className="text-void-fg-3 text-sm">
						Unknown diagram type: {content.type}
					</div>
				);
		}
	};

	return (
		<>
			<LearningCard
				icon="📊"
				title={content.caption || 'Diagram'}
				borderColor="#8B5CF6"  // Purple for diagrams
				className={`${className} cursor-pointer`}
			>
				<div onClick={handleExpand}>
					{renderError ? (
						<div className="text-red-500 text-sm">{renderError}</div>
					) : (
						renderDiagramContent()
					)}
				</div>
			</LearningCard>

			{/* Expanded Modal */}
			{isExpanded && (
				<div
					className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
					onClick={handleClose}
				>
					<div
						className="bg-void-bg-1 rounded-lg max-w-4xl max-h-[90vh] overflow-auto p-4"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-medium text-void-fg-1">
								{content.caption || 'Diagram'}
							</h3>
							<button
								onClick={handleClose}
								className="text-void-fg-3 hover:text-void-fg-1"
							>
								✕
							</button>
						</div>
						<div className="min-w-[400px]">
							{renderDiagramContent()}
						</div>
					</div>
				</div>
			)}
		</>
	);
};


