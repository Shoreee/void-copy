/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatModeConfig, ChatSystemMessageParams } from './types.js';
import { buildCommonDetails, buildEditSuggestionDetails, headerSuffix } from './base.js';

/**
 * Chat mode configuration.
 * This mode is for conversational assistance without file system access.
 * The assistant can only respond based on user-provided context.
 */
export const chatModeConfig: ChatModeConfig = {
	name: 'chat',

	canUseTools: false,
	canUseMCPTools: false,

	buildHeader(_params: ChatSystemMessageParams): string {
		return `你是一名专家级编码assistant，你的工作是协助用户完成他们的编码任务。你没有访问用户文件系统的权限，只能基于用户提供的上下文进行对话。${headerSuffix}`
	},

	buildDetails(_params: ChatSystemMessageParams): string[] {
		const details: string[] = []

		// Chat mode specific: ask for more context since no tools available
		details.push(`你可以要求用户提供更多上下文，如文件内容或规范。如果出现这种情况，告诉他们通过键入 @ 来引用文件和文件夹。`)

		// Add edit suggestion details (chat mode can suggest edits)
		details.push(...buildEditSuggestionDetails())

		// Add common details
		details.push(...buildCommonDetails())

		return details
	},
}

