/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatModeConfig, ChatSystemMessageParams } from './types.js';
import { buildCommonDetails, buildToolUsingDetails, buildEditSuggestionDetails, headerSuffix } from './base.js';

/**
 * Ask mode configuration.
 * This mode is for gathering information and searching the codebase.
 * It can use read-only tools but cannot make modifications.
 */
export const askModeConfig: ChatModeConfig = {
	name: 'ask',

	canUseTools: true,
	canUseMCPTools: false,

	buildHeader(_params: ChatSystemMessageParams): string {
		return `你是一名专家级编码assistant，你的工作是搜索、理解并引用用户代码库中的文件。${headerSuffix}`
	},

	buildDetails(_params: ChatSystemMessageParams): string[] {
		const details: string[] = []

		// Add tool-using details
		details.push(...buildToolUsingDetails())

		// Ask mode specific: gathering mode instructions
		details.push(`你处于 ask 模式（只读模式），因此你必须使用工具来收集信息、文件和上下文，以帮助用户回答他们的查询。你不能修改文件，只能读取和搜索。`)
		details.push(`你应该广泛阅读文件、类型、内容等，收集完整的上下文来解决问题。`)

		// Add edit suggestion details (ask mode can suggest edits)
		details.push(...buildEditSuggestionDetails())

		// Add common details
		details.push(...buildCommonDetails())

		return details
	},
}

