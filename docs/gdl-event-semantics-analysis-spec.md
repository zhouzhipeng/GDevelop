# GDL 事件执行与对象选择语义：面向 AI 的分析契约

- 状态：已批准；基础分析链路已实施。完整契约仍含未实施阶段，实际覆盖与验证见 [首版实施记录](gdl-event-semantics-implementation-report.md)。本文的设计要求不能直接视为已实现能力。
- 日期：2026-10-26。
- 目标使用者：通过 GDL 源码阅读、修改项目的 AI，以及事件编辑器、校验器和后续调试工具。
- 当前版本：GDL 作者格式 18、GDL catalog 17、instruction catalog 7。
- 范围：执行次数、对象选择（picking）、动作作用范围、父子与兄弟上下文、分析诊断和验证证据。
- 基础语言契约：[统一 GDL 规范](unified-settings-events-dsl-spec.md)。本文不替代该规范，也不改变原生执行行为。

## 1. 决策摘要

保留现有 GDL 语法，不增加 `picking`、`inherit_selection`、`per_object` 等作者属性。对象选择规则由真实引擎行为决定，不能让作者维护一份可能与引擎冲突的声明。

新增一个可复用的静态语义分析层，以统一 GDL AST、解析后的指令签名、owner 和原生规则注册表为输入，输出可定位、带证据、允许部分未知的执行摘要。MCP、源码校验和编辑器消费同一结果。

第一阶段交付：

1. instruction catalog 的结构化执行语义扩展。
2. GDL AST 到事件/指令/参数的完整源码映射。
3. 条件和动作按原生阶段执行的选择状态分析。
4. 面向 AI 的小范围事件解释工具，以及具备明确前提的 cardinality 提示。
5. 原生代码生成和真实运行时的差分验证夹具。

后续阶段：跨函数摘要、上下文相关的 Link 分析、行为相关 diff，以及可选运行时选择轨迹。它们不能通过虚构确定性来补齐第一阶段的覆盖率。

核心原则：**语法有效、分析完整、没有发现风险、运行时样例通过，是四个不同结论。**

## 2. 问题定义

### 2.1 当前语法已经解决的问题

显式 `event {}`、`conditions {}`、`actions {}` 和直接嵌套子事件，已经提供稳定的编辑边界。具名参数、单一函数文件、严格 schema、原始 JS 块，使 AI 可以进行有范围的修改。

本提案解决的是合法源码的行为理解问题。例如：

```gdl
function {
  name = "CollectCoins"
  functionType = "Action"

  events {

    event {

      conditions {

        collision { first_object = "Player" second_object = "Coin" }
      }

      actions {

        deleteObject { object = "Coin" }

        setNumberVariable { variable = "Score" modification_sign = "+" value = 1 }
      }
    }
  }
}
```

碰撞条件可能选中多枚 Coin。Delete 对选中的 Coin 执行，而普通场景变量加分不会仅因为 Coin 有多枚就自动逐枚执行。这里的“一次”必须限定在一次到达该动作的事件体执行中，不能泛化成每帧、每次函数调用或整个游戏的一次。

### 2.2 必须避免的错误抽象

- 不是所有条件都筛选对象：有些只计算真假，有些重新选择或扩展选择。
- 不是所有动作都只消费选择：Create、PickAllInstances、PickRandomInstance 可以改变后续选择上下文。
- 不是所有 standard 事件每帧最多执行一次：调用次数、父循环和当前 SignalReceived 专用生成逻辑都可能增加执行次数。
- 两个参与碰撞的对象选择列表不等于碰撞配对关系表。
- 一个 `for_each` 只收窄其迭代对象，不保证其他对象也成为一对一选择。
- 兄弟事件不继承前一个兄弟的临时筛选，但场景对象创建、删除和变量修改等副作用仍会影响后续事件。
- `inverted = true` 或 Not 不能一概解释为“选择集取补集”。
- `runtimeScene.getObjects()` 与 JS 事件传入的 `objects` 不具有相同的作用域和数组所有权。

### 2.3 当前 GDL 中表达逐金币处理

```gdl
function {
  name = "CollectCoins"
  functionType = "Action"

  events {

    event {

      conditions {

        collision { first_object = "Player" second_object = "Coin" }
      }

      for_each {
        object = "Coin"

        actions {

          deleteObject { object = "Coin" }

          setNumberVariable { variable = "Score" modification_sign = "+" value = 1 }
        }
      }
    }
  }
}
```

这个写法表达“在父事件选中的 Coin 中逐枚处理”。它并不表达“每一对 Player/Coin 碰撞都加分”，也不自动确定该给哪一位 Player 计分。多人游戏若修改 Player 的对象变量，还需独立设计玩家归属和配对处理。

## 3. 实现入口与证据

本节为静态代码调查结果，不代表本次重新运行过既有测试。下列路径均相对仓库根。

| 位置 | 已有能力 | 本提案的接入点或限制 |
| --- | --- | --- |
| `newIDE/app/src/ProjectsStorage/SettingsDsl/Syntax.js` | 统一 AST、源码位置、表达式与原始 JS 块 | 复用 AST；不能重新用文本正则分析事件 |
| `newIDE/app/src/ProjectsStorage/SettingsDsl/Events.js` | 事件编解码、结构校验、Else 邻接检查、JS 提取 | 编译目前主要返回原生事件数组；需新增独立映射产物，不能把分析字段写入模型 |
| `newIDE/app/src/ProjectsStorage/SettingsDsl/InstructionCatalog.js` | 精确类型、参数 DSL 名和值类型、严格版本 4 校验及结构化 semantics | 新语义字段必须有版本和验证；不能依赖额外属性被忽略 |
| `newIDE/app/src/Mcp/McpEventKnowledge.js` | 元数据查询、搜索、catalog 构建、示例和参数校验 | catalog 发布 known/partial/unknown 语义，不能把 partial 当作完整证明 |
| `newIDE/app/src/Mcp/McpEventTools.js` | 事件查找、revision、lint、局部修改及语义比较辅助 | 当前有基于指令名、参数和父 ForEach 的启发式，不是完整数据流分析 |
| `newIDE/app/src/Mcp/McpToolCatalog.js` | 当前公开 MCP 工具清单 | 已注册 analyze_gdl_events 和 get_gdl_instruction_semantics；实际覆盖见实施记录 |
| `newIDE/app/src/Mcp/McpEditorBridge.js` | `validate_project_files` 从磁盘重建、生成 catalog、校验并定位错误 | 新分析必须读同一磁盘快照，不能混用编辑器旧内存 |
| `newIDE/app/src/Mcp/McpProjectTools.js` | 结构、部分语义、JS 和生成代码检查；显式区分运行验证 | 接入独立 pickingAnalysis，保留现有 valid 含义 |
| `Core/GDCore/Events/CodeGeneration/EventsCodeGenerationContext.cpp` | 父子对象列表声明、复用及异步上下文 | 是规则审查依据，不应将生成器内部数组地址当语义身份 |
| `Core/GDCore/Events/CodeGeneration/EventsCodeGenerator.cpp` | 每个事件的上下文、兄弟隔离、Else 链和禁用节点处理 | 确认具体前处理规则，避免只根据 DSL 表面结构推导 |
| `GDJS/GDJS/Extensions/Builtin/CommonInstructionsExtension.cpp` | Standard、Else、逻辑条件、循环、Group、JS 生成器 | 原生调度与选择规则的核心证据 |
| `Core/GDCore/Extensions/Builtin/BaseObjectExtension.cpp` | Create、碰撞、选择类指令的签名和说明 | 精确参数角色、隐藏槽及创建后可见性证据 |
| `GDJS/GDJS/Extensions/Builtin/BaseObjectExtension.cpp` | 对象指令到 runtime 的绑定 | 对应指令与真实执行函数 |
| `GDJS/Runtime/events-tools/objecttools.ts` | 双列表筛选、重新选择、创建等执行逻辑 | 检查选择变化、对象组、反选和删除的实际边界 |
| `GDJS/GDJS/Extensions/Builtin/VariablesExtension.cpp` | 统一变量/属性 getter、setter 和值表达式生成 | 单次计分结论需绑定实际解析目标 |
| `GDJS/Runtime/runtimeinstancecontainer.ts` | `getObjects` 返回容器全部同名实例的 live list | JS 全实例访问与列表原地变化的依据 |
| `newIDE/app/src/ProjectsStorage/SettingsDsl/NativeEvents.spec.js` | 原生往返、OR、传入 JS 的选择和循环生成代码比较 | 扩充语义规则的真实引擎基线 |
| `scripts/test-unified-settings-runtime.cjs` | 将原生生成代码交给真实 GDJS 浏览器运行时 | 扩充行为断言，不以快照替代运行验证 |

### 3.1 已有 lint 应复用，但不能直接提升为确定结论

`lintSceneEvents` 已有 `create-without-for-each`、对象组使用、空逻辑条件、计时器等检查。其中创建提示使用有限指令白名单、名称正则、参数值与对象名比较，以及 inheritedForEachObjects。

局限：

- 字符串碰巧等于对象名，不能证明它是对象参数。
- 某个父 ForEach 遍历了一个参与对象，不能证明所有动作都获得所需基数。
- 只检查部分事件类型，会遗漏循环、自定义函数和 Link 中的同类问题。
- 目前 `compareSceneEventsSemantics` 主要规范化 JSON 并比较，不能证明任意重构的行为等价。
- 分组颜色、根分组要求与 picking 正确性无关，不应成为新语义分析的默认阻塞条件。

迁移这些规则时保留稳定旧规则 ID 的映射，避免同一问题同时返回旧、新两条提示。

### 3.2 调研发现的契约差异

**Else 邻接：** 当前 GDL 规范和 `Events.js` 要求原始混排列中的紧邻前支；持久化 comment 会打断配对。原生 `GenerateEventsListCode` 则跳过 disabled 和不可执行事件，并在向前寻找 Else 时同样跳过这些节点。两层不是完全相同的接纳规则。

本提案决定：第一阶段遵守当前 GDL 更严格的作者规则，对不合法源码先报原有结构错误，不生成“原生可运行所以合法”的替代解释。另列契约对齐事项；如果未来放宽邻接，必须同时评审 parser、规范、模型保存及生成器测试。不要在本提案中悄悄修改。

**公开工具边界：** 内部查找、lint 和元数据函数不等于公开 MCP 方法。新增能力必须显式注册到 tool catalog 和 bridge，并测试 schema、实际分派和文档一致。

## 4. 目标与非目标

### 4.1 必须达到

- AI 能回答某个动作在哪种执行上下文中、针对哪些对象、按什么基数执行。
- 每个静态结论能追溯到源码和已登记的规则。
- 未知选择数、调用次数和扩展副作用显式返回 unknown。
- 修改条件顺序、移动子事件、加入选择动作后，摘要能反映可能的行为变化。
- 从磁盘源码和从未保存编辑缓冲区分析时，明确区分快照身份。
- 第一阶段不改变任何有效 GDL 的运行行为或保存内容。

### 4.2 不在范围内

- 重写 GDevelop 代码生成器、表达式语言或 picking 机制。
- 证明任意游戏需求已实现、证明循环终止或任意 JS 的语义。
- 将所有社区扩展自动推导成精确语义。
- 自动把普通事件改成 ForEach。
- 新增事件级作者断言或通过注释配置运行规则。
- 第一阶段默认开启运行时插桩，或为每个事件创建持久 ID。

## 5. 术语与语义维度

### 5.1 四个必须分开的维度

| 维度 | 问题 | 示例 |
| --- | --- | --- |
| execution | 此代码区域何时、多少次被到达？ | 每次函数调用、每个父循环迭代、每个投递信号 |
| selection | 此时哪些实例在当前选择列表中？ | 继承、筛选后的 Coin、重新选择全部 Coin |
| invocation | 动作实现按什么单位调用？ | 每次到达动作一次、每个选中对象一次、自定义 |
| effects | 调用如何改变世界或后续选择？ | 删除对象、加分、创建对象并加入选择 |

“动作节点被到达一次”和“底层对象方法调用一次”不能混为一谈。Delete 节点一次到达可能调用多次实例删除方法；场景变量赋值不因此自动按目标对象数量重复。

### 5.2 世界状态与选择状态

分析状态分为 W 和 S：

- W：世界状态的保守摘要，包括对象可能创建/删除、变量可能写入、未知副作用。
- S：当前事件上下文中的对象选择摘要。

条件和动作的转移概念为 `(W, S) -> (W', S', result)`。不要求构造完整游戏状态，只追踪当前问题需要的事实。

兄弟事件的选择基线来自共同父上下文，不来自前一兄弟的 S'；但 W' 仍按原生执行顺序传递。不能将兄弟隔离描述为“全部状态恢复”。

### 5.3 选择状态

每个对象引用使用 owner 解析后的符号身份，不能仅用显示名称。组展开成成员符号，并保留原组引用。

```ts
type SelectionFact = {
  objectSymbol: string;
  origin: 'container' | 'parameter' | 'inherited' | 'filtered'
    | 'iteration' | 'created' | 'repicked' | 'merged' | 'unknown';
  materialization: 'not-materialized' | 'available' | 'unknown';
  cardinality: { min: number; max: number | null };
  membership: 'known-empty' | 'symbolic' | 'unknown';
  lineage: string[];
  reasons: string[];
};
```

- `max: null` 表示没有已证明的有限上界，不是无限多实例。
- `{min: 0, max: null}` 是合法的保守基数，不等于证明存在多个实例。
- 只有被证明成立的路径才能提升 min；不能因出现对象参数就假设非空。
- 不按初始布局数量推断运行中实例数，除非分析范围和不变量被明确限定且验证。
- not-materialized 表示该列表在当前路径尚未按原生规则请求，不等于空集。
- 当前 ForEach 对象在迭代入口可为 `{1,1}`，但后续 repick/create/未知调用可以使该事实失效。
- 对象组多个成员分别为 0/1 时，组总数仍需共享约束表示；不能把每个成员都写成恰好 1。

### 5.4 精度和覆盖

每项事实分别标记：

- `precision: exact | conservative | unknown`。
- `basis: registered-rule | derived | runtime-observation`。
- `ruleId`、规则版本及证据引用。

不要给“70% 正确”之类没有校准来源的概率。静态保守上界和运行时观察来自不同证据域，不相互覆盖。

## 6. 指令语义注册与 Catalog 契约

### 6.1 注册表

新增建议目录 `newIDE/app/src/EventsSemantics/`，独立于 MCP 和存储 UI。

- `InstructionSemanticsRegistry.js`：已审查指令规则。
- `EventExecutionRules.js`：事件类型及调度特例。
- `AnalyzeEvents.js`：数据流与摘要。
- `SourceMap.js`：AST 到语义位置。
- `Diagnostics.js`：规则前提、提示与去重。

这些是拟议模块名，实施时可遵循项目命名习惯调整，但职责边界不变。基础注册模块不得依赖 McpEventKnowledge，避免当前 catalog builder 经 MCP 导入形成新的循环依赖。

注册键包含 kind、精确 type、平台及必要的 owner/扩展身份。不能仅靠 displayed name、描述文本、type 正则或“含 object 参数”确定执行方式。

### 6.2 Catalog 版本

instruction catalog 当前为 7，发布结构化 `semantics`；GDL 作者格式为 18，GDL catalog 为 17。后续契约变化需独立评审版本。

- catalog 生成器、严格校验器、编辑器、deprecated delta 合并和所有消费者同时更新。
- 本地生成文件重建为新版本，不引入旧 GDL 作者格式兼容入口。
- 旧缓存不提供新的确定性结论，重建或显式报版本不匹配。
- 不新增第九个生成语义文件，避免与 instruction catalog 的快照失配。
- 语义字段只保存结构化事实，不加入通用 authoring prose。

根级增加 `semanticsVersion` 和 `semanticsRulesRevision`。每条 action/condition 都有 semantics，未覆盖条目显式 `status: "unknown"`。

### 6.3 拟议字段

```json
{
  "type": "CollisionNP",
  "semantics": {
    "status": "known",
    "ruleId": "builtin.collision.pair-filter",
    "ruleVersion": 1,
    "invocation": { "unit": "selection-lists" },
    "selection": [
      { "parameter": "first_object", "effect": "filter" },
      { "parameter": "second_object", "effect": "filter" }
    ],
    "worldEffects": [],
    "inversion": "specialized-rule",
    "relations": { "preservesPairs": false },
    "evidenceIds": ["gdjs.collision-picking.runtime"]
  }
}
```

参数使用该条目实际 `dslName` 引用；validator 必须检查引用存在且是兼容对象参数。JSON 为拟议形状，不表示已有字段或所有碰撞类型共用同一规则。

`invocation.unit` 枚举：`event-body`、`each-selected-instance`、`selection-lists`、`custom`、`unknown`。对 each-selected-instance 必须声明目标参数；自定义多目标调用必须单独登记组合策略，不能默认笛卡尔积或 zip。

`selection.effect` 枚举：`preserve`、`filter`、`replace-from-container`、`choose-one`、`append-created`、`custom`、`unknown`。

`worldEffects` 包括 `write-variable`、`create-instance`、`delete-instance`、`external-effect`、`unknown`；每个 effect 关联目标参数或符号解析规则。删除还需要独立的选择列表转移策略，不默认立即从所有列表清空该实例。

登记某条规则时必须同时给出正常、inverted、disabled、对象组及适用 owner 的支持状态。缺少反选规则时，仅该模式降为 unknown，不能直接套正向 filter。

`status: known` 指规则已覆盖所声明模式，不表示运行时数量确定；覆盖仅一部分行为时为 `partial`，逐维度列出 unknown。

### 6.4 第一阶段必需的规则覆盖

| 类别 | 必需处理 | 验证重点 |
| --- | --- | --- |
| CollisionNP | 双侧筛选、反选特例、列表结果不保留配对 | 多对多、自碰撞、相同组或重叠组 |
| 基础对象条件 | 明确登记的单对象筛选 | 不把所有对象参数条件视为 filter |
| NumberVariable 等已登记全局条件 | 布尔门控、选择保持 | 表达式读取对象不等于筛选对象 |
| Delete | 对选中目标逐实例副作用 | 删除后的列表与后续动作依引擎测试确定 |
| SetNumberVariable | 每次动作到达时修改解析后的变量 | 场景/全局/局部解析，不能只看裸变量名 |
| Create / CreateByName | 创建调用次数及新实例对后续选择的影响 | 列表已物化/未物化、动态名失败、目标组 |
| PickAllInstances | 条件与动作两种入口 | 扩大选择后撤销此前 singleton 等事实 |
| PickRandomInstance | 条件与动作两种入口 | 空输入、选择来源及随机性 |
| OR / AND / Not | 子指令与特殊转移 | OR 合并、布尔短路、反选不能取补猜测 |
| SignalReceived | sceneUpdate 专用调度 | 顶层、启用、非反选和匹配生命周期前提 |

首批规则必须以实际 catalog 里存在的精确类型登记。旧隐藏类型只有在 deprecated catalog 中存在且规则经过验证时才能复用相同规则。

## 7. 分析输入、快照与源码映射

### 7.1 输入契约

```ts
type AnalysisInput = {
  sourceSnapshot: SourceSnapshot;
  owner: ResolvedOwner;
  ast: UnifiedGdlAst;
  instructionCatalog: ValidatedCatalog;
  symbols: ProjectSymbols;
  dependencies: DependencyProvider;
  budget: AnalysisBudget;
};
```

SourceSnapshot 包含项目身份、来源 disk/buffer、入口和依赖内容摘要、catalog/规则版本。磁盘分析不得悄悄读取编辑器旧事件对象。buffer 分析不得报告为已保存源码。

快照摘要按规范排序的项目相对路径和原始内容哈希生成，保留 code 块的语义空白；不要只哈希序列化事件树，因为注释、位置和未保存内容也影响定位。

现有 `eventSheetRevision` 是原生事件 JSON 的 FNV 摘要，可继续用于既有接口；它不能替代完整的 source/dependency snapshot，也不能作为安全或无碰撞保证。

### 7.2 映射产物

扩展编译 API 或新增伴随 API，返回 `{events, sourceMap}`，保持原有 compileSettingsEvents 返回契约可用。

sourceMap 至少覆盖：owner、事件节点、conditions/actions/while_conditions 列表、递归 subInstructions、参数、flags、局部变量和 code 区域。

位置格式：项目相对 URI、UTF-16 offset 的半开区间；line/column 为 1-based，并与现有 Syntax 位置计算一致。外部客户端若采用 0-based，必须由适配层转换，不能混用。

事件路径以原始作者混排列表为准，包括 group/comment/link；指令路径还必须包含列表种类，避免 While 两个条件列表冲突。Link 展开后保留原始位置和调用位置链。

`aiGeneratedEventId` 仅作匹配辅助；重复 ID 不唯一，缺少 ID 也合法。稳定引用使用快照身份加 owner、AST 路径和范围，不能跨修改默认为仍然有效。

### 7.3 不完整源码

语法不完整时返回已有诊断及 `status: blocked`，可选只解释已完整且不依赖错误区域的子树。不能跨未闭合 JS 或事件块猜后续边界。语义结果标明覆盖范围，不能将局部结果描述为整文件通过。

## 8. 数据流和执行规则

### 8.1 基本算法

1. 解析并验证快照、AST、owner 和 catalog。
2. 构建作者节点到原生节点的映射及符号引用。
3. 建立原生阶段顺序：局部初始化、循环/调度规则、条件、动作、子事件。
4. 对每个条件和动作应用已登记转移函数，保留前后事实与 evidence。
5. 按原生上下文分析父子、兄弟、循环和逻辑分支。
6. 对未知影响进行限定范围的事实失效；范围未知则扩大到当前可见容器。
7. 生成诊断和有界摘要，报告覆盖率、截断和缓存身份。

事件成员阶段必须按属性、variables、while_conditions、conditions、actions、子事件顺序书写；乱序由解析器以 SETTINGS_EVENT_ORDER 拒绝。分析解释仍使用原生执行语义，各列表内部的作者顺序必须保留。

### 8.1.1 路径条件与合并

状态应带路径门控；条件失败的路径不进入本事件动作和子事件。布尔结果未知时保留可达与不可达两种可能，不能选择其中一支当作确定结果。

合并时，选择成员取保守并集，基数下界取有效路径中的最小下界、上界取最大上界；共享约束另行保存。不能将两个互斥分支各自的一个对象简单相加成两个对象。若任一可达路径存在未限定的副作用，相应事实需要降级。

世界副作用只在对应动作可达时应用；后续兄弟看到可能发生的副作用，而不是无条件发生的副作用。第一阶段不实现完整世界状态求解器，可以保守标记 may-create/may-delete/may-write。

### 8.1.2 表达式求值与目标解析

动作调用次数和表达式求值次数分开登记。对象方法动作的参数表达式可能在逐实例上下文中求值；普通变量动作中的对象表达式也不意味着该动作自动逐对象执行。

对象表达式使用当前对象、首个选中实例或其他策略，必须以原生表达式生成器为依据。涉及空选择、随机、函数表达式或未登记副作用时，不推断固定值，也不在分析中实际求值。

`SetNumberVariable` 等统一变量指令还可解析到属性等来源。规则必须结合真实符号解析结果决定 setter 和作用域，不将相同 type 的所有用途都写成“场景变量动作”。单次全局副作用诊断仅在解析目标满足其前提时生效。

### 8.2 Standard

在一次事件求值中，按原生规则初始化局部变量、顺序检查条件；通过后顺序执行动作，再执行子事件。条件短路和 flags 沿用引擎。

普通 standard 以每次进入其所在列表的执行为基线，但执行频率还需乘上函数调用、父循环和调度特例。未知调用次数保留符号量，不能输出“每帧一次”。

当前 SignalReceived 特例须独立规则：符合生成器条件时，一个 standard 事件按已投递信号逐次运行。嵌套在 OR、反选、禁用或非 sceneUpdate 的情况不能自动套此规则；规则匹配要与 `FindTopLevelSignalReceivedCondition` 一致。

### 8.3 父子与兄弟

- 子事件继承父动作完成后的选择及变量作用域，而非只继承父条件完成时的状态。
- 兄弟节点以共同父选择基线进入，并遵守世界副作用顺序。
- 不在父上下文中物化的对象列表，按原生首次访问策略处理；不能简单把所有对象预先填成“场景全体”。
- 原生数组复用是优化细节，不得解释为兄弟之间业务选择泄漏。
- 生成器对容器/Prefab/function context 的差异必须通过 owner 适配处理，不能统一写成 runtimeScene。

### 8.4 ForEach

迭代入口基于该处可用的目标对象选择；目标组需展开并保持组级约束。每次迭代当前目标 singleton，其他对象继续使用继承选择。

事件自身条件在迭代内部检查。把父碰撞条件移动进 ForEach 会改变筛选时机；不能把“把现有事件包一层 ForEach”和“在碰撞筛选之后加 ForEach 子事件”视为总是等价。

`order_by`、`order`、`limit` 仅在原生已登记组合下解释。新建/删除实例对迭代集合的影响以生成代码和运行测试为准，不从数组直觉推断快照或 live 迭代。

### 8.5 Repeat / While / ForEachChild

- Repeat 保留 count 的表达式求值时机与原生迭代上下文重建规则，字面次数也不能自动推出动作次数，因为内部条件可能失败。
- While 区分 while_conditions 与普通 conditions，按真实循环规则分析。有限迭代无法证明时 widening；不得静态执行游戏循环。
- ForEachChild 按变量容器迭代，不等价于对象 ForEach，不产生对象 singleton。
- 局部变量初始化位于循环内还是外，必须按各原生生成器分别登记。禁止统一套“每次迭代初始化”。

### 8.6 OR / AND / Not / inverted

OR 分支从原生定义的共同输入上下文分析，将满足条件分支的相关对象列表按原生逻辑合并去重。某分支未引用某对象时的列表初始化、保留或空集规则必须按真实代码验证，不能当成普通布尔 OR。

AND 按顺序传递选择。Not 和 inverted 的布尔结果、对象筛选、副作用分别处理；未覆盖模式降为 unknown。

多对象列表只记录各自成员事实。没有显式且验证过的关系模型时，不输出“每个 Player 对应某个 Coin”这种结论。

### 8.7 Else

先通过当前 GDL 邻接结构校验，再按原生 chainSatisfied 门控分析。Else 是前面分支未满足时的事件级分支，不是对每个未命中对象的逐实例补分支。

Else 的对象选择从其所属原生上下文求得，不能拿前一支筛选集求补。附加 conditions 继续按顺序分析。disabled 分支和 comment 邻接差异按 3.2 节处理。

### 8.8 Group、Comment 和 Link

Group 不建立新的业务条件或局部变量声明作用域，但其生成代码的列表上下文仍须按原生规则处理；不得为方便在分析器里无条件扁平化 group 后宣称选择完全等价。

Comment 无运行副作用，但仍是作者结构位置的一部分。`//` 不是事件节点。

Link 是调用点上下文中的展开，不是独立生命周期。分析以 `(fragment, caller-context)` 为键，保留调用链。独立分析片段时入口是 caller-dependent，不能假定全体对象。

第一阶段可将未展开 Link 标为局部 unknown，并列出目标依赖；第二阶段实现有预算、带环检测的上下文分析。未知 Link 若可能修改世界，其后摘要必须按影响范围失效，不能仅跳过。

### 8.9 JS 和未知扩展

JS 事件声明 `objects = "Player"` 时，按生成器传入当前上下文对象列表；未声明时不产生隐式同名绑定。对象组传入可能是成员列表合并，具体数组所有权按生成器区分。

`runtimeScene.getObjects("Player")` 访问容器全部同名实例，并返回引擎持有的 live list。删除时的迭代问题与 picking 问题分别说明。

第一阶段 JS 不做通用副作用证明。可以识别语法上确定的 API 访问并提示来源差异，但不能用“没有匹配 getObjects 字符串”证明代码保持选择。一般 JS 的世界和选择影响 conservatively unknown；实际作用域按生成包装和生成声明处理。

未知扩展、动态名调用、反射和异步 continuation 也是分析边界。可以保留与其无关且已证明不受影响的事实；没有可信 effect footprint 时，必须失效所有可能受影响的可见事实。

## 9. 面向 AI 的读取和解释接口

### 9.1 新增 `analyze_gdl_events`

公开只读分析工具，第一阶段以磁盘 GDL 为权威输入。逻辑请求：

```json
{
  "file": "scenes/Battle/functions/sceneUpdate.gdl",
  "event_path": [0, 1],
  "detail": "summary",
  "max_events": 40,
  "expected_snapshot": null
}
```

- `file` 必需，按现有项目受管理路径规则验证。
- `event_path` 可选，选择一个子树；即便只读子树也必须分析其父链和必要前序动作。
- `detail` 为 summary/steps；默认 summary。
- `max_events` 默认 40，最大 200；它是返回预算，不允许通过截断输入丢失前提。
- `expected_snapshot` 可选；不匹配则返回 stale，不用旧定位继续分析。
- buffer 支持通过编辑器内部适配接入，未来公开时另行定义，不能默默覆盖磁盘模式。

工具不写 catalog、不 reload、不运行 JS。缺失或过期 catalog 时返回 `catalog-stale` 和可执行的刷新建议；不得悄悄调用有写入行为的 generate-catalogs。

### 9.2 输出契约

```json
{
  "success": true,
  "status": "partial",
  "snapshot": "opaque-content-identity",
  "semanticsVersion": 1,
  "runtimeVerified": false,
  "coverage": {
    "analyzedEvents": 5,
    "knownInstructions": 7,
    "partialInstructions": 1,
    "unknownInstructions": 1
  },
  "events": [],
  "diagnostics": [],
  "unknownReasons": [],
  "truncated": false,
  "continuation": null
}
```

`status`：complete/partial/blocked/stale。complete 表示请求范围内语义规则覆盖完成，仍不表示动态数量确定或需求成立。确定规则下未知运行时数量不会自动使 status 变 partial；不支持的规则会。

每个 event summary 包含：

- 原始事件类型、owner、路径、源码范围和可选 ID。
- entry：父链、生命周期/调用上下文和对象选择来源。
- execution：触发门控、重复维度、局部变量初始化位置。
- conditions：按执行顺序的筛选/布尔效果。
- actions：每条的 invocation、目标选择、世界和选择副作用。
- childrenEntry：父动作之后传给子节点的事实。
- unknowns、依据 ruleId，以及与诊断关联的步骤 ID。

自然语言摘要从结构化结果确定性生成。默认不附整份事件 JSON、全部 catalog 或大段生成 JS；按需查询详细步骤。

### 9.3 Coin 示例应返回的解释

对于第 2 节的代码：

```text
一次到达此事件时：
1. 碰撞条件筛选 Player 和 Coin，实际实例数由运行时决定。
2. Delete 作用于当前选中的 Coin。
3. Score += 1 按本次事件体的执行到达一次，不随选中 Coin 数自动重复。
提示：如果需求是逐枚计分，应在碰撞筛选后的选择上下文中逐个遍历 Coin。
```

只有外层执行上下文也已知时，才能进一步写“每帧”或“每次信号”。不要把摘要中省略的上下文当作已证明。

### 9.4 精确指令查询

新增公开 `get_gdl_instruction_semantics`，或在实际存在的精确指令查询端点扩展输出；实施前必须确定唯一公开名称并同步 catalog/bridge。

输入 kind、精确 type，以及必要 owner；返回 catalog 参数、semantics、规则覆盖模式和简短 GDL 示例。第一阶段只做 exact query；全文意图搜索可以继续用现有生成 catalog，后续再公开有界搜索端点。

不能要求模型读取全部指令才能获得一条的选择语义，也不能返回旧原生位置参数模板作为唯一作者示例。

## 10. 诊断规则

### 10.1 通用结构

每条诊断包含 code、severity、message、source、relatedLocations、ruleId、precision、preconditions、unknownReasons，以及建议。唯一键由快照内位置、规则和对象符号决定。

提示不得推断用户意图；使用“如果需要逐对象……”而非“这一定写错了”。不默认自动修复。抑制通过调用参数或工具设置，不新增 `.gdl` 属性和魔法注释。

| Code | 默认等级 | 前提与含义 |
| --- | --- | --- |
| `GDL_MULTI_SELECTION_SINGLE_EFFECT` | info | 已知多对象选择可能性与已登记单次全局副作用并存，且存在语义关联，如删除选中 Coin 后加分 |
| `GDL_CREATE_AFTER_SELECTION` | info | 有对象筛选与单次创建；说明创建不会自动按筛选对象数重复 |
| `GDL_SELECTION_REPLACED` | info | PickAll 等替换此前选择，且后续动作依赖该对象；解释范围变化 |
| `GDL_FOREACH_OTHER_OBJECTS_MULTIPLE` | info | 迭代对象 singleton，但后续动作针对其他仍可能多选的对象 |
| `GDL_COLLISION_PAIRING_NOT_PRESERVED` | info | 后续处理依赖双侧对应关系，但目前仅能证明列表选择；前提不充分时不自动报 |
| `GDL_JS_CONTAINER_ACCESS` | info | 已可靠识别 JS 全容器访问，并且存在父筛选，提醒其不同于传入对象 |
| `GDL_SEMANTICS_UNKNOWN` | info | 请求范围中遇到未覆盖规则；默认按原因聚合，避免每行一条 |
| `GDL_SOURCE_EXECUTION_ORDER` | info | 非规范块排列容易掩盖真实执行顺序 |

原有结构错误如 `SETTINGS_ELSE_TARGET` 继续作为 error；不要换成 picking warning。未知扩展自身不使项目保存失败。

### 10.2 降噪

- 不对所有“有碰撞又有全局动作”的事件泛报；首批只覆盖已审查组合，例如删除与计分、筛选与创建。
- singleton 必须针对该动作真正关联的对象，并且在该动作之前仍有效。
- 若选择状态 unknown，不升级为“确定多对象”；可以解释 unknown，但不触发依赖已知语义的确定性提示。
- 没有 ForEach 不等于错误，有 ForEach 不等于正确。
- collision + create 常用于一次接触生成一个效果，保持 info，不作为默认阻塞。
- 对象组不是天然错误，不保留“所有组操作都危险”的泛化结论。
- 告警抑制只隐藏提示，不改变 coverage，也不能把 unknown 改成 known。

## 11. 校验与编辑器集成

### 11.1 `validate_project_files`

保持现有无参数接口及磁盘重建流程，在得到新鲜 catalog 和源码 AST 后执行静态分析。增加：

```json
{
  "pickingAnalysis": {
    "status": "partial",
    "snapshot": "opaque-content-identity",
    "runtimeVerified": false,
    "coverage": {},
    "diagnostics": [],
    "unknownReasons": []
  }
}
```

- picking info/warning 默认不改变现有 valid。
- `runtimeVerified` 保持 false，不能因没有 warning 变成 true。
- 规则实现抛异常时报告 analysis-failed，不吞成“没有问题”；是否结构有效由原有校验单独决定。
- 若基础源码解析失败，pickingAnalysis 为 blocked，保留原始解析位置。
- 大项目验证只返回有界诊断及摘要；通过分析工具分页查看完整结果。
- 当前工具描述关于生成文件数量已有口径差异；接入时按实际写入清单同步说明，不新增额外语义文件。

### 11.2 编辑器

第一阶段展示悬浮执行摘要、动作目标说明、子事件继承来源及 unknown 原因。不要把所有事实内联进正文形成噪声。

后续可在选中事件时显示条件前后选择变化、ForEach 目标与其他对象的不同基数。折叠标题可以突出 `for_each Coin`、`else` 和 SignalReceived 执行上下文，无需新增语法。

分析任务异步、可取消；新编辑产生新快照，旧结果不得覆盖新文档诊断。

### 11.3 AI 工作流程

1. 读取目标 GDL 和必要 owner。
2. 查询将用到的精确指令签名及语义。
3. 分析目标子树，包含父链和选择来源。
4. 进行局部源码修改。
5. 刷新因结构变化失效的 catalog，运行 validate_project_files。
6. 针对 picking、调度或动作次数变化执行真实预览/游戏测试。

不要求每次纯描述文字修改都启动预览；运行验证针对行为敏感变化。分析工具本身不自动执行修改或启动游戏。

## 12. 行为相关 Diff（第二阶段）

输入 before/after 两个完整快照，不将当前 JSON equality 升级包装成行为证明。报告：

- 条件次序变化及关联选择事实。
- 动作从单次变逐对象、或相反。
- 事件移动导致父选择、局部变量和调用频率变化。
- Create/PickAll/JS 加入后对后续选择的影响。
- Else 关系、Link 调用上下文变化。

结果为 unchanged-in-analyzed-dimensions / changed / unknown，附已比较的维度和未比较的维度。即使全部已分析事实相同，也不输出无条件的 semanticEquivalent:true。

对不唯一的事件 ID、重排和重复源码块，匹配不明确时返回 ambiguous；不为了生成 diff 强行建立对应。

## 13. 跨函数和扩展摘要（第二阶段）

函数签名可确定对象参数绑定，但不能单凭 Action/Condition 类型推断选择传播。

- 摘要至少区分输入对象选择、输出选择、世界副作用、返回布尔与调用次数。
- 函数实现摘要按原生调用边界验证，不能把函数调用当 Link 文本展开。
- 递归调用使用 SCC 和固定点，达到预算后 widening 为 unknown。
- 缓存包含函数源、依赖、扩展版本、catalog 和规则版本。
- 动态资源名、动态对象名只在可证明解析时精化。
- 社区扩展缺少可信规则时保持 partial/unknown；任意描述字段不能提升为已验证规则。

## 14. 可选运行时选择轨迹（第三阶段）

现有 preview snapshot 能观察对象状态，不能默认提供逐条件 picking 轨迹。新增轨迹需要代码生成插桩，属于独立实施范围。

建议采样点：事件入口、条件前后、动作前后、子事件入口。记录：runId、source snapshot、frame、event evaluation、循环/信号标识、源码步骤、对象符号和本次运行内稳定实例 ID。

要求：

- 默认关闭，仅开发预览开启；正式导出不包含插桩。
- 实例 ID 带运行身份，不能用可变数组下标代替。
- 分别记录选择列表成员和已删除标记，避免删除后的陈旧引用被误报成存活目标。
- 环形缓冲、事件/对象过滤、条数/字节预算，明确 dropped/truncated。
- 性能只承诺测量和预算，不在本 spec 虚构百分比开销。
- 轨迹采集不得改变原生条件顺序、随机调用次数、对象列表或调度行为。
- 同一 fixture 在插桩开/关两种模式下具有相同可观察游戏结果。

运行证据严格绑定测试场景、帧区间、输入序列和快照。一次轨迹证明观察到的实例行为，不证明所有可能输入。

## 15. 预算、缓存与故障

初始可配置预算建议：最多访问 10,000 个事件节点、50,000 条指令、Link/调用深度 32、每个固定点区域 8 次迭代；实现前用真实模板测量后确定默认值。这些不是现有性能实测结论。

- 复用 Syntax 的文件/深度预算，不引入无界第二次解析。
- OR 采用抽象合并，避免枚举所有布尔路径；必要时降低精度。
- 循环最多进行有界抽象迭代，不按真实 count 展开分析。
- 达到预算返回 partial 和具体原因，不能返回 complete。
- 缓存键包含来源快照、owner、依赖、catalog、平台和规则版本。
- 改组成员、函数签名、扩展或生命周期即失效相关摘要。
- 分页 continuation 绑定快照；变化后返回 stale，不拼接不同版本的结果。
- 取消和错误不写源码、不 reload、不执行用户代码。

## 16. 验收矩阵

### 16.1 规则与数据流测试

| 场景 | 必须观察或推导的结果 |
| --- | --- |
| 多 Coin 碰撞 + Delete + Score += 1 | 删除选中集合；分数按事件体到达次数增加，不按 Coin 数自动重复 |
| 碰撞父事件 + Coin ForEach 子事件 | 每枚入选 Coin 一次处理；未入选 Coin 保留 |
| 多 Player、多 Coin、交叉碰撞 | 不生成虚构配对关系；只确认列表及其作用范围 |
| Coin ForEach 内修改 Player | Coin singleton 不使 Player singleton；保留另一对象的基数 |
| 父条件 + PickAll 动作 + 子事件 | 子事件继承 repick 后的选择，原 singleton/filter 事实失效 |
| 父动作 Create 后子事件 | 新对象按引擎规则在后续可用；区分首次物化与已有列表 |
| 兄弟事件前者筛选、后者操作 | 不泄漏前者临时选择；保留世界创建/删除副作用 |
| OR 一支筛选 A、一支只判断变量 | 与真实引擎对象列表行为一致，不按普通布尔 OR 猜测 |
| Not / inverted / disabled 条件 | 布尔结果与对象列表分别验证 |
| 条件不成立的 Else | 不把 Else 当每个未选中实例的补集 |
| comment/disabled 插入 Else 前 | 明确区分当前 DSL 拒绝和原生透明规则 |
| Repeat、While、ForEachChild | 区分循环基数、内部条件及局部变量初始化时机 |
| 两个 SignalReceived 投递 | 符合专用生成规则时事件体执行两次；不被归类为每帧一次 |
| 嵌套 OR 中的 SignalReceived | 不自动套顶层调度特例 |
| JS objects 与 getObjects | 前者来源当前选择，后者全部同名 live list；副作用范围未知时失效 |
| 未知扩展修改当前对象 | coverage partial；不继续保留未证明有效的 singleton |
| 对象组、全局/局部同名对象 | 符号身份和组约束正确，不靠字符串碰撞解析 |
| Link 多调用点 | 结果绑定调用上下文，未展开时明确 unknown |

### 16.2 原生和运行时差分

每个首批已知规则都需要至少一个真实引擎夹具，验证：原生模型 → GDL → 原生模型 → 生成 JS → GDJS runtime。

将静态断言与运行时观测比较：实际目标必须落在分析的保守范围内；实际数量不得违反已声称的上下界。无法从现有 runtime 直接获取选择时，使用受控动作记录目标实例和变量结果，避免把生成代码文本比较当唯一证据。

Coin 夹具至少包括两枚碰撞金币和一枚远处金币，分别验证原写法与 ForEach 写法的计分差异；多 Player 夹具验证未选中实例未受影响。测试记录每次进入事件的次数，排除反复逐帧触发造成误判。

### 16.3 API、存储和定位

- 新 MCP 名称出现在公开 catalog，有 schema、bridge 分派、错误和预算测试。
- 磁盘与 buffer 快照不混用，stale 请求明确失败。
- 精确定位多字节字符、UTF-16 surrogate pair、多行表达式、嵌入 JS、递归子指令。
- while_conditions 与 conditions 相同索引不会混淆。
- 分析不修改 `.gdl`、不输出 `.events`、不增加原生模型字段。
- Catalog 新版本的构建/校验/deprecated merge/保存重开一致。
- unknown 和抑制不会使 valid/runtimeVerified 语义发生变化。
- 未保存、无磁盘位置、缺失依赖、catalog 过期、预算不足均有可操作错误。

### 16.4 规模与稳定性

使用现有 3,000 事件基线、真实官方模板、深 OR、长 Link 链和大 JS 块测量延迟、内存与输出字节。将实际数据写入独立实施报告。

相同快照和规则下，输出除明确时间字段外可确定性比较。默认响应有界，未知原因聚合，不输出全项目大 JSON。

## 17. 实施阶段与完成标准

### P0：契约和原生行为基线

- 逐项登记选择类指令、对象方法动作、创建、变量和 SignalReceived。
- 建立 Else 规则差异的测试和问题记录，不改变作者语法。
- 明确首次列表物化、删除后列表、对象组和反选行为。
- 同步当前教学入口的版本说明。

退出标准：没有靠名称猜测的 known 规则；每条首批规则有原生证据和预期夹具。

### P1：Catalog、源码映射和基础分析

- 协调升级 instruction catalog。
- 建立旁路 sourceMap、四维事实、Standard/ForEach/基础循环分析。
- JS、未知调用、未展开 Link 等边界正确失效。
- 暂不暴露未经验证的“行为等价”或自动修复能力。

退出标准：16.1 的首批覆盖通过；未知情况保守退化；GDL 保存行为不变。

### P2：AI 工具与校验集成

- 注册 analyze_gdl_events 和精确语义查询。
- 接入 validate_project_files 和编辑器悬浮摘要。
- 迁移重叠 lint，新增低噪声 cardinality 提示。
- 提供 GDL 示例与 AI 工作流程说明。

退出标准：可从单个源码事件定位、解释、修改后重查，并获得同快照的可追溯结果。

### P3：跨 owner 摘要与行为 Diff

完成函数调用、Link、递归固定点、变更影响和歧义处理。覆盖所有支持 owner，而非仅 sceneUpdate。

退出标准：调用点相关性正确，无法证明等价时返回 unknown。

### P4：运行时轨迹

独立评审插桩设计、性能、run 内实例身份及采样 API，不将其作为基础静态分析上线的前置条件。

## 18. 主要风险和应对

| 风险 | 应对 |
| --- | --- |
| 规则与代码生成器漂移 | 规则版本绑定引擎证据；真实生成与运行夹具作为发布检查 |
| AI 将 partial 当通过 | 顶层状态、逐项 unknown、runtimeVerified=false；摘要直接说明覆盖边界 |
| 按对象参数推断逐实例执行 | invocation 必须显式登记；元数据仅提供候选角色 |
| 选择事实跨 Create/JS/异步错误保留 | effect footprint 和保守失效，不追求虚假的覆盖率 |
| 泛化 lint 造成噪声 | 已验证模式、info 默认、聚合和外部抑制；不自动改循环 |
| 模型态与磁盘态混用 | 完整快照身份、明确来源、stale 检查 |
| 把分组扁平化误当等价 | 保留原生上下文，行为 diff 单独验证 |
| 分析范围爆炸 | 抽象合并、有界固定点、依赖缓存、明确预算截断 |

## 19. 最终设计取舍

GDL 继续作为原生事件模型的明确、可编辑源码。执行语义由与引擎对齐的结构化规则提供，AI 通过有界查询获得当前事件的具体解释。

实现成功的标准不是“所有事件都有一段看起来合理的说明”，而是：已知部分有原生证据，未知部分不会被掩盖，源码修改造成的选择和执行次数变化能被发现，并能用真实运行行为检验。
