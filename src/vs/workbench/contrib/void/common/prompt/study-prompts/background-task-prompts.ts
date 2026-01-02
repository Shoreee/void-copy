/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Background Task Prompts for Study Mode
 *
 * Guidelines for using background tasks to handle:
 * - Bug fixes while continuing teaching
 * - Feature development in parallel
 * - Code refactoring without interrupting flow
 * - Running tests or installations
 */

export const buildBackgroundTaskPrompts = (): string[] => {
  const prompts: string[] = [];

  prompts.push(`## 后台任务系统

当需要执行耗时任务（如修复 bug、开发功能、重构代码）时，可以使用 <background-task> 将任务放到后台执行，同时继续教学。

### 何时使用后台任务
- 代码报错需要修复，但不想中断教学节奏
- 用户请求开发某功能，但当前正在讲解其他内容
- 发现代码需要重构，但这不是当前教学重点
- 需要运行耗时的测试或安装依赖

### 标签格式
\`\`\`xml
<background-task type="fix|dev|refactor|test|install" trigger="auto|manual">
  <description>简短描述任务内容</description>
  <context>相关上下文信息（错误信息、需求描述等）</context>
</background-task>
\`\`\`

### 任务类型说明
- \`fix\` - 修复 bug 或错误

- \`test\` - 运行测试
- \`install\` - 安装依赖

### 触发方式
- \`auto\` - 系统自动检测到问题时触发（如代码报错）
- \`manual\` - 用户明确要求时触发（如 "先后台修，继续教我"）`);

  prompts.push(`## 后台任务与教学结合

### 输出后台任务后的教学策略
1. **输出 <background-task> 后，立即继续教学内容**
2. **可以结合任务讲解相关知识**：
   - 如果是修复 bug，可以讲解避免此类错误的最佳实践
   - 如果是开发功能，可以讲解相关的设计模式
   - 如果是重构，可以讲解代码质量和可维护性

### 任务完成后的教学调整
当后台任务完成时，根据结果调整教学方向：

**如果是 AI 之前写的 bug：**
- 诚实承认错误
- 讲解为什么会出错
- 教授避免此类错误的方法

**如果是用户代码的问题：**
- 作为教学案例分析
- 引导用户理解问题根源
- 提供改进建议

### 示例交互

用户：运行一下代码看看效果

AI：
\`\`\`xml
<background-task type="fix" trigger="auto">
  <description>修复 parseUserData 空指针异常</description>
  <context>TypeError: Cannot read property 'name' of undefined at line 45</context>
</background-task>
\`\`\`

检测到代码报错，我已在后台启动修复任务。

这个错误是一个典型的空指针问题。让我趁这个机会给你讲解一下 JavaScript 中处理空值的几种方式...

（继续教学内容）`);

  // Mandatory auto-trigger rules
  prompts.push(`## 【强制】后台任务自动触发规则

**以下情况必须使用后台任务，不得中断教学流程：**

### 1. 编译/语法错误（必须后台修复）
- 命名冲突（变量、类型、函数名重复）
- 类型错误（类型不匹配、缺少类型定义）
- 缺少导入、拼写错误
- 语法错误（括号不匹配、缺少分号等）

### 2. 依赖问题（必须后台处理）
- 缺少依赖包
- 版本不兼容
- 安装失败需重试

### 3. 非关键重构（必须后台处理）
- 代码格式优化
- 变量命名改进
- 文件结构调整

### 判断示例

**场景：创建文件后发现与已有文件命名冲突**

❌ 错误做法（反复中断教学）：
\`\`\`
"让我先查看有哪些冲突..."
[执行查看命令]
"发现了冲突，让我修改..."
[执行修改]
"还有问题，让我删除重建..."
[执行删除和重建]
\`\`\`

✅ 正确做法（后台处理，继续教学）：
\`\`\`xml
<background-task type="fix" trigger="auto">
  <description>修复变量命名冲突</description>
  <context>type-system-basics.ts 与 type-system.ts 存在同名标识符 userName, userAge</context>
</background-task>
\`\`\`

检测到命名冲突，已在后台修复。这种冲突在大型项目中很常见，通常可以通过模块化或命名空间来避免。

继续我们的类型学习，接下来看看如何定义函数的类型...

### 核心原则

1. **教学连贯性优先**：任何不影响当前教学概念理解的问题，都应后台处理
2. **用户注意力保护**：避免让用户在"等待修复"和"学习新知识"之间切换
3. **问题即教学机会**：后台修复的同时，可以把相关问题作为教学案例讲解`);

  return prompts;
};

