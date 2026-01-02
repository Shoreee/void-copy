/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

import {
	UserProfile,
	DetectedPatterns,
	QTEResult,
	QTEStats,
	defaultUserProfile,
	calculateEffectiveLevel,
	getTeachingPromptForLevel,
	STUDY_PROFILE_STORAGE_KEY,
	STUDY_QTE_HISTORY_STORAGE_KEY,
} from '../common/studyProfileTypes.js';

// ============== Service Interface ==============

export interface IStudyProfileService {
	readonly _serviceBrand: undefined;

	/** Current user profile */
	readonly profile: UserProfile;

	/** QTE statistics */
	readonly qteStats: QTEStats;

	/** Number of consecutive QTE timeouts */
	readonly consecutiveTimeouts: number;

	// Profile Management
	getProfile(): UserProfile;
	setManualProfile(partial: Partial<Pick<UserProfile, 'selfAssessedLevel' | 'primaryLanguages' | 'targetTechnologies' | 'learningStyle' | 'explanationDepth'>>): void;
	resetProfile(): void;

	// Auto-Detection
	analyzeCodePattern(code: string, language?: string): void;
	recordQTEResult(result: QTEResult): void;
	updateDetectedPatterns(patterns: Partial<DetectedPatterns>): void;

	// Timeout Tracking
	recordTimeoutEvent(): number;  // Returns current consecutive count
	resetTimeoutCounter(): void;

	// Teaching Prompts
	getTeachingPrompts(): string[];
	getUserContextForPrompt(): string;

	// Events
	readonly onDidChangeProfile: Event<UserProfile>;
	readonly onConsecutiveTimeouts: Event<number>;  // Fires when threshold reached
}

export const IStudyProfileService = createDecorator<IStudyProfileService>('StudyProfileService');

// ============== Service Implementation ==============

class StudyProfileService extends Disposable implements IStudyProfileService {
	readonly _serviceBrand: undefined;

	private _profile: UserProfile;
	private _qteHistory: QTEResult[] = [];
	private _qteStats: QTEStats;
	private _consecutiveTimeouts: number = 0;

	// Events
	private readonly _onDidChangeProfile = this._register(new Emitter<UserProfile>());
	readonly onDidChangeProfile = this._onDidChangeProfile.event;

	private readonly _onConsecutiveTimeouts = this._register(new Emitter<number>());
	readonly onConsecutiveTimeouts = this._onConsecutiveTimeouts.event;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();

		// Load profile from storage
		this._profile = this._loadProfile();
		this._qteHistory = this._loadQTEHistory();
		this._qteStats = this._calculateQTEStats();

		// Update effective level
		this._updateEffectiveLevel();
	}

	// ============== Getters ==============

	get profile(): UserProfile {
		return this._profile;
	}

	get qteStats(): QTEStats {
		return this._qteStats;
	}

	get consecutiveTimeouts(): number {
		return this._consecutiveTimeouts;
	}

	getProfile(): UserProfile {
		return this._profile;
	}

	// ============== Profile Management ==============

	setManualProfile(partial: Partial<Pick<UserProfile, 'selfAssessedLevel' | 'primaryLanguages' | 'targetTechnologies' | 'learningStyle' | 'explanationDepth'>>): void {
		this._profile = {
			...this._profile,
			...partial,
			lastUpdated: Date.now(),
		};

		// Recalculate effective level
		this._updateEffectiveLevel();

		// Save and notify
		this._saveProfile();
		this._onDidChangeProfile.fire(this._profile);
	}

	resetProfile(): void {
		this._profile = { ...defaultUserProfile, lastUpdated: Date.now() };
		this._qteHistory = [];
		this._qteStats = this._calculateQTEStats();
		this._consecutiveTimeouts = 0;

		this._saveProfile();
		this._saveQTEHistory();
		this._onDidChangeProfile.fire(this._profile);
	}

	// ============== Timeout Tracking ==============

	recordTimeoutEvent(): number {
		this._consecutiveTimeouts++;

		// Fire event when threshold is reached (3 or more)
		if (this._consecutiveTimeouts >= 3) {
			this._onConsecutiveTimeouts.fire(this._consecutiveTimeouts);
		}

		return this._consecutiveTimeouts;
	}

	resetTimeoutCounter(): void {
		this._consecutiveTimeouts = 0;
	}

	// ============== Auto-Detection ==============

	analyzeCodePattern(code: string, language?: string): void {
		const patterns = { ...this._profile.detectedPatterns };

		// Detect coding style
		patterns.codeStyle = this._detectCodeStyle(code);

		// Add language to familiar languages if not present
		if (language && !patterns.familiarLanguages.includes(language)) {
			patterns.familiarLanguages = [...patterns.familiarLanguages, language];
		}

		this.updateDetectedPatterns(patterns);
	}

	recordQTEResult(result: QTEResult): void {
		this._qteHistory.push(result);

		// Keep only last 100 results
		if (this._qteHistory.length > 100) {
			this._qteHistory = this._qteHistory.slice(-100);
		}

		// Update stats
		this._qteStats = this._calculateQTEStats();

		// Update detected patterns
		const patterns = { ...this._profile.detectedPatterns };
		patterns.qteAccuracy = this._qteStats.correct / Math.max(this._qteStats.total, 1);
		patterns.qteResponseTime = this._qteStats.averageTime;

		// Track concepts
		if (result.concept) {
			if (result.isCorrect) {
				if (!patterns.conceptsUnderstood.includes(result.concept)) {
					patterns.conceptsUnderstood = [...patterns.conceptsUnderstood, result.concept];
				}
			} else {
				if (!patterns.conceptsStruggling.includes(result.concept)) {
					patterns.conceptsStruggling = [...patterns.conceptsStruggling, result.concept];
				}
			}
		}

		this.updateDetectedPatterns(patterns);
		this._saveQTEHistory();
	}

	updateDetectedPatterns(patterns: Partial<DetectedPatterns>): void {
		this._profile = {
			...this._profile,
			detectedPatterns: {
				...this._profile.detectedPatterns,
				...patterns,
			},
			lastUpdated: Date.now(),
		};

		// Recalculate effective level
		this._updateEffectiveLevel();

		// Save and notify
		this._saveProfile();
		this._onDidChangeProfile.fire(this._profile);
	}

	// ============== Teaching Prompts ==============

	getTeachingPrompts(): string[] {
		return getTeachingPromptForLevel(this._profile.effectiveLevel);
	}

	getUserContextForPrompt(): string {
		const { effectiveLevel, primaryLanguages, targetTechnologies, learningStyle, explanationDepth } = this._profile;

		const parts: string[] = [];

		// Level description
		parts.push(`用户技能水平: ${effectiveLevel}`);

		// Language background
		if (primaryLanguages.length > 0) {
			parts.push(`用户熟悉的编程语言: ${primaryLanguages.join(', ')}`);
		}

		// Learning goals
		if (targetTechnologies.length > 0) {
			parts.push(`用户想学习的技术: ${targetTechnologies.join(', ')}`);
		}

		// Learning preferences
		parts.push(`学习风格偏好: ${learningStyle === 'visual' ? '视觉化' : learningStyle === 'textual' ? '文字化' : '交互式'}`);
		parts.push(`解释详细程度: ${explanationDepth === 'brief' ? '简洁' : explanationDepth === 'detailed' ? '详细' : '适中'}`);

		// Struggled concepts
		const { conceptsStruggling } = this._profile.detectedPatterns;
		if (conceptsStruggling.length > 0) {
			parts.push(`用户在以下概念上遇到困难: ${conceptsStruggling.slice(0, 5).join(', ')}`);
		}

		return parts.join('\n');
	}

	// ============== Private Methods ==============

	private _updateEffectiveLevel(): void {
		this._profile.sessionCount += 1;
		const { level, confidence } = calculateEffectiveLevel(this._profile);
		this._profile.effectiveLevel = level;
		this._profile.effectiveLevelConfidence = confidence;
	}

	private _detectCodeStyle(code: string): 'procedural' | 'oop' | 'functional' | 'mixed' {
		const hasClasses = /class\s+\w+/.test(code);
		const hasFunctions = /function\s+\w+|const\s+\w+\s*=\s*\(|=>\s*{/.test(code);
		const hasHigherOrder = /\.map\(|\.filter\(|\.reduce\(|\.forEach\(/.test(code);

		if (hasClasses && hasHigherOrder) return 'mixed';
		if (hasClasses) return 'oop';
		if (hasHigherOrder) return 'functional';
		if (hasFunctions) return 'procedural';

		return 'mixed';
	}

	private _calculateQTEStats(): QTEStats {
		const total = this._qteHistory.length;
		const correct = this._qteHistory.filter(r => r.isCorrect).length;

		const byDifficulty = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } };
		let totalTime = 0;
		const conceptMisses: Record<string, number> = {};

		for (const result of this._qteHistory) {
			byDifficulty[result.difficulty].total++;
			if (result.isCorrect) byDifficulty[result.difficulty].correct++;
			totalTime += result.timeTaken;

			if (!result.isCorrect && result.concept) {
				conceptMisses[result.concept] = (conceptMisses[result.concept] || 0) + 1;
			}
		}

		const struggledConcepts = Object.entries(conceptMisses)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([concept]) => concept);

		return {
			total,
			correct,
			accuracyByDifficulty: {
				easy: byDifficulty.easy.total > 0 ? byDifficulty.easy.correct / byDifficulty.easy.total : 0,
				medium: byDifficulty.medium.total > 0 ? byDifficulty.medium.correct / byDifficulty.medium.total : 0,
				hard: byDifficulty.hard.total > 0 ? byDifficulty.hard.correct / byDifficulty.hard.total : 0,
			},
			averageTime: total > 0 ? totalTime / total : 0,
			struggledConcepts,
		};
	}

	private _loadProfile(): UserProfile {
		try {
			const data = this._storageService.get(STUDY_PROFILE_STORAGE_KEY, StorageScope.APPLICATION);
			if (data) {
				const parsed = JSON.parse(data);
				return { ...defaultUserProfile, ...parsed };
			}
		} catch (e) {
			console.error('Failed to load study profile:', e);
		}
		return { ...defaultUserProfile };
	}

	private _saveProfile(): void {
		try {
			this._storageService.store(
				STUDY_PROFILE_STORAGE_KEY,
				JSON.stringify(this._profile),
				StorageScope.APPLICATION,
				StorageTarget.USER
			);
		} catch (e) {
			console.error('Failed to save study profile:', e);
		}
	}

	private _loadQTEHistory(): QTEResult[] {
		try {
			const data = this._storageService.get(STUDY_QTE_HISTORY_STORAGE_KEY, StorageScope.APPLICATION);
			if (data) {
				return JSON.parse(data);
			}
		} catch (e) {
			console.error('Failed to load QTE history:', e);
		}
		return [];
	}

	private _saveQTEHistory(): void {
		try {
			this._storageService.store(
				STUDY_QTE_HISTORY_STORAGE_KEY,
				JSON.stringify(this._qteHistory),
				StorageScope.APPLICATION,
				StorageTarget.USER
			);
		} catch (e) {
			console.error('Failed to save QTE history:', e);
		}
	}
}

// Register the service
registerSingleton(IStudyProfileService, StudyProfileService, InstantiationType.Delayed);


