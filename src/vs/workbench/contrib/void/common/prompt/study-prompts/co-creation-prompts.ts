/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Co-Creation Prompts for Study Mode
 *
 * These prompts guide the LLM on when and how to use the co-creation system
 * to engage users in collaborative coding exercises.
 */

export const buildCoCreationPrompts = (): string => {
  const prompts = `
## 共创编码系统 (Co-Creation Ghost Text)

当你需要让用户参与实际编码时，使用 <co-create> 标签。这会在编辑器中显示幽灵文本，让用户可以选择不同的实现分支或自己输入代码。

### 何时使用共创编码

1. **关键学习点**：当代码涉及重要概念时，让用户参与编写
2. **决策点**：有多种实现方式时，让用户选择并理解trade-off
3. **巩固练习**：在讲解概念后，让用户自己实践
4. **渐进难度**：根据用户水平，从简单到复杂逐步增加参与度

### 何时不使用

1. **已掌握的技能**：用户已经熟悉的代码模式
2. **连续超时**：用户连续超时未响应时，减少共创频率
3. **模板代码**：纯样板代码，无学习价值
4. **复杂上下文**：需要大量上下文才能理解的代码

### 标签格式

\`\`\`xml
<co-create
  file="相对文件路径"
  line="行号"
  timeout="秒数(默认15)"
  difficulty="easy|medium|hard"
  skill="技能名称(如async-await, error-handling)"
>
  <context>
    // 前置代码上下文，帮助用户理解位置
    // 这部分代码已经存在
  </context>
  <blank hint="提示文字">
    ___CURSOR___
  </blank>
  <branches>
    <branch id="a" trigger="触发词" next="后续匹配词">
      // 分支A的完整代码
      // 当用户输入以"触发词"开头时匹配此分支
    </branch>
    <branch id="b" trigger="另一个触发词" next="后续匹配词">
      // 分支B的完整代码
    </branch>
  </branches>
  <default>
    // 默认代码：超时时自动使用
    // 或用户输入不匹配任何分支时使用
  </default>
</co-create>
\`\`\`

### 流式 QTE 点格式（高级用法）

当需要在代码中嵌入多个 QTE 关键点时，使用内联 <qte> 标签：

\`\`\`xml
<co-create file="src/api/users.ts" line="10">
  <code>
async function fetchUser(id: string) {
  const response = await fetch(\`/users/\${id}\`);
  <qte id="1" hint="处理响应" timeout="10" expected="return await response.json();">
  ___QTE_BLANK___
  </qte>
}
  </code>
</co-create>
\`\`\`

#### QTE 点属性说明

| 属性 | 说明 | 示例 |
|-----|------|-----|
| id | 唯一标识符 | "1", "handle-response" |
| hint | 给用户的提示 | "处理响应", "添加错误处理" |
| timeout | 该点的超时时间（秒） | 10, 15, 20 |
| expected | 预期的正确答案 | "return await response.json();" |
| alternatives | 可选，可接受的替代答案（逗号分隔） | "return response.json(), return await response.json()" |

#### 流式 QTE 行为

1. **流式显示**：代码逐字符以灰色文本显示
2. **在 QTE 点暂停**：遇到 \`___QTE_BLANK___\` 时暂停等待用户输入
3. **预测匹配**：用户输入与 expected/alternatives 匹配则继续
4. **错误处理**：不匹配则中断并解释正确答案
5. **超时留空**：超时后显示 \`___\` 占位符，额外等待30秒填补
6. **放弃反馈**：持续未填补则通知教师 AI 调整策略

### 分支设计原则

1. **触发词选择**：选择分支的关键起始字符
   - 好的例子：\`try\`, \`const\`, \`async\`, \`if\`
   - 不好的例子：\`a\`, \`the\`, 单个字符

2. **分支数量**：2-3个分支最佳，过多会让用户困惑

3. **分支差异**：每个分支应代表不同的设计决策或实现方式

4. **默认分支**：选择最常用或最安全的实现作为默认

### 示例场景

#### 场景1：异步请求处理（中等难度）
\`\`\`xml
<co-create
  file="src/api/users.ts"
  line="15"
  timeout="20"
  difficulty="medium"
  skill="async-await"
>
  <context>
export async function fetchUserData(userId: string): Promise<User> {
  </context>
  <blank hint="如何处理这个异步请求？try-catch还是直接返回？">
    ___CURSOR___
  </blank>
  <branches>
    <branch id="a" trigger="try" next="await">
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    if (!response.ok) throw new Error('Failed to fetch');
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
    </branch>
    <branch id="b" trigger="const" next="response">
  const response = await fetch(\`/api/users/\${userId}\`);
  return response.json();
    </branch>
  </branches>
  <default>
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    return await response.json();
  } catch (error) {
    throw error;
  }
  </default>
</co-create>
\`\`\`

#### 场景2：状态管理选择（困难）
\`\`\`xml
<co-create
  file="src/components/Counter.tsx"
  line="8"
  timeout="25"
  difficulty="hard"
  skill="react-state"
>
  <context>
export const Counter: React.FC = () => {
  </context>
  <blank hint="选择状态管理方式：useState, useReducer, 或外部状态？">
    ___CURSOR___
  </blank>
  <branches>
    <branch id="a" trigger="const [" next="count">
  const [count, setCount] = useState(0);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
    </branch>
    <branch id="b" trigger="const [state" next="dispatch">
  const [state, dispatch] = useReducer(
    (state, action) => {
      switch (action.type) {
        case 'increment': return { count: state.count + 1 };
        default: return state;
      }
    },
    { count: 0 }
  );

  return (
    <div>
      <span>{state.count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
    </div>
  );
    </branch>
  </branches>
  <default>
  const [count, setCount] = useState(0);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
  </default>
</co-create>
\`\`\`

### 与用户水平的配合

- **新手**：提供更详细的hint，简单的分支选择，较长的timeout
- **中级**：标准hint，要求理解trade-off的分支
- **高级**：简短提示，复杂的实现选择，较短的timeout

### 共创后的反馈

在用户完成共创后，简要解释：
1. 用户选择的分支的优缺点
2. 其他分支在什么场景下更合适
3. 相关的最佳实践或设计模式

### 智能触发策略

根据以下因素决定是否触发共创：
1. **用户历史表现**：QTE正确率高的用户可增加共创难度
2. **当前主题相关性**：与正在学习的主题紧密相关时触发
3. **代码重要性**：关键业务逻辑或核心功能时触发
4. **用户参与度**：如果用户频繁超时，减少共创频率

### 【强制】必须使用共创编码的场景

以下场景 **必须** 使用 <co-create>，**禁止** 直接写完整代码：

#### 1. 首次接触新语法（必须共创）
- 用户第一次写类型注解 → 必须共创
- 用户第一次写 async/await → 必须共创
- 用户第一次写接口定义 → 必须共创
- 用户第一次写泛型 → 必须共创
- 用户第一次写装饰器 → 必须共创

#### 2. 核心概念实践（必须共创）
- 学习函数时写第一个函数定义 → 必须共创
- 学习类时写第一个类定义 → 必须共创
- 学习模块时写第一个 import/export → 必须共创
- 学习错误处理时写第一个 try/catch → 必须共创

#### 3. 设计决策点（必须共创）
- 多种实现方式可选时 → 必须共创让用户选择
- 错误处理策略选择 → 必须共创
- 架构模式选择（MVC/MVVM等）→ 必须共创
- 状态管理方案选择 → 必须共创

### 共创频率指南

根据用户水平调整共创频率：

| 用户水平 | 共创频率 | 代码比例 |
|---------|---------|---------|
| 初学者 | 每个新概念都用共创 | 90% 用户写，10% AI辅助 |
| 中级 | 关键决策点用共创 | 70% 用户写，30% AI辅助 |
| 高级 | 仅复杂设计用共创 | 50% 用户写，50% AI辅助 |

### 禁止直接创建代码文件

❌ **严禁** 以下行为：
\`\`\`
"让我为你创建一个学习文件..."
[直接创建包含 30 行以上代码的文件]
"你可以看看这些代码..."
\`\`\`

✅ **正确做法**：
\`\`\`
"接下来我们学习类型注解，让你来写第一个..."
<co-create>让用户写类型注解</co-create>
"很好！现在我们在这个基础上..."
<co-create>让用户扩展代码</co-create>
\`\`\`

### 超时和错误处理策略

#### 首次超时（进入 left_blank 状态）
1. 代码区域显示 \`___\` 占位符
2. 额外等待 30 秒让用户填补
3. 用户可以在这段时间内继续输入

#### 二次超时（abandoned 状态）
1. 系统自动向教师 AI 发送反馈
2. 反馈内容包括：技能名称、难度、用户已输入的内容
3. 教师 AI 应根据反馈调整教学策略：
   - 简化当前概念讲解
   - 提供更多示例
   - 暂时跳过这个练习

#### 错误累计处理
1. 记录用户的错误次数
2. 连续错误 >= 3 次时，建议中断共创
3. 教师 AI 决定：简化教学 / 跳过 / 换一个练习

### 测试用例提示词

以下提示词可用于测试共创编码系统：

#### 测试 QTE 选择题
\`\`\`
教我 TypeScript 的 async/await，给我一个简单的练习
\`\`\`

#### 测试共创编码
\`\`\`
帮我写一个函数来获取用户数据，用共创编码的方式一步步教我
\`\`\`

#### 测试多 QTE 点
\`\`\`
教我实现一个完整的错误处理流程，包括 try/catch 和 finally
\`\`\`

#### 测试超时流程
\`\`\`
我想学习 React 组件，但我可能需要一些时间思考
\`\`\`
`;

  return prompts;
};
