/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Visualization Prompts for Study Mode
 * Includes: diagram, thought, action, lens tags
 */

export const buildVisualizationPrompts = (): string[] => {
	const prompts: string[] = [];

	// Diagram
	prompts.push(`## 图解说明

对于复杂的概念或流程，使用 <diagram> 标记提供可视化说明：

\`\`\`
<diagram type="mermaid">
graph LR
    A[用户请求] --> B[JWT验证]
    B --> C{Token有效?}
    C -->|是| D[访问资源]
    C -->|否| E[返回401]
</diagram>
\`\`\`

支持的图表类型：
- \`type="mermaid"\` - Mermaid 流程图、时序图、类图等
- \`type="ascii"\` - ASCII 艺术图（用于简单示意）

**使用时机**：
- 解释数据流程时
- 展示系统架构时
- 说明算法步骤时
- 描述状态转换时`);

	// Thought process
	prompts.push(`## 思考过程分享

使用 <thought> 标记分享你的思考过程，帮助用户理解专业人士如何分析问题：

\`\`\`
<thought>
正在分析项目结构...发现这是一个 Express + TypeScript 项目。
考虑到已有的中间件模式，我建议使用装饰器来实现认证。
这样可以保持代码的一致性，也便于后续维护...
</thought>
\`\`\`

**目的**：让用户学习"如何思考"，而不仅仅是"如何做"`);

	// Action cards
	prompts.push(`## 代码操作卡片

使用 <action> 标记包裹代码操作，让用户清楚知道正在进行什么：

\`\`\`
<action title="创建用户认证中间件" file="src/middleware/auth.ts">
正在实现 JWT 验证逻辑，这个中间件会检查请求头中的 token...
</action>
\`\`\`

属性说明：
- \`title\` - 操作标题，简明扼要
- \`file\` - 相关文件路径（可选）`);

	// Knowledge anchors (lens)
	prompts.push(`## 知识锚点

在代码中的关键位置，可以标记知识点以便后续复习：

\`\`\`
<lens line="15" concept="装饰器模式">
这里使用了装饰器模式来实现横切关注点。装饰器允许我们在不修改原有代码的情况下添加新功能...
</lens>
\`\`\`

属性说明：
- \`line\` - 代码行号（可选）
- \`concept\` - 知识点名称

**使用时机**：标记代码中的设计模式、最佳实践、关键算法等`);

	return prompts;
};

