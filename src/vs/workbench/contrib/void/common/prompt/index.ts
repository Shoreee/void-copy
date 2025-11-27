/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Main entry point for all prompt-related exports.
 * This file re-exports everything for backward compatibility with existing imports.
 *
 * Structure:
 * - constants.ts: All constants and limits
 * - tools.ts: Tool definitions, types, utilities
 * - chat-prompts/: Chat mode system/user messages
 *   - types.ts: ChatModeConfig interface
 *   - base.ts: Shared utilities for all modes
 *   - chat-mode.ts, ask-mode.ts, agent-mode.ts: Mode-specific configs
 *   - index.ts: Mode registry and chat_systemMessage
 * - apply-prompts.ts: Code rewrite and search/replace prompts
 * - quick-edit-prompts.ts: Ctrl+K FIM prompts
 * - git-prompts.ts: Git commit message prompts
 */

// Constants
export * from './constants.js';

// Tools
export * from './tools.js';

// Chat prompts (includes mode registry, chat_systemMessage, base utilities, types)
export * from './chat-prompts/index.js';

// Apply prompts
export * from './apply-prompts.js';

// Quick edit prompts
export * from './quick-edit-prompts.js';

// Git prompts
export * from './git-prompts.js';

