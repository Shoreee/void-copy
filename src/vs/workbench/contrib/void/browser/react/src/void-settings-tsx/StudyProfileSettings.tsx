/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useEffect } from 'react';
import { useAccessor } from '../util/services.js';
import { X, RefreshCw } from 'lucide-react';
import {
	UserProfileLevel,
	ProfileLevelInfo,
} from '../../../../common/studyProfileTypes.js';

// ============== Types ==============

interface TagInputProps {
	label: string;
	value: string[];
	onChange: (values: string[]) => void;
	placeholder?: string;
	suggestions?: string[];
}

// ============== Components ==============

/**
 * Tag input component for languages/technologies
 */
const TagInput: React.FC<TagInputProps> = ({
	label,
	value,
	onChange,
	placeholder = 'Type and press Enter...',
	suggestions = [],
}) => {
	const [inputValue, setInputValue] = useState('');
	const [showSuggestions, setShowSuggestions] = useState(false);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && inputValue.trim()) {
			e.preventDefault();
			if (!value.includes(inputValue.trim())) {
				onChange([...value, inputValue.trim()]);
			}
			setInputValue('');
		}
	};

	const handleRemove = (tag: string) => {
		onChange(value.filter(v => v !== tag));
	};

	const handleAddSuggestion = (suggestion: string) => {
		if (!value.includes(suggestion)) {
			onChange([...value, suggestion]);
		}
		setShowSuggestions(false);
	};

	const filteredSuggestions = suggestions.filter(
		s => !value.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
	);

	return (
		<div className="space-y-2">
			<label className="text-sm text-void-fg-2">{label}</label>
			<div className="flex flex-wrap gap-2 mb-2">
				{value.map(tag => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-400 rounded text-xs"
					>
						{tag}
						<button
							onClick={() => handleRemove(tag)}
							className="hover:text-red-400"
						>
							<X className="w-3 h-3" />
						</button>
					</span>
				))}
			</div>
			<div className="relative">
				<input
					type="text"
					value={inputValue}
					onChange={e => {
						setInputValue(e.target.value);
						setShowSuggestions(e.target.value.length > 0);
					}}
					onKeyDown={handleKeyDown}
					onFocus={() => setShowSuggestions(inputValue.length > 0)}
					onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
					placeholder={placeholder}
					className="
						w-full px-3 py-2 rounded
						bg-void-bg-2 border border-void-border-2
						text-void-fg-1 placeholder-void-fg-3
						focus:outline-none focus:border-teal-500
						text-sm
					"
				/>
				{showSuggestions && filteredSuggestions.length > 0 && (
					<div className="absolute z-10 w-full mt-1 bg-void-bg-1 border border-void-border-2 rounded shadow-lg max-h-40 overflow-auto">
						{filteredSuggestions.map(suggestion => (
							<button
								key={suggestion}
								onClick={() => handleAddSuggestion(suggestion)}
								className="w-full px-3 py-2 text-left text-sm hover:bg-void-bg-2 text-void-fg-1"
							>
								{suggestion}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

/**
 * Profile level selector with descriptions
 */
const ProfileLevelSelector: React.FC<{
	value: UserProfileLevel;
	onChange: (level: UserProfileLevel) => void;
}> = ({ value, onChange }) => {
	const levels: UserProfileLevel[] = ['novice', 'crossDomain', 'academic', 'veteran'];

	return (
		<div className="space-y-3">
			<label className="text-sm text-void-fg-2">Skill Level</label>
			<div className="grid grid-cols-2 gap-2">
				{levels.map(level => {
					const info = ProfileLevelInfo[level];
					const isSelected = value === level;

					return (
						<button
							key={level}
							onClick={() => onChange(level)}
							className={`
								p-3 rounded-lg border-2 text-left transition-all
								${isSelected
									? 'border-teal-500 bg-teal-500/10'
									: 'border-void-border-2 hover:border-void-border-1'
								}
							`}
						>
							<div className="flex items-center gap-2 mb-1">
								<span>{info.icon}</span>
								<span className={`font-medium text-sm ${isSelected ? 'text-teal-400' : 'text-void-fg-1'}`}>
									{info.label}
								</span>
							</div>
							<p className="text-xs text-void-fg-3">{info.description}</p>
						</button>
					);
				})}
			</div>
		</div>
	);
};

/**
 * QTE Statistics display
 */
const QTEStatsDisplay: React.FC<{
	stats: {
		total: number;
		correct: number;
		accuracyByDifficulty: { easy: number; medium: number; hard: number };
		averageTime: number;
	};
}> = ({ stats }) => {
	const overallAccuracy = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : '0';

	return (
		<div className="space-y-3">
			<label className="text-sm text-void-fg-2">Learning Statistics</label>
			<div className="grid grid-cols-3 gap-3">
				<div className="p-3 bg-void-bg-2 rounded-lg text-center">
					<div className="text-2xl font-bold text-teal-400">{stats.total}</div>
					<div className="text-xs text-void-fg-3">Challenges</div>
				</div>
				<div className="p-3 bg-void-bg-2 rounded-lg text-center">
					<div className="text-2xl font-bold text-green-400">{overallAccuracy}%</div>
					<div className="text-xs text-void-fg-3">Accuracy</div>
				</div>
				<div className="p-3 bg-void-bg-2 rounded-lg text-center">
					<div className="text-2xl font-bold text-blue-400">
						{stats.averageTime > 0 ? `${(stats.averageTime / 1000).toFixed(1)}s` : '-'}
					</div>
					<div className="text-xs text-void-fg-3">Avg Time</div>
				</div>
			</div>

			{/* Accuracy by difficulty */}
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<span className="text-xs text-void-fg-3 w-16">Easy</span>
					<div className="flex-1 h-2 bg-void-bg-3 rounded-full overflow-hidden">
						<div
							className="h-full bg-green-500"
							style={{ width: `${stats.accuracyByDifficulty.easy * 100}%` }}
						/>
					</div>
					<span className="text-xs text-void-fg-3 w-12">
						{(stats.accuracyByDifficulty.easy * 100).toFixed(0)}%
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-void-fg-3 w-16">Medium</span>
					<div className="flex-1 h-2 bg-void-bg-3 rounded-full overflow-hidden">
						<div
							className="h-full bg-yellow-500"
							style={{ width: `${stats.accuracyByDifficulty.medium * 100}%` }}
						/>
					</div>
					<span className="text-xs text-void-fg-3 w-12">
						{(stats.accuracyByDifficulty.medium * 100).toFixed(0)}%
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-void-fg-3 w-16">Hard</span>
					<div className="flex-1 h-2 bg-void-bg-3 rounded-full overflow-hidden">
						<div
							className="h-full bg-red-500"
							style={{ width: `${stats.accuracyByDifficulty.hard * 100}%` }}
						/>
					</div>
					<span className="text-xs text-void-fg-3 w-12">
						{(stats.accuracyByDifficulty.hard * 100).toFixed(0)}%
					</span>
				</div>
			</div>
		</div>
	);
};

// ============== Main Component ==============

/**
 * Study Profile Settings Component
 * Allows users to configure their learning profile for Study Mode
 */
export const StudyProfileSettings: React.FC = () => {
	const accessor = useAccessor();
	const profileService = accessor.get('IStudyProfileService');

	const [profile, setProfile] = useState(profileService.getProfile());
	const [stats, setStats] = useState(profileService.qteStats);

	// Update when profile changes
	useEffect(() => {
		const updateProfile = () => {
			setProfile(profileService.getProfile());
			setStats(profileService.qteStats);
		};

		updateProfile();
		const disposable = profileService.onDidChangeProfile(updateProfile);
		return () => disposable.dispose();
	}, [profileService]);

	const handleLevelChange = useCallback((level: UserProfileLevel) => {
		profileService.setManualProfile({ selfAssessedLevel: level });
	}, [profileService]);

	const handleLanguagesChange = useCallback((languages: string[]) => {
		profileService.setManualProfile({ primaryLanguages: languages });
	}, [profileService]);

	const handleTechnologiesChange = useCallback((technologies: string[]) => {
		profileService.setManualProfile({ targetTechnologies: technologies });
	}, [profileService]);

	const handleLearningStyleChange = useCallback((style: 'visual' | 'textual' | 'interactive') => {
		profileService.setManualProfile({ learningStyle: style });
	}, [profileService]);

	const handleExplanationDepthChange = useCallback((depth: 'brief' | 'normal' | 'detailed') => {
		profileService.setManualProfile({ explanationDepth: depth });
	}, [profileService]);

	const handleReset = useCallback(() => {
		if (confirm('Are you sure you want to reset your learning profile? This will clear all progress.')) {
			profileService.resetProfile();
		}
	}, [profileService]);

	const languageSuggestions = [
		'JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust',
		'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Haskell', 'Elixir', 'R', 'MATLAB'
	];

	const technologySuggestions = [
		'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI',
		'Spring Boot', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'PostgreSQL',
		'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Machine Learning', 'Deep Learning'
	];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-medium text-void-fg-1">Study Profile</h3>
					<p className="text-sm text-void-fg-3">
						Configure your learning profile for personalized teaching in Study mode
					</p>
				</div>
				<button
					onClick={handleReset}
					className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded"
				>
					<RefreshCw className="w-3 h-3" />
					Reset
				</button>
			</div>

			{/* Effective Level Display */}
			<div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
				<div className="flex items-center gap-3">
					<span className="text-2xl">{ProfileLevelInfo[profile.effectiveLevel].icon}</span>
					<div>
						<div className="text-sm text-void-fg-3">Effective Level</div>
						<div className="text-lg font-medium text-teal-400">
							{ProfileLevelInfo[profile.effectiveLevel].label}
						</div>
					</div>
					<div className="ml-auto text-right">
						<div className="text-xs text-void-fg-3">Confidence</div>
						<div className="text-sm text-void-fg-2">
							{(profile.effectiveLevelConfidence * 100).toFixed(0)}%
						</div>
					</div>
				</div>
			</div>

			{/* Self-Assessment */}
			<ProfileLevelSelector
				value={profile.selfAssessedLevel}
				onChange={handleLevelChange}
			/>

			{/* Languages */}
			<TagInput
				label="Programming Languages You Know"
				value={profile.primaryLanguages}
				onChange={handleLanguagesChange}
				placeholder="Add languages (e.g., Python, JavaScript)..."
				suggestions={languageSuggestions}
			/>

			{/* Target Technologies */}
			<TagInput
				label="Technologies You Want to Learn"
				value={profile.targetTechnologies}
				onChange={handleTechnologiesChange}
				placeholder="Add technologies (e.g., React, Docker)..."
				suggestions={technologySuggestions}
			/>

			{/* Learning Style */}
			<div className="space-y-2">
				<label className="text-sm text-void-fg-2">Learning Style</label>
				<div className="flex gap-2">
					{(['visual', 'textual', 'interactive'] as const).map(style => (
						<button
							key={style}
							onClick={() => handleLearningStyleChange(style)}
							className={`
								px-4 py-2 rounded text-sm capitalize
								${profile.learningStyle === style
									? 'bg-teal-500 text-white'
									: 'bg-void-bg-2 text-void-fg-2 hover:bg-void-bg-3'
								}
							`}
						>
							{style === 'visual' ? '📊 Visual' : style === 'textual' ? '📝 Textual' : '🎮 Interactive'}
						</button>
					))}
				</div>
			</div>

			{/* Explanation Depth */}
			<div className="space-y-2">
				<label className="text-sm text-void-fg-2">Explanation Depth</label>
				<div className="flex gap-2">
					{(['brief', 'normal', 'detailed'] as const).map(depth => (
						<button
							key={depth}
							onClick={() => handleExplanationDepthChange(depth)}
							className={`
								px-4 py-2 rounded text-sm capitalize
								${profile.explanationDepth === depth
									? 'bg-teal-500 text-white'
									: 'bg-void-bg-2 text-void-fg-2 hover:bg-void-bg-3'
								}
							`}
						>
							{depth}
						</button>
					))}
				</div>
			</div>

			{/* Statistics */}
			{stats && <QTEStatsDisplay stats={stats} />}

			{/* Concepts Learned */}
			{profile.conceptsLearned.length > 0 && (
				<div className="space-y-2">
					<label className="text-sm text-void-fg-2">Concepts Learned ({profile.conceptsLearned.length})</label>
					<div className="flex flex-wrap gap-2">
						{profile.conceptsLearned.slice(0, 20).map(concept => (
							<span
								key={concept}
								className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs"
							>
								{concept}
							</span>
						))}
						{profile.conceptsLearned.length > 20 && (
							<span className="px-2 py-1 text-void-fg-3 text-xs">
								+{profile.conceptsLearned.length - 20} more
							</span>
						)}
					</div>
				</div>
			)}

			{/* Struggled Concepts */}
			{profile.detectedPatterns.conceptsStruggling.length > 0 && (
				<div className="space-y-2">
					<label className="text-sm text-void-fg-2">Need More Practice</label>
					<div className="flex flex-wrap gap-2">
						{profile.detectedPatterns.conceptsStruggling.slice(0, 10).map(concept => (
							<span
								key={concept}
								className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs"
							>
								{concept}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
};


