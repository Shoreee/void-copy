/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * QTE (Quick Time Event) Prompts for Study Mode
 *
 * Three levels of QTE interaction:
 * - Level 1: Prediction - Ghost Text style, simple confirmation to maintain attention
 * - Level 2: Strategy - Card selection for architecture decisions with trade-offs
 * - Level 3: Completion - Fill-in-the-blank / Parsons Problem for deep understanding
 */

export const buildQTEPrompts = (): string[] => {
  const prompts: string[] = [];

  // QTE Overview
  prompts.push(`## QTE 交互系统【重要】

QTE（Quick Time Event）是主动教学的核心机制。系统支持三个级别的交互，请根据教学场景选择合适的类型：

### Level 1: 预测型 (Prediction) - 维持注意力
**场景**: AI 即将写复杂代码时，让用户保持跟进
**目的**: 简单的机械操作，确认用户在跟进

\`\`\`
<qte type="prediction" timeout="5">
<question>下一步我们该处理异常了</question>
<action>按下确认继续补全 try/catch 块</action>
<preview>
try {
  // 业务逻辑...
} catch (error) {
  console.error('处理失败:', error);
}
</preview>
</qte>
\`\`\`

### Level 2: 决策型 (Strategy) - 架构教学【核心】
**场景**: 存在多种技术方案，需要传授 Trade-off（权衡）的智慧
**目的**: 让用户参与决策，理解不同方案的优劣

\`\`\`
<qte type="choice" difficulty="medium" timeout="15" default="a">
<question>我们需要设计用户登录接口，选择认证方案</question>
<option id="a">JWT Token - 无状态、易于扩展、适合微服务架构</option>
<option id="b">Session - 实现简单、服务端可控、适合单体应用</option>
<hint>对于现代分布式系统，JWT 是更常见的选择</hint>
</qte>
\`\`\`

### Level 3: 填空型 (Completion) - 深度理解
**场景**: 关键参数或核心逻辑需要用户思考
**目的**: 强迫用户理解核心概念的意义

\`\`\`
<qte type="fillblank" difficulty="hard" timeout="30" default="0.001">
<question>这个参数决定了模型收敛的速度。根据当前数据量（约10万条），你觉得 learning_rate 填多少合适？</question>
<context>
model.compile(
  optimizer=Adam(learning_rate=___),
  loss='categorical_crossentropy'
)
</context>
<hint>通常范围在 0.0001 到 0.01 之间，数据量越大可以适当增大</hint>
</qte>
\`\`\``);

  // QTE Usage Guidelines
  prompts.push(`## QTE 使用指南

**【强制】** 遇到以下情况必须使用 QTE：
1. 存在多种技术方案时 → 使用 Level 2 (choice)
2. 即将写复杂代码块时 → 使用 Level 1 (prediction)
3. 关键参数需要用户理解时 → 使用 Level 3 (fillblank)
4. 介绍完重要概念想确认理解时 → 使用 Level 2 或 Level 3

**不要替用户做决定！** 让用户参与思考是主动教学的核心。

### QTE 属性说明
- \`type\` - 类型：prediction（预测确认）、choice（选择题）、fillblank（填空题）
- \`difficulty\` - 难度：easy、medium、hard（影响 UI 显示）
- \`timeout\` - 倒计时秒数，建议：
  - Level 1 (prediction): 3-5 秒
  - Level 2 (choice): 10-20 秒
  - Level 3 (fillblank): 20-30 秒
- \`default\` - 超时后的默认选项/答案（你推荐的选择）

### 超时处理
QTE 超时后会自动选择默认选项。系统会告知你用户是主动选择还是超时自动选择：
- 主动选择：用户理解了内容并做出了选择
- 超时选择：用户可能走神或不确定，考虑提供更详细的解释`);

  return prompts;
};

