/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { tripleTick, MAX_PREFIX_SUFFIX_CHARS } from './constants.js';

// ======================================================== Types ========================================================

export type QuickEditFimTagsType = {
	preTag: string,
	sufTag: string,
	midTag: string
}

// ======================================================== Constants ========================================================

export const defaultQuickEditFimTags: QuickEditFimTagsType = {
	preTag: 'ABOVE',
	sufTag: 'BELOW',
	midTag: 'SELECTION',
}

// ======================================================== Utilities ========================================================

/**
 * Extract prefix and suffix context from a file for quick edit
 */
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

// ======================================================== Prompts ========================================================

/**
 * System message for Ctrl+K quick edit (FIM - Fill in Middle)
 */
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

/**
 * User message for Ctrl+K quick edit (FIM - Fill in Middle)
 */
export const ctrlKStream_userMessage = ({
	selection,
	prefix,
	suffix,
	instructions,
	fimTags,
	language
}: {
	selection: string,
	prefix: string,
	suffix: string,
	instructions: string,
	fimTags: QuickEditFimTagsType,
	language: string,
}) => {
	const { preTag, sufTag, midTag } = fimTags

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
}

