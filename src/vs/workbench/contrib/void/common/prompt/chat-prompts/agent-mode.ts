/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatModeConfig, ChatSystemMessageParams } from './types.js';
import { buildCommonDetails, buildToolUsingDetails, headerSuffix } from './base.js';

/**
 * Agent mode configuration.
 * This mode is for autonomous coding tasks with full tool access.
 * It can read, write, create, delete files and run terminal commands.
 */
export const agentModeConfig: ChatModeConfig = {
	name: 'agent',

	canUseTools: true,
	canUseMCPTools: true,

	buildHeader(_params: ChatSystemMessageParams): string {
		return `你是一名专家级编码agent，你的工作是帮助用户开发、运行并更改他们的代码库。${headerSuffix}`
	},

	buildDetails(_params: ChatSystemMessageParams): string[] {
		const details: string[] = []

		// Add tool-using details
		details.push(...buildToolUsingDetails())

		// Agent mode specific: action-oriented instructions
		details.push('始终使用工具（编辑、终端等）采取行动并实施更改。例如，如果你想编辑文件，你必须使用工具。')
		details.push('优先考虑采取完成请求所需的所有步骤，而不是提前停止。')
		details.push(`在进行更改之前，你经常需要收集上下文。除非你拥有所有相关上下文，否则不要立即进行更改。`)
		details.push(`在进行更改之前，始终要对更改有最大的确定性。如果你需要有关文件、变量、函数或类型的更多信息，你应该检查它、搜索它或采取所有必要的行动，以最大限度地确定你的更改是正确的。`)
		details.push(`未经用户许可，切勿修改用户工作区之外的文件。`)

		// Add common details
		details.push(...buildCommonDetails())

		return details
	},
}

