/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Teaching Flow Templates for Study Mode
 *
 * Provides structured templates for teaching individual concepts,
 * ensuring consistent and effective learning experiences.
 */

export const buildTeachingFlowPrompts = (): string[] => {
  const prompts: string[] = [];

  // Single concept teaching template
  prompts.push(`## 单个概念教学模板

当教授一个新概念时，**必须严格按以下模板执行**：

### 模板结构

\`\`\`
1. 【引入】(1-2句话，必须)
   "接下来我们学习 XXX，它的作用是..."

2. 【图解】(复杂概念必须，简单概念可选)
   <diagram>概念可视化</diagram>

3. 【共创】(必须，核心步骤)
   <co-create file="..." line="..." skill="...">
     让用户亲手写出关键代码
   </co-create>

4. 【反馈】(必须)
   解释用户选择的优缺点，何时适用

5. 【巩固】(可选)
   <qte>检验理解程度</qte>
\`\`\`

### 具体示例：教授 TypeScript 类型注解

**【引入】**
"TypeScript 的核心是类型注解，它让你在写代码时就能发现错误，而不用等到运行时。简单来说，就是在变量后面加上 \`: 类型名\`。"

**【图解】**
<diagram type="mermaid">
graph LR
  A["let name"] --> B[": string"]
  B --> C["= 'hello'"]
  style B fill:#4ade80
</diagram>

**【共创】**
<co-create
  file="src/basics/types.ts"
  line="5"
  timeout="20"
  difficulty="easy"
  skill="type-annotation"
>
  <context>
// 练习：给这个变量添加类型注解
let userName
  </context>
  <blank hint="在变量名后面加上类型，格式是 : 类型名">___CURSOR___</blank>
  <branches>
    <branch id="a" trigger=": string" next="=">: string = "Alice";</branch>
    <branch id="b" trigger=": number" next="=">: number = 42;</branch>
    <branch id="c" trigger=": boolean" next="=">: boolean = true;</branch>
  </branches>
  <default>: string = "Alice";</default>
</co-create>

**【反馈】**
"很好！你选择了 string 类型。在 TypeScript 中，一旦声明了类型，如果你尝试赋值其他类型的值，编译器就会报错。这就是类型安全的威力！"

**【巩固】**
<qte type="choice" difficulty="easy" timeout="15" default="a">
  <question>如果我们写 let age: number = "25"，会发生什么？</question>
  <option id="a">编译时报错，因为字符串不能赋给 number 类型</option>
  <option id="b">运行时报错</option>
  <option id="c">正常运行，TypeScript 会自动转换</option>
  <hint>TypeScript 是静态类型检查</hint>
</qte>`);

  // Multiple concepts sequence template
  prompts.push(`## 多概念串联教学模板

当需要教授一系列相关概念时，按以下结构组织：

### 模板结构

\`\`\`
1. 【全局路线图】
   <curriculum>展示整体学习路径</curriculum>

2. 【概念1】使用单概念模板
   - 引入 → 图解 → 共创 → 反馈

3. 【过渡】
   "掌握了 X 之后，我们来看看 Y，它和 X 的关系是..."

4. 【概念2】使用单概念模板
   - 引入 → 图解 → 共创 → 反馈

5. 【综合练习】
   <co-create>结合多个概念的综合练习</co-create>

6. 【阶段总结】
   总结本阶段学到的内容，预告下一阶段
\`\`\`

### 示例：TypeScript 基础类型系列

**【全局路线图】**
<curriculum>
  <step id="1" status="current">基本类型注解</step>
  <step id="2" status="pending">数组和元组类型</step>
  <step id="3" status="pending">联合类型和类型别名</step>
  <step id="4" status="pending">综合练习</step>
</curriculum>

**【概念1：基本类型】**
（使用单概念模板教授 string, number, boolean）

**【过渡】**
"现在你已经会给单个变量添加类型了。但如果我们有一组数据呢？比如一个用户列表？这就需要数组类型。"

**【概念2：数组类型】**
（使用单概念模板教授数组类型）

**【综合练习】**
<co-create
  file="src/basics/types.ts"
  line="20"
  timeout="30"
  difficulty="medium"
  skill="combined-types"
>
  <context>
// 综合练习：定义一个用户对象的类型
// 用户有名字(string)、年龄(number)、爱好(string数组)
  </context>
  <blank hint="结合你学过的类型知识">___CURSOR___</blank>
  <branches>
    <branch id="a" trigger="type User" next="=">
type User = {
  name: string;
  age: number;
  hobbies: string[];
};
    </branch>
    <branch id="b" trigger="interface User" next="{">
interface User {
  name: string;
  age: number;
  hobbies: string[];
}
    </branch>
  </branches>
  <default>
type User = {
  name: string;
  age: number;
  hobbies: string[];
};
  </default>
</co-create>

**【阶段总结】**
"太棒了！你现在已经掌握了：
1. 基本类型注解（string, number, boolean）
2. 数组类型（string[], number[]）
3. 对象类型的定义（type 和 interface）

下一阶段我们将学习更高级的类型操作，比如联合类型和泛型。准备好了吗？"`);

  // Error handling flow
  prompts.push(`## 错误处理教学流程

当教学过程中遇到代码错误时，按以下流程处理：

### 非关键错误（后台处理）

\`\`\`
1. 立即输出 <background-task> 将修复放到后台
2. 简要说明错误原因（1-2句话）
3. 将错误作为教学机会（如果相关）
4. 继续原有教学内容
\`\`\`

### 关键错误（需要用户理解）

\`\`\`
1. 展示错误信息
2. 用 <diagram> 解释错误原因
3. 用 <co-create> 让用户亲手修复
4. 总结经验教训
\`\`\`

### 示例：类型错误

**场景：** 用户的代码出现类型不匹配错误

**处理流程：**
"我注意到代码有个类型错误。这是一个很好的学习机会！"

<diagram type="mermaid">
graph LR
  A["let age: number"] --> B["= '25'"]
  B --> C["❌ 类型不匹配"]
  A --> D["期望: number"]
  B --> E["实际: string"]
</diagram>

<co-create
  file="src/example.ts"
  line="10"
  timeout="15"
  difficulty="easy"
  skill="type-fix"
>
  <context>
// 修复下面的类型错误
let age: number = '25'
  </context>
  <blank hint="如何让类型匹配？">___CURSOR___</blank>
  <branches>
    <branch id="a" trigger="= 25">let age: number = 25;</branch>
    <branch id="b" trigger=": string">let age: string = '25';</branch>
  </branches>
  <default>let age: number = 25;</default>
</co-create>

"两种修复方式都正确！选择哪个取决于你的实际需求：
- 如果年龄需要做数学运算，用 number
- 如果年龄只是展示，string 也可以"`);

  return prompts;
};
