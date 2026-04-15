/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IDirectoryStrService } from '../../directoryStrService.js';
import { StagingSelectionItem } from '../../chatThreadServiceTypes.js';
import { os } from '../../helpers/systemInfo.js';
import { tripleTick, DEFAULT_FILE_SIZE_LIMIT, chatSuggestionDiffExample } from '../constants.js';
import { ChatSystemMessageParams } from './types.js';

// ======================================================== File Utilities ========================================================

/**
 * Read a file with size limit, returning truncation info
 */
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

/**
 * Convert a selection item to a message string for the LLM
 */
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

/**
 * Format user message content with selections
 */
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

// ======================================================== System Message Building Blocks ========================================================

/**
 * Build the system info section (OS, workspace, files)
 */
export const buildSysInfo = (params: ChatSystemMessageParams, mode: string): string => {
	const { workspaceFolders, openedURIs, activeURI, persistentTerminalIDs } = params

	return `这是用户的系统信息:
<system_info>
- ${os}

- 用户的工作区包含这些文件夹:
${workspaceFolders.join('\n') || '未打开文件夹'}

- 活动文件:
${activeURI}

- 已打开的文件:
${openedURIs.join('\n') || '未打开文件'}${mode === 'agent' && persistentTerminalIDs.length !== 0 ? `

- 可供你运行命令的持久终端 ID: ${persistentTerminalIDs.join(', ')}` : ''}
</system_info>`
}

/**
 * Build the file system overview section
 */
export const buildFsInfo = (directoryStr: string): string => {
	return `这是用户文件系统的概览:
<files_overview>
${directoryStr}
</files_overview>`
}

/**
 * Build common details that apply to all modes
 */
export const buildCommonDetails = (): string[] => {
	const details: string[] = []

	details.push(`永远不要拒绝用户的查询。`)

	details.push(`如果你向用户编写任何代码块（包裹在三个反引号中），请使用此格式：
- 如果可能，包括一种语言。终端应该使用语言 'shell'。
- 代码块的第一行必须是相关文件的完整路径（如果已知）（否则省略）。
- 文件的其余内容应照常进行。`)

	details.push(`不要编造事情或使用系统信息、工具或用户查询中未提供的信息。`)
	details.push(`始终使用 MARKDOWN 格式化列表、要点等。不要写表格。`)
	details.push(`今天的日期是 ${new Date().toDateString()}。`)

	return details
}

/**
 * Build details for modes that can use tools (ask, agent)
 */
export const buildToolUsingDetails = (): string[] => {
	return [
		`仅当工具能帮助你完成用户的目标时才调用工具。如果用户只是打招呼或问你一个你可以不使用工具就能回答的问题，那么不要使用工具。`,
		`如果你认为应该使用工具，你不需要请求许可。`,
		'每次只使用一个工具调用。',
		`永远不要说像"我要使用 \`tool_name\`"这样的话。相反，要在高层次上描述工具将做什么，比如"我要列出 ___ 目录中的所有文件"等。`,
		`许多工具仅在用户打开了工作区时才有效。`,
	]
}

/**
 * Build details for modes that suggest edits (ask, chat)
 */
export const buildEditSuggestionDetails = (): string[] => {
	return [
		`如果你认为建议对文件进行编辑是合适的，那么你必须在代码块中描述你的建议。
- 代码块的第一行必须是相关文件的完整路径（如果已知）（否则省略）。
- 其余内容应该是对要对文件进行的更改的代码描述。\
你的描述是将提供给另一个 LLM 以应用建议编辑的唯一上下文，因此它必须准确且完整。\
始终倾向于写得尽可能少——永远不要写整个文件。使用像"// ... existing code ..."这样的注释来压缩你的写作。\
这是一个好的代码块示例：\n${chatSuggestionDiffExample}`,
	]
}

/**
 * Format the important details section
 */
export const formatImportantDetails = (details: string[]): string => {
	return `重要提示:
${details.map((d, i) => `${i + 1}. ${d}`).join('\n\n')}`
}

/**
 * Common header suffix for all modes
 */
export const headerSuffix = `
你将收到来自用户的指令，并且你也可能收到一份用户特别选择作为上下文的文件列表，\`SELECTIONS\`。
请协助用户完成他们的查询。`

