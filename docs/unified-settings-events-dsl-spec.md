# 统一 GDevelop Language (GDL)：函数、事件与 JavaScript 作者格式规范

- 状态：已实施。当前作者格式 14；基础配置与文档导航见 [GDL 当前规范](settings-dsl-spec.md)。
- 日期：2026-10-26。
- 决策依据：函数声明和事件正文合入同一个 `.gdl` 文件；只保留 GDevelop Language (GDL)，不考虑任何作者格式兼容性。
- 当前作者格式：14。GDL catalog 版本：13；instruction catalog 版本：7，发布本文的新指令结构契约。
- 运行时边界：仍投影到 GDevelop 原生事件模型与代码生成器；不重新定义对象 picking、事件调度或表达式求值。

文件命名：语言正式名称为 **GDevelop Language（GDL）**，统一源码后缀为 `.gdl`；项目入口保留 `project.gdl`，`constants.toml` 和 JavaScript 测试文件保持各自格式。格式 14 不读取旧 `.settings` 项目，不提供双读或迁移。内部 SettingsDsl 模块及生成 catalog 的标识不因后缀更名而改变。

系统 action/condition 由引擎固定映射发布作者短名。instruction catalog 7 的
action/condition 的 `dslName` 与 `type` 相同时省略。GDL 和 AI 优先使用
`dslName`，缺失时使用精确原生 `type`；解析器也接受精确原生 `type`，
格式化优先输出 `dslName`，缺失时输出 `type`。参数名称及 `{{...}}` 中的表达式名称通常不变；
行为内部的 `setProperty` / `getProperty` 是本文末尾定义的语法映射例外。
同一 kind 内短名与原生名称不得交叉冲突；错误必须明确拒绝。
详见 [系统指令与入口契约](gdl-system-instruction-names-and-project-entry-spec.md)。

## 1. 最终结论

GDevelop Language (GDL) 成为唯一的项目配置及事件作者语言。函数签名、参数和事件正文属于一个 `function` 根；外部事件片段的声明和正文属于一个 `fragment` 根。函数和片段的顶层事件正文放在唯一可选的 `events {}` 容器中；子事件直接嵌套，不再包一层 events。

统一规则：

1. `key = value` 声明属性。
2. `node { ... }` 表达明确的结构、归属和边界。
3. `conditions {}` 和 `actions {}` 明确区分指令种类；内部直接写 `Type { name = value }`，不使用 if/do。
4. 普通事件使用 `event {}`，其他事件分别使用 `else {}`、`repeat {}`、`while {}`、`for_each {}`、`for_each_child {}`、`javascript {}`；所有事件节点禁止 type 字段；分组使用独立的 `group {}`，持久化注释使用独立的 `comment {}`，外部片段引用使用独立的 `link {}`。
5. JavaScript 使用 `javascript {... }` 中的 `code = """` 多行原始字符串。
6. 同一 lexer、parser、AST、source range、formatter 和诊断系统处理全部作者源码。不得将 events 内容截成字符串交给旧 IfDo parser。
7. 缩进帮助阅读，花括号决定结构；空行没有事件边界含义。
8. 不再存在 `.events` 作者文件、IfDo 语言模式或独立 IfDo 版本。

指令调用统一使用花括号块，是统一语法中受上下文限制的节点类型，和 variable.value 的结构字面量一样由同一个解析器处理。code 是通用原始字符串值，GDL 仅识别字符串定界符；JS 解析器独立校验其正文。

## 2. 目标与非目标

### 2.1 目标

- 消除 `.gdl` / `.events` 配对文件及跨文件声明一致性问题。
- 消除隐式事件切分、`>` 深度前缀、`?` 子指令前缀和前置 `@` 注解。
- 保留紧凑、具名、catalog 驱动的指令表达。
- 完整覆盖当前可持久化事件、指令子树及有效编辑元数据。
- 支持安全局部修改：移动整个事件块不依赖相邻事件内容；身份和元数据随所属节点移动。
- 统一事件和配置的补全、导航、引用重构、格式化及校验。
- 原生模型往返不丢失有效数据，不把运行时 JSON 暴露为作者语法。

### 2.2 非目标

- 将 GDevelop 事件模型变成普通命令式语言。
- 重写 GDevelop 表达式语言、JS 运行时 API 或原生代码生成器。
- 增加对象父子布局、UI 自动布局或差量继承。
- 把所有场景、对象和函数合并成单个巨型文件。
- 删除 Constants TOML、测试 `.js` 或资源文件；本文的“只保留 GDevelop Language (GDL)”针对配置和事件作者格式，不改变这些既有独立领域。
- 自动迁移旧项目、兼容读写旧语法或保留隐藏 fallback。

## 3. 文件组织与所有权

```text
project.gdl
resources.gdl
tests.gdl
constants.toml
scenes/Battle/scene.gdl
scenes/Battle/objects/Player.gdl
scenes/Battle/functions/sceneLoad.gdl
scenes/Battle/functions/sceneUpdate.gdl
scenes/Battle/functions/TakeDamage.gdl
scenes/Battle/external-events/SharedCombat.gdl
extensions/Combat/functions/ApplyDamage.gdl
extensions/Combat/behaviors/Health/functions/TakeDamage.gdl
extensions/Combat/prefabs/Knight/functions/sceneUpdate.gdl
```

所有函数仍按现有 owner 和目录边界独立存储；文件 stem、函数 name、生命周期注册信息继续由现有项目规则校验。Scene 的 scene.gdl 不直接容纳函数事件；Behavior、Prefab、Extension 同理，事件属于其函数文件。

| 根类型 | 允许 events | 原因 |
| --- | --- | --- |
| function | 0/1 | 函数签名与正文共同保存 |
| fragment | 0/1 | 片段身份与正文共同保存 |
| scene / prefab / variant / behavior / extension | 禁止 | 事件属于所属函数，避免第二个所有者 |
| project / object / resources / tests / external | 禁止 | 保持现有组件职责 |

`events` 缺失与 `events {}` 都表示空原生事件列表；规范输出总是输出 `events {}`，使有正文能力的文件边界可见。函数仅声明签名但尚无事件时仍合法，另按函数类型检查返回约束。

项目扫描遇到任何受管理组件目录内的 `.events` 文件，报 `SETTINGS_RETIRED_EVENTS_FILE`，不能忽略、合并或猜测哪个文件权威。目录外的备份和文档不作为组件扫描输入。

## 4. 完整函数示例

下面的 CollectCoin 位于场景函数目录，参数约束和指令签名必须以项目实际 catalog 为准。该函数由调用方在合适时机调用；JavaScript 子事件在加分动作之后执行。

```settings
function {
  name = "CollectCoin"
  description = "检测玩家与金币接触，删除金币并增加分数"
  functionType = "Action"
  order = 0
  folder = ["Gameplay"]

  parameter {
    name = "Player"
    type = "object"
    description = "拾取金币的玩家"
  }

  parameter {
    name = "Coin"
    type = "object"
    description = "被拾取的金币"
  }

  events {

    group {
      name = "Coin pickup"
      folded = false

      event {

        conditions {

          collision { first_object = "Player" second_object = "Coin" }
        }

        actions {

          deleteObject { object = "Coin" }

          setNumberVariable { variable = "Score" modification_sign = "+" value = 1 }
        }

        javascript {
          strict = true

          code = """
            const score = runtimeScene.getVariables().get("Score").getAsNumber();
            console.log("Current score:", score);
            if (score >= 100) {
              console.log("Score target reached!");
            }

"""
        }
      }
    }
  }
}
```

注意：碰撞条件可能选中多个 Coin，Delete 会删除全部被选金币，而加分动作仍按原生事件语义执行；不能从这个例子推断“每个金币加一次分”。需要逐金币处理时使用 `for_each {}` 事件。这也是必须保留 picking 校验和预览证据的原因。

## 5. 统一词法与语法

### 5.1 沿用 Settings 规则

- UTF-8；规范输出 LF、末尾一个换行。
- JSON 双引号字符串、有限 JSON 数字、布尔、数组和受 schema 约束的结构字面量。
- `//` 是外层注释。禁止 `#`、分号和外层块注释。
- 同一节点属性不得重复；节点类型和属性名不得冲突。
- 名称、ID 等普通节点数据全部放块内，不支持 `group "Combat" {}` 等节点头参数。
- 普通节点空块可写 `event {}`；非空节点必须多行。
- 不增加 include、宏、字符串插值或任意属性求值。

### 5.2 上下文明确的指令与代码块

```text
document         := node EOF
member           := assignment | node
instructionList  := ('conditions' | 'actions' | 'while_conditions') '{' NEWLINE instruction* '}'
instruction      := instructionType '{' (namedArgument | flagsBlock | instruction)* '}' NEWLINE
instructionType  := IDENT_OR_NAMESPACED_TYPE | STRING
namedArgument    := IDENT '=' operand
operand          := STRING | NUMBER | BOOLEAN | expression
expression       := '{{' expressionSource '}}'
flagsBlock       := 'flags' '{' NEWLINE assignment* '}'
codeProperty     := 'code' '=' rawMultilineString
```

以上为说明性语法；instructionList 是普通节点语法的上下文特化；rawMultilineString 是通用字符串值，必须由同一个 Settings parser 管理范围、预算和诊断。条件列表只查条件 catalog，动作列表只查动作 catalog；子指令继承父指令种类。同名条件/动作无歧义。指令不能直接出现在 event、group 或其他配置节点中。

指令优先使用 catalog 精确 dslName；也接受精确原生 type，包含空格时使用 JSON 字符串。列表内部 `Name = value` 是非法赋值，不可当作指令；指令调用使用 `Type { arg = value }`，花括号不可省略，包括无参数调用。指令块内赋值表示具名参数；执行标记放在嵌套 `flags {}` 中，避免与参数重名。

`{{...}}` 专用于 catalog 允许表达式的参数与循环字段，不能出现在普通 settings 属性中。扫描识别表达式中的嵌套花括号、字符串和转义；只有字符串外且嵌套深度为零的 `}}` 才结束表达式。参数不得重复、不得使用位置参数。指令参数可以逐行书写，也可以在同一行书写。{{...}} 内容可跨行，保留原生表达式的精确源码。官方模板包含此类表达式，不能折叠空白或截断。格式化器将不超过 80 列、无标记、无子指令和内部注释的简单调用输出为单行，其余展开。

例如，`angle_in_degrees = {{ MousePointerLock::MovementX() * HorizontalSpeed / SceneWindowWidth() }}`。规范输出在双花括号内两侧各使用一个空格。双花括号内使用 GDevelop 表达式语言，不是 JavaScript 或 GDL 结构块。`message = "Hello"` 是文本字面量，`message = {{ "Score: " + ToString(Score) }}` 是表达式。旧的 `expr(...)` 写法不受支持。

不保留 if/do 前缀和第二种条件/动作表达。JavaScript code 内的 if、do 等 JS 关键字正常有效。

## 6. 标准事件与执行顺序

```settings
function {
  name = "Example"
  functionType = "Action"

  events {

    event {
      disabled = false
      folded = false
      aiGeneratedEventId = "handle-contact"

      variable {
        name = "Damage"
        value = 10
      }

      conditions {

        collision { first_object = "Player" second_object = "Enemy" }
      }

      actions {

        deleteObject { object = "Enemy" }
      }

      event {
        // 子事件条件、动作继续写在这里。
      }
    }

    event {
      // 独立的下一个兄弟事件，即使只包含动作也不合并。
    }
  }
}
```

所有事件类型使用独立节点。event 仅表示 Standard；else、repeat、while、for_each、for_each_child、javascript、group、comment、link 分别表示对应原生事件。所有事件节点均禁止 type 字段，不兼容旧写法。

| type | 原生事件 | 允许的主要内容 |
| --- | --- | --- |
| event | Standard | variable、conditions、actions、子 event/group/comment/link |
| else | Else | 同 standard，另校验前支 |
| repeat | Repeat | count、index，以及标准事件内容 |
| while | While | while_conditions、循环属性，以及标准事件内容 |
| for_each | ForEach | 对象/排序/上限属性，以及标准事件内容 |
| for_each_child | ForEachChildVariable | 迭代变量属性，以及标准事件内容 |
| javascript / code | JsCode / inlineCode | strict、objects、expanded、code；叶事件 |

conditions、actions、while_conditions 各最多一个，缺失与空块等价。while_conditions 仅 while 可用。子 event/group/comment/link 直接嵌套，不写 events 包装。嵌套 events 无论是否为空都报上下文错误。

解析不依赖“属性 → 条件 → 动作 → 子事件”的阶段状态机：合法成员块可换序，仍由节点名决定归属。运行时始终初始化原生局部变量、检查条件、执行动作、再执行子事件，而非按这些类别在源码中的交错位置执行。模型规范输出固定为属性、variable、while_conditions、conditions、actions、子 event/group/comment/link；AST 格式化保留作者成员顺序。各条件、各动作、各局部变量和混排子 event/group/comment/link 自身的出现顺序必须保留，不能排序。补全优先插入规范位置，并提示非规范排列。

条件列表按顺序 AND；动作列表按顺序执行。先执行父动作，再执行子事件。允许空、仅条件、仅动作、仅局部变量或仅子事件的标准事件。

事件公共字段为 disabled、folded、aiGeneratedEventId；默认 false/false/缺失。具体事件原生不支持的字段不得仅因公共表而补造。有效的显式默认值是否在模型中保留应按原生等价规范登记；格式化 AST 不删除作者属性，模型规范序列化可省略无语义默认值。

## 7. 条件、动作与子指令

```text
conditions {
  SomeCondition {
    target = "Player"
    flags {
      inverted = true
      disabled = false
    }
  }
  or {
    SomeCondition { target = "Enemy" }
    AnotherCondition { target = "Enemy" }
  }
}

actions {
  SomeAction {
    target = "Player"
    flags {
      awaited = true
    }
  }
}
```

SomeCondition/SomeAction 为示意 catalog 类型，不是新增别名。简单指令可保持一行；标记放在嵌套 flags 块内，不和具名参数共享命名空间，避免 disabled 等参数重名冲突。

- 条件允许 disabled、inverted；动作允许 disabled、awaited。
- 无异步能力的动作写 awaited=true 报错。
- 指令子块直接列子指令，不再增加 conditions/actions 包装；种类从父指令继承。
- 只有 catalog 标明支持子指令的类型才能包含子指令。标记赋值和子指令由语法区分，不依赖先后阶段；规范输出先参数、再标记、后子指令。
- `or` 是 catalog 中原生 `Or` 条件的固定作者名称，保留原生 picking 和子指令结构；不展开成多个事件，也不提供 if/do 语法。
- 子指令顺序及标记无损投影原生 subInstructions。

参数采用语义值：text/object/behavior/variable/resource/name 为字符串，number/boolean 为字面量，计算值使用 {{...}}。code-only 参数不写；必需参数缺失报错；可选空槽由 catalog 明确默认规则投影。隐藏/废弃但确需无损保留的指令通过专用 catalog 登记，不允许新作者任意使用。

## 8. Else 分支

Else 使用独立 else 节点：

```text
event {
  conditions {
    SomeCondition { target="Player" }
  }
  actions {
    SomeAction { target="Player" }
  }
}

else {
  conditions {
    AnotherCondition { target="Player" }
  }
  actions {
    AnotherAction { target="Player" }
  }
}

else {
  actions {
    FallbackAction { target="Player" }
  }
}
```

- else 类型的 conditions 保存原生 Else 附加条件。
- 支持与 standard 相同的局部变量、条件/动作块和子事件。
- 与前支处于同一父容器、在混排 event/group/comment/link 列表中紧邻；禁止跨 group、父子深度或函数配对。
- 空行与 // 注释不影响相邻性；comment 节点表示的持久化事件占据列表位置，会打断配对。
- 首支须为有条件的 standard；后续 else 按原生分支规则执行。禁止对循环、link、javascript 或无条件 standard 配 else。
- disabled 等标记沿用原生行为，不新增布尔缓存或“上一个动作成功”语义。
- 禁止独立 else 节点与 else if 头。

## 9. 循环

循环使用 repeat、while、for_each、for_each_child 独立节点，内部使用属性、局部变量、conditions、actions 和直接嵌套的子事件。循环相关表达式按 catalog/GDevelop 表达式规则校验。

### 9.1 Repeat

```text
repeat {
  count = 5
  index = "i"

  actions {

    SomeAction { amount = 1 }
  }
}
```

count 必需，接受有限数字或 {{...}}；投影原生 repeatExpression。动态次数的取整、负数等行为沿用引擎，不在 DSL 另定义。静态明显无效输入按原生表达式验证规则诊断。index 可选，投影 loopIndexVariable。

### 9.2 For each object

```text
for_each {
  object = "Enemy"
  index = "i"
  order_by = {{ Enemy.Variable(HP) }}
  order = "desc"
  limit = 10

  conditions {

    SomeCondition { target = "Enemy" }
  }

  actions {

    SomeAction { target = "Enemy" }
  }
}
```

object 必需且解析到当前 owner 的对象或合法组；order_by 为数值表达式，order 为 asc/desc；limit 为数字或表达式，沿用原生 ForEach limit。排序配置组合约束必须对照原生模型显式登记，不能接受引擎不读取的字段。每次迭代选择当前对象，其他对象的 picking 保持原生语义。

### 9.3 For each child variable

```text
for_each_child {
  iterable = "Inventory"
  value = "item"
  key = "itemKey"

  actions {

    SomeAction { text = "Inspect item" }
  }
}
```

iterable 映射 iterableVariableName，避免与局部 variable 子节点同名冲突；value/key 映射迭代值和键的变量名。保留当前 ForEachChildVariable 的字段及有效空值；当前原生模型还支持 loopIndexVariable，因此可选 index 映射该字段，不得丢弃已有迭代索引。名称冲突和作用域由项目校验负责。

### 9.4 While

```text
while {
  infiniteLoopWarning = true
  index = "i"

  while_conditions {

    numberVariable { variable = "QueueSize" comparison_sign = ">" value = 0 }
  }

  conditions {

    SomeCondition { target = "Player" }
  }

  actions {

    setNumberVariable { variable = "QueueSize" modification_sign = "-" value = 1 }
  }
}
```

while_conditions 是唯一可选条件列表，保存原生 whileConditions。conditions 保存原生 conditions，两者不能合并；归属由块名确定，不依赖位置。空或缺失 while_conditions 投影空列表，原生行为保持；给出可能无限循环的诊断，预览按引擎现有保护执行。

不支持旧 IfDo 的 source-only while limit：这种信息无法从原生事件模型恢复。需要固定上限时使用 repeat 并结合条件；未来若新增 while 上限，必须先定义可持久化原生字段及完整往返，不以注释、隐藏 sidecar 或猜测恢复。

## 10. 局部变量

局部变量使用最新 Settings variable 声明，与场景变量共用值类型、enum、身份和容器规则：

```text
event {

  variable {
    name = "Mode"
    type = "enum"
    value = "Idle"
    values = ["Idle", "Run"]
  }

  variable {
    name = "Inventory"
    value = ["Sword", "Shield"]
  }

  actions {

    SomeAction { text = "Use local variables" }
  }
}
```

声明归属于包含它的原生事件 variables，不是独立事件。子事件继承局部作用域；同作用域重复名报错，跨作用域遮蔽按现有引擎规则校验。循环局部变量初始化时机沿用原生模型，不按普通语言直觉改成每次迭代或循环外初始化。

禁止 local、var(...)、递归 metadata 路径和 scope 属性。嵌套变量有附加信息时直接使用嵌套 variable 声明；结构子变量具名，数组子变量无名且保持顺序。

## 11. Group、持久化注释与源码注释

```text
group {
  name = "Combat"
  source = ""
  creationTime = 0
  color = [74, 176, 228]
  parameters = []

  comment {
    text = "先筛选对象，再执行动作"
    secondaryText = ""
    background = [255, 230, 109]
    color = [0, 0, 0]
  }

  event {}
}
```

group 的 children 是同一分组的原生事件列表；不建立额外可执行条件或局部变量作用域。name/source/creationTime/color/parameters 映射原生 Group 已有有效字段，parameters 的非空结构必须登记严格字段清单，不允许任意 JSON。

comment 是独立的持久化注释节点，投影为原生 Comment 事件，text/secondaryText/background/color 分别映射原生 comment/comment2/背景色/文字色；叶节点，无指令、局部变量或子事件。颜色为三项 0..255 整数。comment 可出现在顶层 events、group 和允许子事件的 event 内，和 event/group/link 共享有序列表；禁止 conditions、actions、code、variable 或子事件。只接受 comment 节点这一种作者写法，禁止 event 的 type 字段。

`//` 仅为源码注释，不生成原生事件，不能替代需要在事件表显示的 comment。AST 与局部编辑必须保留其所属位置；模型保存时依据已有源码节点锚点保留可匹配注释。无法确定归属的注释保留在最近未删除的容器尾部并给出编辑提示，不能无声丢弃。JavaScript code 内的注释属于原始代码内容，不作为外层注释重定位。

## 12. 外部事件片段与 Link

```settings
fragment {
  name = "SharedCombat"
  description = "共享接触处理"
  eventsLogic = "在调用者选择范围内处理战斗"

  events {

    event {

      actions {

        log { message_to_log = "Shared combat" }
      }
    }
  }
}
```

调用方正文中：

```text
link {
  target = "SharedCombat"
}
```

link 是独立的外部片段引用节点，仅引用整个片段；禁止 scene、range、group 或 includeConfig 作者属性。片段身份、命名空间、NFC/大小写唯一性按现有项目规则；循环引用、未解析目标报项目错误。

link 可出现在顶层 events、group 及允许子事件的 event 内，和 event/group/comment 共享有序列表。它不是执行事件的 type，作者层禁止 event 的 type 字段；投影到原生模型时仍使用 Link 记录。link 禁止 conditions、actions、variable、code 和子节点；现有原生 Link 的公共标记须按其注册 schema 保留。

Link 继承调用者生命周期、条件选择和可见作用域。外部片段没有自己的生命周期。空、注释-only、未被引用的片段仍合法。模块地图只返回一个 settingsPath，取消 eventsPath。

## 13. JavaScript 事件与原始 code 字符串

### 13.1 唯一作者写法

```text
javascript {
  strict = true
  objects = "Enemy"
  expanded = false

  code = """
    const score = runtimeScene.getVariables().get("Score").getAsNumber();
    const label = `Score: ${score}`;
    // 字符串、注释中的括号不结束 code 块。
    const brace = "}";
    if (score >= 100) {
      console.log(label, brace);
    }

"""
}
```

JavaScript 是叶事件，允许公共事件标记及 strict、objects、expanded、code。code 是必需的 string 属性，作者必须使用多行原始字符串。禁止旧 code 子节点和普通转义字符串代码。空代码用独占行的开始与结束标记表示，不要求 JS 语句。

strict/objects/expanded 分别映射 useStrict/parameterObjects/eventsSheetExpanded。strict 缺省按原生 false 映射，新建模板显式写 true。objects 保持原生字符串契约。对象、局部变量不自动成为 JS 同名变量，实际绑定与 picking 桥接来自真实 JS 事件 API 和生成声明。脚本能力、引用和作用域仍须项目校验。

### 13.2 多行原始字符串边界

`code = """` 后必须换行；开始/结束标记使用相同数量 N >= 3 的双引号。结束标记独占一行，前后可有空格或 Tab，不允许注释。正文不按 JavaScript 词法寻找边界；定界符冲突时增加引号数量。writer 选择 max(3, 正文最长连续双引号数 + 1)。

### 13.3 内容、空白与往返

正文不转义、不插值、不去缩进、不 trim。空格、Tab、空白行和行尾空格全部保留。首尾分隔换行不进入值；其余正文行以 LF 连接，CRLF 输入解码为 LF。单独 CR 报错。不自动补末尾 LF，需要末尾 LF 时保留额外空正文行。

结束标记缩进不影响正文；formatter 统一把结束标记放在第 1 列。GDL formatter 不改正文缩进，JS 格式化为独立操作。原生 inlineCode 的末尾换行精确保留，不再强制添加。普通配置字段也可以使用相同的多行字符串字面量，值类型仍为 string。

### 13.4 诊断与编辑器

raw string AST 保存定界符长度、整个值与内容范围、每行原始偏移，用于 CRLF 到 LF 的准确定位。JS 类型检查器基于真实执行上下文构造虚拟文档，诊断映射回 settings 内代码行；不得把外层缩进算成字符串转义偏移。

编辑器在 code 内提供 JS 高亮、补全和括号匹配，退出后恢复 Settings；大纲显示为 JavaScript event。单纯打开、解析、格式化和校验均不执行代码。

## 14. Picking 与运行语义

统一语法只改变作者表示：

- 条件既返回真假，也会筛选对象实例。
- 同事件后续条件从前序选择继续筛选。
- 动作使用当前选择集；不是默认遍历所有同名对象。
- 子事件继承父事件的选择集和局部作用域。
- 兄弟事件选择恢复、OR 合并、Else、循环和 Link 均按原生代码生成器语义。
- 禁止将 OR、Else 或循环通过文本改写成普通布尔表达式后声称等价。
- 不将 javascript 中 runtimeScene.getObjects(...) 等 API 自动解释为“父事件选中的对象”；必须按实际 API 区分全体实例和传入选择。

编辑器和 AI 检查工具应提供事件位置、父链、条件顺序、对象引用和潜在选择范围变更摘要。调试器可进一步暴露每个条件前后的选中实例及动作目标。静态分析不能确定动态选择时明确返回 unknown，不编造数量。

## 15. Schema、AST 与模型映射

### 15.1 AST

统一 AST 至少包含 Document、Node、Assignment、InstructionList、Instruction、ExpressionOperand、CodeBlock。每项拥有文件 URI、起止 offset/行列、父节点关系及注释锚点。Instruction 的 kind 由所属列表继承，具有 catalogType、有序 namedArguments、有序标记与子指令；不能在 AST 阶段提前丢弃原始参数位置或注释。

各指令列表内和混排子 event/group/comment/link 列表的源顺序为权威；模型投影按显式容器读取 conditions/actions，直接收集子事件为 events。AST 不需要用随机 UUID 识别每次解析的每个节点。已有 aiGeneratedEventId 可作匹配辅助，不强制所有事件写 ID；重复非空 ID 给出诊断并禁止依赖其做唯一定位。

### 15.2 映射表

| 作者结构 | 原生模型 |
| --- | --- |
| function.events | 函数 events 列表 |
| fragment.events | 外部片段 events 列表 |
| event | Standard |
| else | Else |
| repeat / count | Repeat / repeatExpression |
| while / while_conditions | While / whileConditions |
| for_each | ForEach |
| for_each_child | ForEachChildVariable |
| group | Group |
| comment | Comment |
| link | Link，includeConfig 固定全片段 |
| javascript / code | JsCode / inlineCode |
| conditions / actions 内的指令调用块 | conditions / actions |
| 指令块内的子指令调用块 | subInstructions，继承父指令种类 |
| event.variable | variables |
| 直接嵌套的 event / group / comment / link | events，按混排源顺序 |

所有原生当前有效字段必须在 SchemaInventory 中登记字段类型、默认值、基数、上下文和源位置。未知原生事件类型、字段、不可表示参数在保存时明确报错，不生成 rawJson 或 generic event 包装。

引擎预处理临时事件如 BuiltinAsync::Async 不作为作者节点；它们应在代码生成阶段产生。需要保留引擎内部临时结果时不得将其混入作者保存流程。

## 16. Catalog 与编辑器

GDL catalog 必须发布：

- function/fragment 的 events 唯一容器及允许的子事件种类。
- 各独立事件节点 schema、各容器基数、规范输出顺序、递归规则和 Else 相邻约束。
- 裸指令从 conditions/actions/while_conditions 继承的种类、标记和子树能力。
- 表达式的合法字段位置、JavaScript 原始 code 字符串及其版本/边界规则。
- variable schema 的递归引用，明确没有 metadata/path。

instruction catalog 继续独立描述精确 type、dslName、valueKind、默认/可选/code-only 参数、异步及子指令能力和 owner 限制。不是第二种作者语言，也不应复制整套 Settings grammar。

编辑器只注册 Settings 语言入口；删除 IfDo 语言注册和独立 `.events` 标签页逻辑。按 AST 提供函数大纲、事件折叠、结构选择、块移动、条件/动作补全、错误下划线和 JS 内容语言服务。incomplete document 仍可补全，但保存前必须通过完整解析和语义验证。

## 17. 项目读取、写入与事务

读取顺序：入口格式 14 → 按现有组件目录发现 settings → 统一解析 → 注册函数签名和类型 → 解析事件引用/参数 → 原生模型投影 → 表达式及代码生成验证 → JS 类型检查。

签名注册先于事件调用解析，支持跨文件函数和现有合法递归调用；不能通过文件枚举顺序决定可见性。

保存时：

1. 从原生组件生成签名和事件的单个 AST。
2. 根据同版本已有源码保留可匹配注释、变量结构字段顺序和未修改 code 内容（仅执行已声明的换行规范化）。
3. 校验 schema、引用和事件等价性。
4. 在现有项目事务中一次写入完整 settings；失败保留旧文件，不允许签名更新而正文未写入。
5. 跨组件重命名使用同一项目事务更新全部引用。
6. 重建 catalog、模块地图和生成的运行时 JSON。

函数修改不再删除/创建配对 `.events`。自动保存、云保存、下载、恢复及 source hash 计算均以合并后的单文件内容为单位。更新源 watcher、备份和恢复清单，不保留“找不到 events 则读另一处”的路径。

## 18. 诊断与安全边界

| code | 含义 |
| --- | --- |
| SETTINGS_RETIRED_EVENTS_FILE | 发现已移除的 .events 作者文件 |
| SETTINGS_EVENT_CONTEXT | 事件、指令或 events 容器位于非法 owner |
| SETTINGS_EVENT_TYPE | 未知事件类型或类型专属字段不合法 |
| SETTINGS_EVENT_ID | 同一事件文档出现重复的非空身份 |
| SETTINGS_EVENT_CONTAINER | 重复条件/动作块、嵌套 events 或非法子事件 |
| SETTINGS_ELSE_TARGET | Else 无匹配或跨边界 |
| SETTINGS_INSTRUCTION_UNKNOWN | 无注册指令或种类不匹配 |
| SETTINGS_INSTRUCTION_ARGUMENT | 重复、缺少、未知或类型不符的参数 |
| SETTINGS_INSTRUCTION_FLAGS | 标记与指令能力不符 |
| SETTINGS_INSTRUCTION_CHILDREN | 子指令类型或能力不符 |
| SETTINGS_EXPRESSION | 表达式语法或 owner 语义不合法 |
| SETTINGS_CODE_BLOCK | code 非多行、缺失、重复或边界未闭合 |
| SETTINGS_JAVASCRIPT | JS 解析/类型/作用域错误 |
| SETTINGS_LINK_TARGET | Link 未解析或有环 |

沿用已有通用词法、重复字段、未知节点、变量和预算错误码；不为同一错误并存 IfDo 和 Settings 两套诊断。错误须有 file URI、精确范围、结构路径、简短原因；参数错误附 catalog 签名摘要，避免要求作者读取原生位置参数数组。

统一限制文件字节、token、节点、事件/指令/值递归深度及表达式/代码字节。解析线性扫描，重复名与 ID 索引不使用全树反复搜索。JS 不在读取/格式化/校验时执行。项目路径、资源和脚本能力沿用现有验证边界。

## 19. 验证要求

### 19.1 语法与边界

- 相邻 action-only / condition-only / empty 事件不合并。
- 删除或增加空行不改变事件树；移动块仅改变显式源顺序/父级。
- 支持全部事件种类、嵌套事件、子指令、精确类型及具名参数。
- 拒绝重复 conditions/actions、嵌套 events、事件节点的非法 type 字段、类型专属字段混用、坏 Else、旧前缀和旧 .events 文件。
- 容器成员换序不改变归属；各列表内部和混排子 event/group/comment/link 的相对顺序必须保留；所有事件节点拒绝 type 字段。
- code 中嵌套花括号、对象、类、解构、字符串、注释、正则/除法、模板及嵌套插值均正确识别边界；伪关闭行不误结束。
- code 必须为多行原始字符串属性；拒绝旧 code 子块、普通转义字符串和单行正文。
- 未闭合代码准确定位；尾换行规范化和 CRLF 处理按明确等价规则验证；不能保真时拒绝而非转义回退。
- formatter/块移动保持模板字符串、注释和代码正文空白，不自动重排 JS。

### 19.2 模型与行为

- 所有当前持久化事件及标记，原生 → settings → 原生等价。
- 参数语义字面量、表达式、空文本、可选槽、代码参数和异步标记正确投影。
- OR picking、父子继承、兄弟选择恢复、Else、循环及 Link 用真实引擎代码生成与运行测试验证。
- 多金币例子验证删除范围与计分次数，不能只检查文本相似或编译通过。
- 变量 enum/身份/false 编辑标记、结构字段顺序和数组顺序无损保留；无 metadata/path。
- JS 的实际作用域、对象传参、strict 和展开状态往返，语法/类型错误定位回 settings。

### 19.3 存储与工具

- 函数签名/正文一次原子保存；失败恢复不会生成半套组件。
- 模块地图、catalog、引用重构、生命周期和外部片段只定位 settings。
- 新建、原生模板导入、本地首次保存、重开、再次保存及云/下载路径使用同一语法。
- formatter 幂等；局部修改保留无关注释和 JS 原始内容，只有声明的换行规范化例外。
- 规模测试覆盖大量事件、深指令树、大 JS 代码块及预算上限，记录实测而非预设性能承诺。
- 最终受管理项目不产生 `.events`，公开工具无旧语言入口；过期作者格式明确拒绝。

## 20. 后续优化的边界

事件语义分析的独立契约见 [GDL 事件执行与对象选择语义](gdl-event-semantics-analysis-spec.md)。结构化指令语义使用 instruction catalog 7；GDL 作者格式仍为 12，GDL catalog 仍为 10。静态摘要不改变原生执行行为，也不代替运行验证。


picking 可视化、行为相关 diff 和按 AST 的安全块移动是推荐编辑器能力，可独立迭代；不能将它们未完成视为可改变基础语法的理由。实现基础格式时至少保留精确 AST 和语义位置，使后续工具无需重新解析另一套正文语言。

本文只采用显式 conditions/actions 块中的指令调用块、独立的 event/else/repeat/while/for_each/for_each_child/javascript/group/comment/link 节点 和原始多行 code 字符串。禁止并行支持 if/do、event 的 type 字段、嵌套 events 包装及旧 code 子块等备用写法，也不增加所有者名称简写。若未来改变，应重新评审整个作者契约，而不是逐步累积别名。

## Behavior property syntax aliases

Inside `extensions/<Extension>/behaviors/<Behavior>/functions/*.gdl`, property
access can use a uniform spelling. The file URI supplies the owning behavior;
`name` is a literal property identifier, never a runtime expression. These aliases
are lowered through the existing instruction catalog, including private/hidden
property entries, and do not introduce runtime actions or change access control.

```settings
function {
  name = "InitializeCamera"

  events {

    event {

      conditions {

        getProperty { name = "HasJustBeenCreated" }
      }

      actions {

        setProperty { name = "HasJustBeenCreated" value = false }

        setProperty { name = "CameraZ" value = 100 }

        setProperty {
          name = "CameraZ"
          modification_sign = "+"
          value = {{ getProperty(name="CameraZ") * 0.1 }}
        }
      }
    }
  }
}
```

- Action: `setProperty { name = "Name" value = ... }`. `object="Object"` and
  `behavior="Behavior"` are implicit; either may be supplied explicitly.
  Numeric/text values use their actual semantic type, with `{{...}}` for
  calculations. `modification_sign` defaults to `"="` for numeric/text setters;
  supported operators come from the underlying property catalog. Boolean setters
  require `value=true` or `value=false` and do not accept modification operators.
- Condition: `getProperty { name = "Flag" }` checks a boolean property for true;
  `flags { inverted = true }` checks for false. Numeric/text comparisons use
  `getProperty { name = "Name" value = ... comparison_sign = ">" }` (default `"="`).
- Expression: `getProperty(name="Name")` inside any event expression reads a
  numeric/text property of `Object.Behavior`. It lowers to
  `Object.Behavior::PropertyName()`. Boolean reads use conditions because the
  native expression system does not expose boolean property getters. This form
  accepts only `name`, and works in instruction expressions and repeat/for-each
  expression fields. Quoted text and member functions named `getProperty` are
  untouched. Existing bare property expressions remain valid.
- Unknown properties, dynamic property names, wrong value types, unsupported
  parameters and use outside a behavior function are rejected. The complete
  generated catalogs must be available; aliases do not bypass catalog validation.
- Saving uses the uniform instruction aliases for the current behavior and the
  expression alias for explicit `Object.Behavior::PropertyName()` reads. Original
  fully qualified instruction names remain accepted. Legacy instructions with
  empty target/value/operator slots retain their original spelling for lossless
  round trips. Other behavior targets and shared properties retain their existing
  expression syntax. Settings properties and embedded JavaScript are unaffected.
