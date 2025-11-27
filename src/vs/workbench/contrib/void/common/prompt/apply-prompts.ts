/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { tripleTick, ORIGINAL, DIVIDER, FINAL, searchReplaceBlockTemplate } from './constants.js';

// ======================================================== Search/Replace System Message ========================================================

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

// ======================================================== Rewrite Code Prompts ========================================================

export const rewriteCode_systemMessage = `\
你是一名编码助手，负责重写整个文件以进行更改。你将获得原始文件 \`ORIGINAL_FILE\` 和更改 \`CHANGE\`。

指示：
1. 请重写原始文件 \`ORIGINAL_FILE\`，进行更改 \`CHANGE\`。你必须完全重写整个文件。
2. 尽可能保留所有原始注释、空格、换行符和其他细节。
3. 仅输出完整的新文件。不要添加任何其他解释或文本。
`

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

// ======================================================== Search/Replace Given Description Prompts ========================================================

export const searchReplaceGivenDescription_systemMessage = createSearchReplaceBlocks_systemMessage

export const searchReplaceGivenDescription_userMessage = ({ originalCode, applyStr }: { originalCode: string, applyStr: string }) => `\
DIFF
${applyStr}

ORIGINAL_FILE
${tripleTick[0]}
${originalCode}
${tripleTick[1]}`

