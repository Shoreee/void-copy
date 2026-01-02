/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatMode } from '../../voidSettingsTypes.js';
import { InternalToolInfo, systemToolsXMLPrompt } from '../tools.js';
import { ChatModeConfig, ChatModeRegistry, ChatSystemMessageParams } from './types.js';
import { buildSysInfo, buildFsInfo, formatImportantDetails } from './base.js';
import { chatModeConfig } from './chat-mode.js';
import { askModeConfig } from './ask-mode.js';
import { agentModeConfig } from './agent-mode.js';
import { studyModeConfig } from './study-mode.js';

// Re-export types and base utilities
export * from './types.js';
export * from './base.js';

// ======================================================== Mode Registry ========================================================

/**
 * Registry of all available chat modes.
 * To add a new mode:
 * 1. Create a new file (e.g., new-mode.ts) with ChatModeConfig
 * 2. Import and add it to this registry
 * 3. Add the mode name to ChatMode type in voidSettingsTypes.ts
 */
export const modeRegistry: ChatModeRegistry = {
	chat: chatModeConfig,
	ask: askModeConfig,
	agent: agentModeConfig,
	study: studyModeConfig,
}

/**
 * Get the configuration for a specific mode
 */
export const getModeConfig = (mode: ChatMode): ChatModeConfig => {
	return modeRegistry[mode]
}

// ======================================================== Main System Message Builder ========================================================

/**
 * Build the complete system message for a chat mode.
 * This is the main entry point used by the chat service.
 */
export const chat_systemMessage = ({
	workspaceFolders,
	openedURIs,
	activeURI,
	persistentTerminalIDs,
	directoryStr,
	chatMode: mode,
	mcpTools,
	includeXMLToolDefinitions
}: {
	workspaceFolders: string[],
	directoryStr: string,
	openedURIs: string[],
	activeURI: string | undefined,
	persistentTerminalIDs: string[],
	chatMode: ChatMode,
	mcpTools: InternalToolInfo[] | undefined,
	includeXMLToolDefinitions: boolean
}): string => {

	const params: ChatSystemMessageParams = {
		workspaceFolders,
		directoryStr,
		openedURIs,
		activeURI,
		persistentTerminalIDs,
		mcpTools,
		includeXMLToolDefinitions,
	}

	// Get the mode configuration
	const modeConfig = getModeConfig(mode)

	// Build all sections
	const header = modeConfig.buildHeader(params)
	const sysInfo = buildSysInfo(params, mode)
	const fsInfo = buildFsInfo(directoryStr)

	// Build tool definitions if needed
	const toolDefinitions = includeXMLToolDefinitions && modeConfig.canUseTools
		? systemToolsXMLPrompt(mode, mcpTools)
		: null

	// Build details
	const details = modeConfig.buildDetails(params)
	const importantDetails = formatImportantDetails(details)

	// Assemble the full message
	const ansStrs: string[] = []
	ansStrs.push(header)
	ansStrs.push(sysInfo)
	if (toolDefinitions) ansStrs.push(toolDefinitions)
	ansStrs.push(importantDetails)
	ansStrs.push(fsInfo)

	const fullSystemMsgStr = ansStrs
		.join('\n\n\n')
		.trim()
		.replace('\t', '  ')

	return fullSystemMsgStr
}

