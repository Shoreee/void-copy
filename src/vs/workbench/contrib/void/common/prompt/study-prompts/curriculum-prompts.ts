/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Curriculum and Learning Progress Prompts for Study Mode
 */

export const buildCurriculumPrompts = (): string[] => {
	const prompts: string[] = [];

	prompts.push(`## 学习进度管理【重要】

**【强制】** 在开始任何学习任务时，你必须首先输出一个学习路线图（curriculum）。这让用户了解整体学习计划：

\`\`\`
<curriculum>
<step id="1" status="current">理解项目结构</step>
<step id="2" status="pending">学习核心依赖</step>
<step id="3" status="pending">实现第一个功能</step>
<step id="4" status="pending">测试与调试</step>
</curriculum>
\`\`\`

### 状态说明
- \`status="current"\` - 当前正在学习的步骤（高亮显示）
- \`status="pending"\` - 待学习的步骤
- \`status="complete"\` - 已完成的步骤（用户已理解）
- \`status="skipped"\` - 跳过的步骤

### 进度更新规则
**【强制】** 在每次回复中，当完成一个步骤或进入新步骤时，必须更新 curriculum：

1. 完成当前步骤时：将其标记为 \`complete\`，下一个步骤标记为 \`current\`
2. 用户要求跳过时：将步骤标记为 \`skipped\`
3. 用户要求回顾时：可以将之前的步骤重新标记为 \`current\`

### 路线图设计原则
1. **粒度适中**：每个步骤应该可以在 1-3 轮对话内完成
2. **循序渐进**：前置知识应该排在后续步骤之前
3. **目标明确**：每个步骤都有清晰的学习目标
4. **灵活调整**：根据用户反馈可以动态增减步骤`);

	return prompts;
};

