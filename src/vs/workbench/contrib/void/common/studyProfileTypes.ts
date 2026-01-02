/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Study Profile Types
 *
 * Defines types for user profiling in Study Mode.
 * The profile system combines:
 * 1. Manual user selection (self-assessed level)
 * 2. Automatic detection (code patterns, QTE performance)
 * 3. Effective level calculation (combining both)
 */

// ============== User Profile Levels ==============

/**
 * User profile level categories
 * - novice: New to programming or the target technology
 * - crossDomain: Experienced in one domain, learning another
 * - academic: Strong theoretical background, learning practical skills
 * - veteran: Experienced developer, quick learner
 */
export type UserProfileLevel = 'novice' | 'crossDomain' | 'academic' | 'veteran';

/**
 * Display information for each profile level
 */
export const ProfileLevelInfo: Record<UserProfileLevel, {
	label: string;
	description: string;
	icon: string;
	teachingStrategy: string;
}> = {
	novice: {
		label: 'Beginner',
		description: 'New to programming or this technology',
		icon: '🌱',
		teachingStrategy: 'Use simple language, explain every concept, provide step-by-step guidance',
	},
	crossDomain: {
		label: 'Cross-Domain Developer',
		description: 'Experienced in another area, learning this one',
		icon: '🔄',
		teachingStrategy: 'Use analogies to familiar concepts, focus on key differences',
	},
	academic: {
		label: 'Academic Background',
		description: 'Strong in theory, building practical skills',
		icon: '📚',
		teachingStrategy: 'Connect theory to practice, emphasize engineering patterns',
	},
	veteran: {
		label: 'Experienced Developer',
		description: 'Quick learner, just needs key information',
		icon: '⚡',
		teachingStrategy: 'Focus on advanced patterns, best practices, and gotchas',
	},
};

// ============== Detected Patterns ==============

/**
 * Code style patterns detected from user's code
 */
export type CodeStylePattern = 'procedural' | 'oop' | 'functional' | 'mixed';

/**
 * Patterns detected from user's coding behavior
 */
export interface DetectedPatterns {
	/** Primary coding style observed */
	codeStyle: CodeStylePattern;

	/** Error frequency (0-1 scale) */
	errorFrequency: number;

	/** Concepts the user appears to understand */
	conceptsUnderstood: string[];

	/** Concepts the user struggles with */
	conceptsStruggling: string[];

	/** Languages user appears familiar with */
	familiarLanguages: string[];

	/** Average time to complete QTEs */
	qteResponseTime?: number;

	/** QTE accuracy rate (0-1) */
	qteAccuracy?: number;
}

/**
 * Default detected patterns for new users
 */
export const defaultDetectedPatterns: DetectedPatterns = {
	codeStyle: 'mixed',
	errorFrequency: 0,
	conceptsUnderstood: [],
	conceptsStruggling: [],
	familiarLanguages: [],
	qteResponseTime: undefined,
	qteAccuracy: undefined,
};

// ============== User Profile ==============

/**
 * Complete user profile for Study Mode
 */
export interface UserProfile {
	// ---- Manual Settings (user-selected) ----

	/** User's self-assessed skill level */
	selfAssessedLevel: UserProfileLevel;

	/** Programming languages user is familiar with */
	primaryLanguages: string[];

	/** Technologies/frameworks user wants to learn */
	targetTechnologies: string[];

	/** User's preferred learning style */
	learningStyle: 'visual' | 'textual' | 'interactive';

	/** Preferred explanation depth */
	explanationDepth: 'brief' | 'normal' | 'detailed';

	// ---- Auto-Detected Settings ----

	/** Patterns detected from user behavior */
	detectedPatterns: DetectedPatterns;

	// ---- Computed ----

	/** Effective level (combination of manual + detected) */
	effectiveLevel: UserProfileLevel;

	/** Confidence in the effective level (0-1) */
	effectiveLevelConfidence: number;

	// ---- Metadata ----

	/** When the profile was last updated */
	lastUpdated: number;

	/** Number of study sessions */
	sessionCount: number;

	/** Total concepts learned */
	conceptsLearned: string[];
}

/**
 * Default user profile for new users
 */
export const defaultUserProfile: UserProfile = {
	selfAssessedLevel: 'novice',
	primaryLanguages: [],
	targetTechnologies: [],
	learningStyle: 'interactive',
	explanationDepth: 'normal',
	detectedPatterns: defaultDetectedPatterns,
	effectiveLevel: 'novice',
	effectiveLevelConfidence: 0,
	lastUpdated: Date.now(),
	sessionCount: 0,
	conceptsLearned: [],
};

// ============== QTE Performance Tracking ==============

/**
 * Individual QTE result for tracking
 */
export interface QTEResult {
	/** QTE ID */
	qteId: string;

	/** Type of QTE */
	type: 'choice' | 'fillblank' | 'parsons';

	/** Difficulty level */
	difficulty: 'easy' | 'medium' | 'hard';

	/** Whether the answer was correct */
	isCorrect: boolean;

	/** Time taken to answer (ms) */
	timeTaken: number;

	/** Related concept */
	concept?: string;

	/** Timestamp */
	timestamp: number;
}

/**
 * Aggregated QTE statistics
 */
export interface QTEStats {
	/** Total QTEs attempted */
	total: number;

	/** Number correct */
	correct: number;

	/** Accuracy by difficulty */
	accuracyByDifficulty: {
		easy: number;
		medium: number;
		hard: number;
	};

	/** Average response time (ms) */
	averageTime: number;

	/** Most missed concepts */
	struggledConcepts: string[];
}

// ============== Helper Functions ==============

/**
 * Calculate effective level from profile data
 */
export function calculateEffectiveLevel(profile: UserProfile): {
	level: UserProfileLevel;
	confidence: number;
} {
	const { selfAssessedLevel, detectedPatterns } = profile;

	// If we don't have enough data, use self-assessed level with low confidence
	if (profile.sessionCount < 3) {
		return { level: selfAssessedLevel, confidence: 0.3 };
	}

	// Calculate based on detected patterns
	const { qteAccuracy, errorFrequency } = detectedPatterns;

	// Start with self-assessed level
	let effectiveLevel: UserProfileLevel = selfAssessedLevel;
	let confidence = 0.5;

	// Adjust based on QTE performance
	if (qteAccuracy !== undefined) {
		if (qteAccuracy < 0.4 && selfAssessedLevel !== 'novice') {
			effectiveLevel = 'novice';
			confidence += 0.2;
		} else if (qteAccuracy > 0.8 && selfAssessedLevel === 'novice') {
			effectiveLevel = 'crossDomain';
			confidence += 0.2;
		}
	}

	// Adjust based on error frequency
	if (errorFrequency > 0.5 && effectiveLevel !== 'novice') {
		// High error rate suggests lower level
		if (effectiveLevel === 'veteran') effectiveLevel = 'crossDomain';
		else if (effectiveLevel === 'crossDomain') effectiveLevel = 'academic';
		confidence += 0.1;
	}

	// Cap confidence at 0.9
	confidence = Math.min(confidence, 0.9);

	return { level: effectiveLevel, confidence };
}

/**
 * Get teaching prompts based on profile level
 */
export function getTeachingPromptForLevel(level: UserProfileLevel): string[] {
	const prompts: string[] = [];

	switch (level) {
		case 'novice':
			prompts.push('使用简单直白的语言解释概念，避免专业术语。');
			prompts.push('每个步骤都要解释"为什么"这样做。');
			prompts.push('提供更多的代码注释和示例。');
			prompts.push('遇到复杂概念时使用日常生活类比。');
			break;

		case 'crossDomain':
			prompts.push('使用类比将新概念映射到用户熟悉的领域。');
			prompts.push('重点解释与其他技术的关键差异。');
			prompts.push('假设用户理解基本编程概念，但不熟悉当前技术栈。');
			break;

		case 'academic':
			prompts.push('将理论知识与实际应用联系起来。');
			prompts.push('强调工程最佳实践和设计模式。');
			prompts.push('解释"为什么"比"如何"更重要。');
			break;

		case 'veteran':
			prompts.push('简洁明了，直入主题。');
			prompts.push('重点介绍高级模式和潜在陷阱。');
			prompts.push('可以使用专业术语，不需要解释基础概念。');
			break;
	}

	return prompts;
}

// ============== Storage Keys ==============

export const STUDY_PROFILE_STORAGE_KEY = 'void.study.profile';
export const STUDY_QTE_HISTORY_STORAGE_KEY = 'void.study.qte.history';


