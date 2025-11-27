/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatMode } from '../../voidSettingsTypes.js';
import { InternalToolInfo } from '../tools.js';

/**
 * Parameters passed to build a system message for any chat mode
 */
export interface ChatSystemMessageParams {
	workspaceFolders: string[];
	directoryStr: string;
	openedURIs: string[];
	activeURI: string | undefined;
	persistentTerminalIDs: string[];
	mcpTools: InternalToolInfo[] | undefined;
	includeXMLToolDefinitions: boolean;
}

/**
 * Configuration interface for a chat mode.
 * Each mode implements this interface to define its behavior.
 */
export interface ChatModeConfig {
	/** The unique identifier for this mode */
	name: ChatMode;

	/** Build the header section describing the assistant's role */
	buildHeader(params: ChatSystemMessageParams): string;

	/** Build mode-specific details/instructions */
	buildDetails(params: ChatSystemMessageParams): string[];

	/** Whether this mode can use tools */
	canUseTools: boolean;

	/** Whether this mode can use MCP tools (only agent can) */
	canUseMCPTools: boolean;
}

/**
 * Registry type for all available chat modes
 */
export type ChatModeRegistry = {
	[K in ChatMode]: ChatModeConfig;
};

