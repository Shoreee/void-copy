/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RawToolParamsObj } from '../sendLLMMessageTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, BuiltinToolResultType, ToolName } from '../toolsServiceTypes.js';
import { ChatMode } from '../voidSettingsTypes.js';
import { MAX_TERMINAL_INACTIVE_TIME, MAX_TERMINAL_BG_COMMAND_TIME, searchReplaceBlockTemplate } from './constants.js';

// ======================================================== Types ========================================================

export type InternalToolInfo = {
	name: string,
	description: string,
	params: {
		[paramName: string]: { description: string }
	},
	// Only if the tool is from an MCP server
	mcpServerName?: string,
}

export type SnakeCase<S extends string> =
	// exact acronym URI
	S extends 'URI' ? 'uri'
	// suffix URI: e.g. 'rootURI' -> snakeCase('root') + '_uri'
	: S extends `${infer Prefix}URI` ? `${SnakeCase<Prefix>}_uri`
	// default: for each char, prefix '_' on uppercase letters
	: S extends `${infer C}${infer Rest}`
	? `${C extends Lowercase<C> ? C : `_${Lowercase<C>}`}${SnakeCase<Rest>}`
	: S;

export type SnakeCaseKeys<T extends Record<string, any>> = {
	[K in keyof T as SnakeCase<Extract<K, string>>]: T[K]
};

// ======================================================== Helper Functions ========================================================

const uriParam = (object: string) => ({
	uri: { description: `${object} 的完整路径。` }
})

const paginationParam = {
	page_number: { description: '可选。结果的页码。默认为 1。' }
} as const

const terminalDescHelper = `你可以使用此工具运行任何命令：sed、grep 等。不要使用此工具编辑任何文件；请改用 edit_file。使用 git 和其他会打开编辑器的工具（例如 git diff）时，你应该管道传输到 cat 以获取所有结果，而不是停留在 vim 中。`

const cwdHelper = '可选。运行命令的目录。默认为第一个工作区文件夹。'

const replaceTool_description = `\
一个包含 SEARCH/REPLACE 块的字符串，将应用于给定的文件。
你的 SEARCH/REPLACE 块字符串必须按如下格式化：
${searchReplaceBlockTemplate}

## 指南：

1. 如果需要，你可以输出多个 search replace 块。

2. 每个 SEARCH/REPLACE 块中的 ORIGINAL 代码必须与原始文件中的行完全匹配。不要添加或删除原始代码中的任何空格或注释。

3. 每个 ORIGINAL 文本必须足够长，以便唯一地标识更改。但是，尽量写得越少越好。

4. 每个 ORIGINAL 文本必须与所有其他 ORIGINAL 文本不相交。

5. 此字段是一个字符串（不是数组）。`

// ======================================================== Builtin Tools Definition ========================================================

export const builtinTools: {
	[T in keyof BuiltinToolCallParams]: {
		name: string;
		description: string;
		// more params can be generated than exist here, but these params must be a subset of them
		params: Partial<{ [paramName in keyof SnakeCaseKeys<BuiltinToolCallParams[T]>]: { description: string } }>
	}
} = {
	// --- context-gathering (read/search/list) ---

	read_file: {
		name: 'read_file',
		description: `返回给定文件的完整内容。`,
		params: {
			...uriParam('file'),
			start_line: { description: '可选。除非专门为你提供了确切的行号来搜索，否则不要填写此字段。默认为文件的开头。' },
			end_line: { description: '可选。除非专门为你提供了确切的行号来搜索，否则不要填写此字段。默认为文件的结尾。' },
			...paginationParam,
		},
	},

	ls_dir: {
		name: 'ls_dir',
		description: `列出给定 URI 中的所有文件和文件夹。`,
		params: {
			uri: { description: `可选。${'folder'} 的完整路径。将此保留为空或 "" 以搜索所有文件夹。` },
			...paginationParam,
		},
	},

	get_dir_tree: {
		name: 'get_dir_tree',
		description: `这是了解用户代码库的一种非常有效的方法。返回给定文件夹中所有文件和文件夹的树形图。`,
		params: {
			...uriParam('folder')
		}
	},

	search_pathnames_only: {
		name: 'search_pathnames_only',
		description: `返回与给定查询匹配的所有路径名（仅搜索文件名）。你在寻找具有特定名称或路径的文件时应该使用此工具。`,
		params: {
			query: { description: `你的搜索查询。` },
			include_pattern: { description: '可选。只有当你需要因为结果太多而限制搜索时才填写此项。' },
			...paginationParam,
		},
	},

	search_for_files: {
		name: 'search_for_files',
		description: `返回其内容与给定查询匹配的文件名列表。查询可以是任何子字符串或正则表达式。`,
		params: {
			query: { description: `你的搜索查询。` },
			search_in_folder: { description: '可选。默认为空。只有当你之前的相同查询搜索被截断时才填写此项。仅搜索此文件夹的后代。' },
			is_regex: { description: '可选。默认为 false。查询是否为正则表达式。' },
			...paginationParam,
		},
	},

	search_in_file: {
		name: 'search_in_file',
		description: `返回内容在文件中出现的所有起始行号的数组。`,
		params: {
			...uriParam('file'),
			query: { description: '要在文件中搜索的字符串或正则表达式。' },
			is_regex: { description: '可选。默认为 false。查询是否为正则表达式。' }
		}
	},

	read_lint_errors: {
		name: 'read_lint_errors',
		description: `使用此工具查看文件上的所有 lint 错误。`,
		params: {
			...uriParam('file'),
		},
	},

	// --- editing (create/delete) ---

	create_file_or_folder: {
		name: 'create_file_or_folder',
		description: `在给定路径创建文件或文件夹。要创建文件夹，路径必须以斜杠结尾。`,
		params: {
			...uriParam('file or folder'),
		},
	},

	delete_file_or_folder: {
		name: 'delete_file_or_folder',
		description: `删除给定路径的文件或文件夹。`,
		params: {
			...uriParam('file or folder'),
			is_recursive: { description: '可选。返回 true 以递归删除。' }
		},
	},

	edit_file: {
		name: 'edit_file',
		description: `编辑文件的内容。你必须提供文件的 URI 以及一个用于应用编辑的搜索/替换块字符串。`,
		params: {
			...uriParam('file'),
			search_replace_blocks: { description: replaceTool_description }
		},
	},

	rewrite_file: {
		name: 'rewrite_file',
		description: `编辑文件，删除所有旧内容并用你的新内容替换它们。如果你想编辑你刚刚创建的文件，请使用此工具。`,
		params: {
			...uriParam('file'),
			new_content: { description: `文件的新内容。必须是字符串。` }
		},
	},

	run_command: {
		name: 'run_command',
		description: `运行终端命令并等待结果（在 ${MAX_TERMINAL_INACTIVE_TIME} 秒不活动后超时）。${terminalDescHelper}`,
		params: {
			command: { description: '要运行的终端命令。' },
			cwd: { description: cwdHelper },
		},
	},

	run_persistent_command: {
		name: 'run_persistent_command',
		description: `在你使用 open_persistent_terminal 创建的持久终端中运行终端命令（${MAX_TERMINAL_BG_COMMAND_TIME} 秒后的结果将返回，命令继续在后台运行）。${terminalDescHelper}`,
		params: {
			command: { description: '要运行的终端命令。' },
			persistent_terminal_id: { description: '使用 open_persistent_terminal 创建的终端的 ID。' },
		},
	},

	open_persistent_terminal: {
		name: 'open_persistent_terminal',
		description: `当你想要无限期运行终端命令（如开发服务器，例如 \`npm run dev\`）、后台监听器等时，请使用此工具。在用户环境中打开一个新终端，不会被等待或杀死。`,
		params: {
			cwd: { description: cwdHelper },
		}
	},

	kill_persistent_terminal: {
		name: 'kill_persistent_terminal',
		description: `中断并关闭你使用 open_persistent_terminal 打开的持久终端。`,
		params: { persistent_terminal_id: { description: `持久终端的 ID。` } }
	},

	web_search: {
		name: 'web_search',
		description: `使用 Exa 的嵌入搜索在网上查找与给定查询相关的网页。返回标题、URL 和内容摘要。`,
		params: {
			query: { description: '搜索查询字符串。' },
			num_results: { description: '可选。返回结果数量，默认为 5。' }
		}
	},

	web_get_contents: {
		name: 'web_get_contents',
		description: `获取一个或多个网页的干净、解析后的文本内容。用于深入阅读特定网页。`,
		params: {
			urls: { description: '要获取内容的 URL 数组。' }
		}
	},

	web_find_similar: {
		name: 'web_find_similar',
		description: `根据给定的 URL，查找并返回内容相似的网页。用于发现相关资源。`,
		params: {
			url: { description: '参考网页的 URL。' },
			num_results: { description: '可选。返回结果数量，默认为 5。' }
		}
	},

	web_answer: {
		name: 'web_answer',
		description: `使用 Exa 的 Answer API 直接回答问题，返回答案和引用来源。`,
		params: {
			question: { description: '要回答的问题。' }
		}
	},

	web_research: {
		name: 'web_research',
		description: `自动化深入的网页研究，返回带有引用的结构化研究结果。适用于复杂问题的深入调研。`,
		params: {
			query: { description: '研究主题或问题。' }
		}
	}

} satisfies { [T in keyof BuiltinToolResultType]: InternalToolInfo }

// ======================================================== Tool Utilities ========================================================

export const builtinToolNames = Object.keys(builtinTools) as BuiltinToolName[]
const toolNamesSet = new Set<string>(builtinToolNames)

export const isABuiltinToolName = (toolName: string): toolName is BuiltinToolName => {
	const isAToolName = toolNamesSet.has(toolName)
	return isAToolName
}

export const availableTools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined) => {
	const builtinToolNames: BuiltinToolName[] | undefined = chatMode === 'chat' ? undefined
		: chatMode === 'ask' ? (Object.keys(builtinTools) as BuiltinToolName[]).filter(toolName => !(toolName in approvalTypeOfBuiltinToolName))
			: chatMode === 'agent' ? Object.keys(builtinTools) as BuiltinToolName[]
				: chatMode === 'study' ? Object.keys(builtinTools) as BuiltinToolName[]  // Study mode has same tools as agent
					: undefined

	const effectiveBuiltinTools = builtinToolNames?.map(toolName => builtinTools[toolName]) ?? undefined
	// MCP tools available for both agent and study modes
	const effectiveMCPTools = (chatMode === 'agent' || chatMode === 'study') ? mcpTools : undefined

	const tools: InternalToolInfo[] | undefined = !(builtinToolNames || mcpTools) ? undefined
		: [
			...effectiveBuiltinTools ?? [],
			...effectiveMCPTools ?? [],
		]

	return tools
}

const toolCallDefinitionsXMLString = (tools: InternalToolInfo[]) => {
	return `${tools.map((t, i) => {
		const params = Object.keys(t.params).map(paramName => `<${paramName}>${t.params[paramName].description}</${paramName}>`).join('\n')
		return `\
    ${i + 1}. ${t.name}
    Description: ${t.description}
    Format:
    <${t.name}>${!params ? '' : `\n${params}`}
    </${t.name}>`
	}).join('\n\n')}`
}

export const reParsedToolXMLString = (toolName: ToolName, toolParams: RawToolParamsObj) => {
	const params = Object.keys(toolParams).map(paramName => `<${paramName}>${toolParams[paramName]}</${paramName}>`).join('\n')
	return `\
    <${toolName}>${!params ? '' : `\n${params}`}
    </${toolName}>`
		.replace('\t', '  ')
}

/* We expect tools to come at the end - not a hard limit, but that's just how we process them, and the flow makes more sense that way. */
export const systemToolsXMLPrompt = (chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined) => {
	const tools = availableTools(chatMode, mcpTools)
	if (!tools || tools.length === 0) return null

	const toolXMLDefinitions = (`\
    可用工具:

    ${toolCallDefinitionsXMLString(tools)}`)

	const toolCallXMLGuidelines = (`\
    工具调用详情:
    - 要调用工具，请使用上面指定的一种 XML 格式编写其名称和参数。
    - 编写工具调用后，你必须停止并等待结果。
    - 除非另有说明，否则所有参数都是必填的。
    - 你只能输出一个工具调用，并且它必须位于你的响应的末尾。
    - 你的工具调用将立即执行，结果将显示在随后的用户消息中。`)

	return `\
    ${toolXMLDefinitions}

    ${toolCallXMLGuidelines}`
}

