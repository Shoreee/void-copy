/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatModeConfig, ChatSystemMessageParams } from './types.js';
import { buildCommonDetails, buildToolUsingDetails, headerSuffix } from './base.js';
import {
	buildQTEPrompts,
	buildCurriculumPrompts,
	buildPedagogyPrompts,
	buildVisualizationPrompts,
	buildResponseStylePrompts,
	buildBackgroundTaskPrompts,
	buildCoCreationPrompts,
	buildTeachingFlowPrompts,
	buildFlowEditorPrompts,
} from '../study-prompts/index.js';

/**
 * Study mode configuration.
 * This mode is designed for "learning by doing" - helping users learn new technologies
 * through guided, interactive coding experiences.
 *
 * Key principles:
 * 1. Credibility over efficiency - ensure accurate, reliable explanations
 * 2. Progressive learning - adjust depth based on user level
 * 3. Active teaching - trigger QTE (Quick Time Events) at decision points
 *
 * Target user scenarios:
 * - Interns learning legacy codebase
 * - Frontend developers learning backend
 * - Students transitioning between languages (e.g., C to Python)
 * - Anyone learning new frameworks or technologies
 */
export const studyModeConfig: ChatModeConfig = {
	name: 'study',

	canUseTools: true,
	canUseMCPTools: true,

	buildHeader(_params: ChatSystemMessageParams): string {
		return `你是一名专业的编程教学导师，同时具备教学规划师和技术专家的双重身份。
你的核心目标是通过"做中学"(Learning by Doing)的方式帮助用户掌握新技术。${headerSuffix}`
	},

	buildDetails(_params: ChatSystemMessageParams): string[] {
		const details: string[] = []

		// Add tool-using details
		details.push(...buildToolUsingDetails())

		// Add study mode specific prompts (decoupled)
		details.push(...buildPedagogyPrompts())      // Core principles & teaching strategies
		details.push(...buildTeachingFlowPrompts())  // Structured teaching templates
		details.push(...buildQTEPrompts())           // QTE interaction guidelines
		details.push(...buildCurriculumPrompts())    // Learning progress tracking
		details.push(...buildVisualizationPrompts()) // Diagram, thought, action, lens
		details.push(...buildBackgroundTaskPrompts()) // Background task system
		details.push(buildCoCreationPrompts())       // Co-creation ghost text system (legacy)
		details.push(buildFlowEditorPrompts())       // Flow editor - interactive coding
		details.push(...buildResponseStylePrompts()) // Response style guidelines

		// Add common details
		details.push(...buildCommonDetails())

		return details
	},
}

