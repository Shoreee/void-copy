/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Flow Editor Prompts for Study Mode
 *
 * These prompts guide the LLM on how to use flow markers in code
 * to create interactive learning experiences.
 */

export const buildFlowEditorPrompts = (): string => {
	const prompts = `
## 心流编码模式 (Flow Editor)

在 study mode 中创建或编辑代码文件时，使用 <<<FLOW:xxx>>> 标记创建交互式学习点。
用户会在编辑器中看到 Ghost Text（灰色预览文字），可以 Tab 接受或自己输入。

### 标记格式

\`\`\`
<<<FLOW:类型 hint="提示" skill="技能" timeout=秒数 default="默认代码" branches=[分支数组]>>>
\`\`\`

**类型说明：**
- \`blank\`: 填空题 - 用户输入代码，系统匹配分支
- \`choice\`: 选择题 - 用户从多个分支中选择
- \`prediction\`: 预测题 - 简单的 Tab 补全

### 分支格式

\`\`\`json
branches=[
  {"trigger":"try", "code":"try {\\n  // code\\n} catch(e) {}"},
  {"trigger":"const", "code":"const result = await fetch(...);"}
]
\`\`\`

- \`trigger\`: 触发词，用户输入以此开头时匹配该分支
- \`code\`: 完整代码，用 \\n 表示换行

### 完整示例

创建一个包含心流点的函数：

\`\`\`typescript
async function fetchUser(id: string): Promise<User> {
<<<FLOW:blank hint="选择错误处理方式：try-catch 还是直接返回？" skill="error-handling" timeout=20 default="return await fetch(\`/users/\${id}\`).then(r => r.json());" branches=[{"trigger":"try", "code":"try {\\n    const res = await fetch(\`/users/\${id}\`);\\n    return await res.json();\\n  } catch (e) {\\n    console.error(e);\\n    throw e;\\n  }"},{"trigger":"const", "code":"const response = await fetch(\`/users/\${id}\`);\\n  return response.json();"}]>>>
}
\`\`\`

### 何时使用心流标记

**必须使用的场景：**
1. 用户首次接触新语法时（类型注解、async/await、泛型等）
2. 涉及设计决策时（错误处理策略、状态管理方式）
3. 核心概念实践时（第一个函数定义、第一个类定义）

**不要使用的场景：**
1. 用户已掌握的技能（检查学习档案）
2. 纯模板代码（import 语句、样板配置）
3. 用户连续超时 3 次后（自动减少交互）

### 难度建议

| 难度 | timeout | 提示详细程度 | 适用场景 |
|-----|---------|------------|---------|
| easy | 10-15s | 详细提示 | 新概念首次出现 |
| medium | 15-25s | 中等提示 | 概念巩固 |
| hard | 20-30s | 简短提示 | 高级应用 |

### 技能分类

常用 skill 值：
- \`type-annotation\` - 类型注解
- \`async-await\` - 异步编程
- \`error-handling\` - 错误处理
- \`state-management\` - 状态管理
- \`component-structure\` - 组件结构
- \`api-design\` - API 设计
- \`data-transformation\` - 数据转换

### 重要提示

1. **不要连续使用过多心流点** - 每个函数/组件最多 2-3 个
2. **触发词要明确** - 使用有意义的关键词（如 try, const, async）
3. **默认代码要合理** - 选择最常用或最安全的实现
4. **提示要简洁** - 一句话说明关键决策点
`;

	return prompts;
};
