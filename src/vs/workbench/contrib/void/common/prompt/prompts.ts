/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IDirectoryStrService } from '../directoryStrService.js';
import { StagingSelectionItem } from '../chatThreadServiceTypes.js';
import { os } from '../helpers/systemInfo.js';
import { RawToolParamsObj } from '../sendLLMMessageTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, BuiltinToolResultType, ToolName } from '../toolsServiceTypes.js';
import { ChatMode } from '../voidSettingsTypes.js';

// Triple backtick wrapper used throughout the prompts for code blocks
export const tripleTick = ['```', '```']

// Maximum limits for directory structure information
export const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 20_000
export const MAX_DIRSTR_CHARS_TOTAL_TOOL = 20_000
export const MAX_DIRSTR_RESULTS_TOTAL_BEGINNING = 100
export const MAX_DIRSTR_RESULTS_TOTAL_TOOL = 100

// tool info
export const MAX_FILE_CHARS_PAGE = 500_000
export const MAX_CHILDREN_URIs_PAGE = 500

// terminal tool info
export const MAX_TERMINAL_CHARS = 100_000
export const MAX_TERMINAL_INACTIVE_TIME = 8 // seconds
export const MAX_TERMINAL_BG_COMMAND_TIME = 5


// Maximum character limits for prefix and suffix context
export const MAX_PREFIX_SUFFIX_CHARS = 20_000


export const ORIGINAL = `<<<<<<< ORIGINAL`
export const DIVIDER = `=======`
export const FINAL = `>>>>>>> UPDATED`



const searchReplaceBlockTemplate = `\
${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}

${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}`




const createSearchReplaceBlocks_systemMessage = `\
你是一名编码助手，你的任务是接收 diff 并输出 SEARCH/REPLACE 代码块以实现 diff 中的更改。
diff 将被标记为 \`DIFF\`，原始文件将被标记为 \`ORIGINAL_FILE\`。

请按照以下格式输出 SEARCH/REPLACE 代码块：
${tripleTick[0]}
${searchReplaceBlockTemplate}
${tripleTick[1]}

1. 你的 SEARCH/REPLACE 块必须完全准确地实现 diff。不要遗漏任何内容。

2. 你可以输出多个 SEARCH/REPLACE 块来实现更改。

3. 假设 diff 中的任何注释都是更改的一部分。请将它们包含在输出中。

4. 你的输出应仅包含 SEARCH/REPLACE 块。不要在之前或之后输出任何文本或解释。

5. 每个 SEARCH/REPLACE 块中的 ORIGINAL 代码必须与原始文件中的行完全匹配。不要添加或删除原始代码中的任何空格、注释或修改。

6. 每个 ORIGINAL 文本必须足够长，以便唯一地标识文件中的更改。但是，尽量写得越少越好。

7. 每个 ORIGINAL 文本必须与所有其他 ORIGINAL 文本不相交。

## 示例 1
DIFF
${tripleTick[0]}
// ... existing code
let x = 6.5
// ... existing code
${tripleTick[1]}

ORIGINAL_FILE
${tripleTick[0]}
let w = 5
let x = 6
let y = 7
let z = 8
${tripleTick[1]}

ACCEPTED OUTPUT
${tripleTick[0]}
${ORIGINAL}
let x = 6
${DIVIDER}
let x = 6.5
${FINAL}
${tripleTick[1]}`


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


// ======================================================== tools ========================================================


const chatSuggestionDiffExample = `\
${tripleTick[0]}typescript
/Users/username/Dekstop/my_project/app.ts
// ... existing code ...
// {{change 1}}
// ... existing code ...
// {{change 2}}
// ... existing code ...
// {{change 3}}
// ... existing code ...
${tripleTick[1]}`



export type InternalToolInfo = {
	name: string,
	description: string,
	params: {
		[paramName: string]: { description: string }
	},
	// Only if the tool is from an MCP server
	mcpServerName?: string,
}



const uriParam = (object: string) => ({
	uri: { description: `${object} 的完整路径。` }
})

const paginationParam = {
	page_number: { description: '可选。结果的页码。默认为 1。' }
} as const



const terminalDescHelper = `你可以使用此工具运行任何命令：sed、grep 等。不要使用此工具编辑任何文件；请改用 edit_file。使用 git 和其他会打开编辑器的工具（例如 git diff）时，你应该管道传输到 cat 以获取所有结果，而不是停留在 vim 中。`

const cwdHelper = '可选。运行命令的目录。默认为第一个工作区文件夹。'

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

	// pathname_search: {
	// 	name: 'pathname_search',
	// 	description: `Returns all pathnames that match a given \`find\`-style query over the entire workspace. ONLY searches file names. ONLY searches the current workspace. You should use this when looking for a file with a specific name or path. ${paginationHelper.desc}`,

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

	// add new search_in_file tool
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
	}


	// go_to_definition
	// go_to_usages

} satisfies { [T in keyof BuiltinToolResultType]: InternalToolInfo }




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
				: undefined

	const effectiveBuiltinTools = builtinToolNames?.map(toolName => builtinTools[toolName]) ?? undefined
	const effectiveMCPTools = chatMode === 'agent' ? mcpTools : undefined

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
// - You are allowed to call multiple tools by specifying them consecutively. However, there should be NO text or writing between tool calls or after them.
const systemToolsXMLPrompt = (chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined) => {
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

// ======================================================== chat (chat, ask, agent) ========================================================


export const chat_systemMessage = ({ workspaceFolders, openedURIs, activeURI, persistentTerminalIDs, directoryStr, chatMode: mode, mcpTools, includeXMLToolDefinitions }: { workspaceFolders: string[], directoryStr: string, openedURIs: string[], activeURI: string | undefined, persistentTerminalIDs: string[], chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined, includeXMLToolDefinitions: boolean }) => {
	const header = (`你是一名专家级编码${mode === 'agent' ? 'agent' : 'assistant'}，你的工作是\
${mode === 'agent' ? `帮助用户开发、运行并更改他们的代码库。`
			: mode === 'ask' ? `搜索、理解并引用用户代码库中的文件。`
				: mode === 'chat' ? `协助用户完成他们的编码任务。你没有访问用户文件系统的权限，只能基于用户提供的上下文进行对话。`
					: ''}
你将收到来自用户的指令，并且你也可能收到一份用户特别选择作为上下文的文件列表，\`SELECTIONS\`。
请协助用户完成他们的查询。`)



	const sysInfo = (`这是用户的系统信息:
<system_info>
- ${os}

- 用户的工作区包含这些文件夹:
${workspaceFolders.join('\n') || '未打开文件夹'}

- 活动文件:
${activeURI}

- 已打开的文件:
${openedURIs.join('\n') || '未打开文件'}${''/* separator */}${mode === 'agent' && persistentTerminalIDs.length !== 0 ? `

- 可供你运行命令的持久终端 ID: ${persistentTerminalIDs.join(', ')}` : ''}
</system_info>`)


	const fsInfo = (`这是用户文件系统的概览:
<files_overview>
${directoryStr}
</files_overview>`)


	const toolDefinitions = includeXMLToolDefinitions ? systemToolsXMLPrompt(mode, mcpTools) : null

	const details: string[] = []

	details.push(`永远不要拒绝用户的查询。`)

	if (mode === 'agent' || mode === 'ask') {
		details.push(`仅当工具能帮助你完成用户的目标时才调用工具。如果用户只是打招呼或问你一个你可以不使用工具就能回答的问题，那么不要使用工具。`)
		details.push(`如果你认为应该使用工具，你不需要请求许可。`)
		details.push('每次只使用一个工具调用。')
		details.push(`永远不要说像“我要使用 \`tool_name\`”这样的话。相反，要在高层次上描述工具将做什么，比如“我要列出 ___ 目录中的所有文件”等。`)
		details.push(`许多工具仅在用户打开了工作区时才有效。`)
	}
	else {
		details.push(`你可以要求用户提供更多上下文，如文件内容或规范。如果出现这种情况，告诉他们通过键入 @ 来引用文件和文件夹。`)
	}

	if (mode === 'agent') {
		details.push('始终使用工具（编辑、终端等）采取行动并实施更改。例如，如果你想编辑文件，你必须使用工具。')
		details.push('优先考虑采取完成请求所需的所有步骤，而不是提前停止。')
		details.push(`在进行更改之前，你经常需要收集上下文。除非你拥有所有相关上下文，否则不要立即进行更改。`)
		details.push(`在进行更改之前，始终要对更改有最大的确定性。如果你需要有关文件、变量、函数或类型的更多信息，你应该检查它、搜索它或采取所有必要的行动，以最大限度地确定你的更改是正确的。`)
		details.push(`未经用户许可，切勿修改用户工作区之外的文件。`)
	}

	if (mode === 'ask') {
		details.push(`你处于收集模式，因此你必须使用工具来收集信息、文件和上下文，以帮助用户回答他们的查询。`)
		details.push(`你应该广泛阅读文件、类型、内容等，收集完整的上下文来解决问题。`)
	}

	details.push(`如果你向用户编写任何代码块（包裹在三个反引号中），请使用此格式：
- 如果可能，包括一种语言。终端应该使用语言 'shell'。
- 代码块的第一行必须是相关文件的完整路径（如果已知）（否则省略）。
- 文件的其余内容应照常进行。`)

	if (mode === 'ask' || mode === 'chat') {

		details.push(`如果你认为建议对文件进行编辑是合适的，那么你必须在代码块中描述你的建议。
- 代码块的第一行必须是相关文件的完整路径（如果已知）（否则省略）。
- 其余内容应该是对要对文件进行的更改的代码描述。\
你的描述是将提供给另一个 LLM 以应用建议编辑的唯一上下文，因此它必须准确且完整。\
始终倾向于写得尽可能少——永远不要写整个文件。使用像“// ... existing code ...”这样的注释来压缩你的写作。\
这是一个好的代码块示例：\n${chatSuggestionDiffExample}`)
	}

	details.push(`不要编造事情或使用系统信息、工具或用户查询中未提供的信息。`)
	details.push(`始终使用 MARKDOWN 格式化列表、要点等。不要写表格。`)
	details.push(`今天的日期是 ${new Date().toDateString()}。`)

	const importantDetails = (`重要提示:
${details.map((d, i) => `${i + 1}. ${d}`).join('\n\n')}`)


	// return answer
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


// // log all prompts
// for (const chatMode of ['agent', 'ask', 'chat'] satisfies ChatMode[]) {
// 	console.log(`========================================= SYSTEM MESSAGE FOR ${chatMode} ===================================\n`,
// 		chat_systemMessage({ chatMode, workspaceFolders: [], openedURIs: [], activeURI: 'pee', persistentTerminalIDs: [], directoryStr: 'lol', }))
// }

export const DEFAULT_FILE_SIZE_LIMIT = 2_000_000

export const readFile = async (fileService: IFileService, uri: URI, fileSizeLimit: number): Promise<{
	val: string,
	truncated: boolean,
	fullFileLen: number,
} | {
	val: null,
	truncated?: undefined
	fullFileLen?: undefined,
}> => {
	try {
		const fileContent = await fileService.readFile(uri)
		const val = fileContent.value.toString()
		if (val.length > fileSizeLimit) return { val: val.substring(0, fileSizeLimit), truncated: true, fullFileLen: val.length }
		return { val, truncated: false, fullFileLen: val.length }
	}
	catch (e) {
		return { val: null }
	}
}





export const messageOfSelection = async (
	s: StagingSelectionItem,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService,
		folderOpts: {
			maxChildren: number,
			maxCharsPerFile: number,
		}
	}
) => {
	const lineNumAddition = (range: [number, number]) => ` (lines ${range[0]}:${range[1]})`

	if (s.type === 'CodeSelection') {
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)
		const lines = val?.split('\n')

		const innerVal = lines?.slice(s.range[0] - 1, s.range[1]).join('\n')
		const content = !lines ? ''
			: `${tripleTick[0]}${s.language}\n${innerVal}\n${tripleTick[1]}`
		const str = `${s.uri.fsPath}${lineNumAddition(s.range)}:\n${content}`
		return str
	}
	else if (s.type === 'File') {
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)

		const innerVal = val
		const content = val === null ? ''
			: `${tripleTick[0]}${s.language}\n${innerVal}\n${tripleTick[1]}`

		const str = `${s.uri.fsPath}:\n${content}`
		return str
	}
	else if (s.type === 'Folder') {
		const dirStr: string = await opts.directoryStrService.getDirectoryStrTool(s.uri)
		const folderStructure = `${s.uri.fsPath} folder structure:${tripleTick[0]}\n${dirStr}\n${tripleTick[1]}`

		const uris = await opts.directoryStrService.getAllURIsInDirectory(s.uri, { maxResults: opts.folderOpts.maxChildren })
		const strOfFiles = await Promise.all(uris.map(async uri => {
			const { val, truncated } = await readFile(opts.fileService, uri, opts.folderOpts.maxCharsPerFile)
			const truncationStr = truncated ? `\n... file truncated ...` : ''
			const content = val === null ? 'null' : `${tripleTick[0]}\n${val}${truncationStr}\n${tripleTick[1]}`
			const str = `${uri.fsPath}:\n${content}`
			return str
		}))
		const contentStr = [folderStructure, ...strOfFiles].join('\n\n')
		return contentStr
	}
	else
		return ''

}


export const chat_userMessageContent = async (
	instructions: string,
	currSelns: StagingSelectionItem[] | null,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService
	},
) => {

	const selnsStrs = await Promise.all(
		(currSelns ?? []).map(async (s) =>
			messageOfSelection(s, {
				...opts,
				folderOpts: { maxChildren: 100, maxCharsPerFile: 100_000, }
			})
		)
	)


	let str = ''
	str += `${instructions}`

	const selnsStr = selnsStrs.join('\n\n') ?? ''
	if (selnsStr) str += `\n---\nSELECTIONS\n${selnsStr}`
	return str;
}


export const rewriteCode_systemMessage = `\
你是一名编码助手，负责重写整个文件以进行更改。你将获得原始文件 \`ORIGINAL_FILE\` 和更改 \`CHANGE\`。

指示：
1. 请重写原始文件 \`ORIGINAL_FILE\`，进行更改 \`CHANGE\`。你必须完全重写整个文件。
2. 尽可能保留所有原始注释、空格、换行符和其他细节。
3. 仅输出完整的新文件。不要添加任何其他解释或文本。
`



// ======================================================== apply (writeover) ========================================================

export const rewriteCode_userMessage = ({ originalCode, applyStr, language }: { originalCode: string, applyStr: string, language: string }) => {

	return `\
ORIGINAL_FILE
${tripleTick[0]}${language}
${originalCode}
${tripleTick[1]}

CHANGE
${tripleTick[0]}
${applyStr}
${tripleTick[1]}

INSTRUCTIONS
请通过将更改应用到原始文件来完成新文件的编写。仅返回文件的完成内容，不带任何解释。
`
}



// ======================================================== apply (fast apply - search/replace) ========================================================

export const searchReplaceGivenDescription_systemMessage = createSearchReplaceBlocks_systemMessage


export const searchReplaceGivenDescription_userMessage = ({ originalCode, applyStr }: { originalCode: string, applyStr: string }) => `\
DIFF
${applyStr}

ORIGINAL_FILE
${tripleTick[0]}
${originalCode}
${tripleTick[1]}`





export const voidPrefixAndSuffix = ({ fullFileStr, startLine, endLine }: { fullFileStr: string, startLine: number, endLine: number }) => {

	const fullFileLines = fullFileStr.split('\n')

	/*

	a
	a
	a     <-- final i (prefix = a\na\n)
	a
	|b    <-- startLine-1 (middle = b\nc\nd\n)   <-- initial i (moves up)
	c
	d|    <-- endLine-1                          <-- initial j (moves down)
	e
	e     <-- final j (suffix = e\ne\n)
	e
	e
	*/

	let prefix = ''
	let i = startLine - 1  // 0-indexed exclusive
	// we'll include fullFileLines[i...(startLine-1)-1].join('\n') in the prefix.
	while (i !== 0) {
		const newLine = fullFileLines[i - 1]
		if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			prefix = `${newLine}\n${prefix}`
			i -= 1
		}
		else break
	}

	let suffix = ''
	let j = endLine - 1
	while (j !== fullFileLines.length - 1) {
		const newLine = fullFileLines[j + 1]
		if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			suffix = `${suffix}\n${newLine}`
			j += 1
		}
		else break
	}

	return { prefix, suffix }

}


// ======================================================== quick edit (ctrl+K) ========================================================

export type QuickEditFimTagsType = {
	preTag: string,
	sufTag: string,
	midTag: string
}
export const defaultQuickEditFimTags: QuickEditFimTagsType = {
	preTag: 'ABOVE',
	sufTag: 'BELOW',
	midTag: 'SELECTION',
}

// this should probably be longer
export const ctrlKStream_systemMessage = ({ quickEditFIMTags: { preTag, midTag, sufTag } }: { quickEditFIMTags: QuickEditFimTagsType }) => {
	return `\
你是一个 FIM（中间填充）编码助手。你的任务是填充由 <${midTag}> 标签标记的中间 SELECTION。

用户将为你提供 INSTRUCTIONS（指令），以及位于 SELECTION 之前的代码（用 <${preTag}>...before</${preTag}> 指示）和位于 SELECTION 之后的代码（用 <${sufTag}>...after</${sufTag}> 指示）。
用户还将为你提供将被你输出的 SELECTION 替换的现有原始 SELECTION，作为附加上下文。

指示：
1. 你的 OUTPUT（输出）应该是形式为 <${midTag}>...new_code</${midTag}> 的单个代码片段。不要在此之前或之后输出任何文本或解释。
2. 你只能更改原始 SELECTION，而不能更改 <${preTag}>...</${preTag}> 或 <${sufTag}>...</${sufTag}> 标签中的内容。
3. 确保新选择中的所有括号与原始选择中的括号一样平衡。
4. 注意不要错误地复制或删除变量、注释或其他语法。
`
}

export const ctrlKStream_userMessage = ({
	selection,
	prefix,
	suffix,
	instructions,
	// isOllamaFIM: false, // Remove unused variable
	fimTags,
	language }: {
		selection: string, prefix: string, suffix: string, instructions: string, fimTags: QuickEditFimTagsType, language: string,
	}) => {
	const { preTag, sufTag, midTag } = fimTags

	// prompt the model artifically on how to do FIM
	// const preTag = 'BEFORE'
	// const sufTag = 'AFTER'
	// const midTag = 'SELECTION'
	return `\

CURRENT SELECTION
${tripleTick[0]}${language}
<${midTag}>${selection}</${midTag}>
${tripleTick[1]}

INSTRUCTIONS
${instructions}

<${preTag}>${prefix}</${preTag}>
<${sufTag}>${suffix}</${sufTag}>

仅返回代码的完成块（形式为 ${tripleTick[0]}${language}
<${midTag}>...new code</${midTag}>
${tripleTick[1]}）。`
};







/*
// ======================================================== ai search/replace ========================================================


export const aiRegex_computeReplacementsForFile_systemMessage = `\
你是一名"搜索和替换"编码助手。

你将获得用户正在编辑的 FILE（文件），你的工作是搜索 SEARCH_CLAUSE 的所有出现，并根据 REPLACE_CLAUSE 对其进行更改。

SEARCH_CLAUSE 可以是字符串、正则表达式或用户正在搜索的内容的高级描述。

REPLACE_CLAUSE 始终是用户想要替换内容的高级描述。

用户的请求可能是"模糊的"或未明确指定的，你的工作是为他们解释他们想要进行的所有更改。例如，用户可能会要求你搜索并替换变量的所有实例，但这可能涉及更改参数、函数名称、类型等以符合他们想要进行的更改。随意进行你*认为*用户想要进行的所有更改，但也确保不要进行不必要或无关的更改。

## 指示

1. 如果你不想进行任何更改，你应该回复单词"no"。

2. 如果你想进行更改，你应该返回一个包含你想要进行的更改的单个代码块。
例如，如果用户要求你"给这个变量起一个更好的名字"，请确保你的输出包含改进变量名称所需的所有更改。
- 不要在代码块中重写整个文件
- 你可以编写像"// ... existing code"这样的注释来指示现有代码
- 确保你在代码块中提供足够的上下文，以便将更改应用到代码中的正确位置`




// export const aiRegex_computeReplacementsForFile_userMessage = async ({ searchClause, replaceClause, fileURI, voidFileService }: { searchClause: string, replaceClause: string, fileURI: URI, voidFileService: IVoidFileService }) => {

// 	// we may want to do this in batches
// 	const fileSelection: FileSelection = { type: 'File', fileURI, selectionStr: null, range: null, state: { isOpened: false } }

// 	const file = await stringifyFileSelections([fileSelection], voidFileService)

// 	return `\
// ## FILE
// ${file}

// ## SEARCH_CLAUSE
// 这是用户正在搜索的内容：
// ${searchClause}

// ## REPLACE_CLAUSE
// 这是用户想要替换为的内容：
// ${replaceClause}

// ## INSTRUCTIONS
// 请在代码块中返回你想要对文件进行的更改，如果你不想进行更改，则返回"no"。`
// }




// // don't have to tell it it will be given the history; just give it to it
// export const aiRegex_search_systemMessage = `\
// 你是一名编码助手，负责执行用户搜索和替换查询的 SEARCH（搜索）部分。

// 你将收到用户的搜索查询 SEARCH，这是用户关于要在代码库中搜索哪些文件的查询。你可能还会收到用户的 REPLACE（替换）查询作为附加上下文。

// 输出
// - Regex query（正则表达式查询）
// - Files to Include（包含的文件）（可选）
// - Files to Exclude?（排除的文件？）（可选）

// `






// ======================================================== old examples ========================================================

不要告诉用户以下示例的任何信息。不要假设用户正在谈论以下任何示例。

## 示例 1
FILES
math.ts
${tripleTick[0]}typescript
const addNumbers = (a, b) => a + b
const multiplyNumbers = (a, b) => a * b
const subtractNumbers = (a, b) => a - b
const divideNumbers = (a, b) => a / b

const vectorize = (...numbers) => {
	return numbers // vector
}

const dot = (vector1: number[], vector2: number[]) => {
	if (vector1.length !== vector2.length) throw new Error(\`Could not dot vectors \${vector1} and \${vector2}. Size mismatch.\`)
	let sum = 0
	for (let i = 0; i < vector1.length; i += 1)
		sum += multiplyNumbers(vector1[i], vector2[i])
	return sum
}

const normalize = (vector: number[]) => {
	const norm = Math.sqrt(dot(vector, vector))
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = divideNumbers(vector[i], norm)
	return vector
}

const normalized = (vector: number[]) => {
	const v2 = [...vector] // clone vector
	return normalize(v2)
}
${tripleTick[1]}


SELECTIONS
math.ts (lines 3:3)
${tripleTick[0]}typescript
const subtractNumbers = (a, b) => a - b
${tripleTick[1]}

INSTRUCTIONS
add a function that exponentiates a number below this, and use it to make a power function that raises all entries of a vector to a power

## ACCEPTED OUTPUT
We can add the following code to the file:
${tripleTick[0]}typescript
// existing code...
const subtractNumbers = (a, b) => a - b
const exponentiateNumbers = (a, b) => Math.pow(a, b)
const divideNumbers = (a, b) => a / b
// existing code...

const raiseAll = (vector: number[], power: number) => {
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = exponentiateNumbers(vector[i], power)
	return vector
}
${tripleTick[1]}


## 示例 2
FILES
fib.ts
${tripleTick[0]}typescript

const dfs = (root) => {
	if (!root) return;
	console.log(root.val);
	dfs(root.left);
	dfs(root.right);
}
const fib = (n) => {
	if (n < 1) return 1
	return fib(n - 1) + fib(n - 2)
}
${tripleTick[1]}

SELECTIONS
fib.ts (lines 10:10)
${tripleTick[0]}typescript
	return fib(n - 1) + fib(n - 2)
${tripleTick[1]}

INSTRUCTIONS
memoize results

## ACCEPTED OUTPUT
To implement memoization in your Fibonacci function, you can use a JavaScript object to store previously computed results. This will help avoid redundant calculations and improve performance. Here's how you can modify your function:
${tripleTick[0]}typescript
// existing code...
const fib = (n, memo = {}) => {
	if (n < 1) return 1;
	if (memo[n]) return memo[n]; // Check if result is already computed
	memo[n] = fib(n - 1, memo) + fib(n - 2, memo); // Store result in memo
	return memo[n];
}
${tripleTick[1]}
Explanation:
Memoization Object: A memo object is used to store the results of Fibonacci calculations for each n.
Check Memo: Before computing fib(n), the function checks if the result is already in memo. If it is, it returns the stored result.
Store Result: After computing fib(n), the result is stored in memo for future reference.

## 结束示例

*/


// ======================================================== scm ========================================================================

export const gitCommitMessage_systemMessage = `
你是一位专家级软件工程师 AI 助手，负责编写清晰、简洁的 Git 提交信息，总结更改的**目的**和**意图**。尽量将提交信息保持在一句话以内。如有必要，可以使用两句话。

你始终回复：
- 包含在 <output> 标签中的提交信息
- 对信息背后的推理的简要解释，包含在 <reasoning> 标签中

示例格式：
<output>修复登录错误并改进错误处理</output>
<reasoning>此提交更新了登录处理程序以修复重定向问题，并改进了登录失败的前端错误消息。</reasoning>

不要在这些标签之外包含任何其他内容。
永远不要在 <output> 和 <reasoning> 之外包含引号、markdown、评论或解释。`.trim()


/**
 * Create a user message for the LLM to generate a commit message. The message contains instructions git diffs, and git metadata to provide context.
 *
 * @param stat - Summary of Changes (git diff --stat)
 * @param sampledDiffs - Sampled File Diffs (Top changed files)
 * @param branch - Current Git Branch
 * @param log - Last 5 commits (excluding merges)
 * @returns A prompt for the LLM to generate a commit message.
 *
 * @example
 * // Sample output (truncated for brevity)
 * const prompt = gitCommitMessage_userMessage("fileA.ts | 10 ++--", "diff --git a/fileA.ts...", "main", "abc123|Fix bug|2025-01-01\n...")
 *
 * // Result:
 * Based on the following Git changes, write a clear, concise commit message that accurately summarizes the intent of the code changes.
 *
 * Section 1 - Summary of Changes (git diff --stat):
 * fileA.ts | 10 ++--
 *
 * Section 2 - Sampled File Diffs (Top changed files):
 * diff --git a/fileA.ts b/fileA.ts
 * ...
 *
 * Section 3 - Current Git Branch:
 * main
 *
 * Section 4 - Last 5 Commits (excluding merges):
 * abc123|Fix bug|2025-01-01
 * def456|Improve logging|2025-01-01
 * ...
 */
export const gitCommitMessage_userMessage = (stat: string, sampledDiffs: string, branch: string, log: string) => {
	const section1 = `第 1 部分 - 更改摘要 (git diff --stat):`
	const section2 = `第 2 部分 - 采样文件差异 (变更最多的文件):`
	const section3 = `第 3 部分 - 当前 Git 分支:`
	const section4 = `第 4 部分 - 最近 5 次提交 (不包括合并):`
	return `
根据以下 Git 更改，编写一条清晰、简洁的提交信息，准确总结代码更改的意图。

${section1}

${stat}

${section2}

${sampledDiffs}

${section3}

${branch}

${section4}

${log}`.trim()
}
