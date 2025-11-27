/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// ======================================================== Git Commit Message Prompts ========================================================

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

