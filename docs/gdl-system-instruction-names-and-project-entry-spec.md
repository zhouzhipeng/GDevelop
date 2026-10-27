# 系统指令固定短名与 project.gdl 项目入口

- 状态：用户已批准，代码与作者文档已实施；桌面构建/启动由后台脚本单独执行。
- 日期：2026-10-27。
- 用户范围：系统指令固定短名映射；第三方与用户指令暂不处理；项目入口改为 project.gdl；代码、catalog、补全和 AI 作者文档统一使用 catalog 中的作者名称。
- 变更前基线：作者格式 12、GDL catalog 10、instruction catalog 4。
- 实施版本：作者格式 13、GDL catalog 11、instruction catalog 6。

## 1. 问题与目标

当前 GDL 直接使用原生 instruction type，命名空间和历史标识增加作者及 AI 的阅读与输出成本。项目入口已经采用 GDL 语法，却保留 project.gdevelop 后缀。

分析样本为用户提供的 SVG UI Playground/.gdevelop/instructions-catalog.json（当时的合并文件）：863 个 actions、576 个 conditions、582 个 expressions；action/condition 名称长度中位数分别为 30/29 字符。仅取命名空间末段会分别产生 62/60 组重名，不能作为可靠的作者名称。

目标：由引擎维护固定系统指令名称，catalog 发布唯一作者名称，原生标识继续服务原生事件模型及代码生成；统一项目入口文件为 project.gdl。

非目标：第三方/用户指令自动缩写、哈希命名、项目 alias map、文件 use/import、参数改名、表达式改名、JS API 改名、对象选择或事件运行语义变更。不修改用户提供的样本项目及其生成 catalog。

## 2. 系统短名的权威来源

新增纯数据模块，建议路径为 newIDE/app/src/ProjectsStorage/SettingsDsl/SystemInstructionNames.js。维护 action 和 condition 两个固定映射，以原生 kind、type 和注册 owner 身份精确匹配；禁止从翻译文案或当前枚举顺序推导短名。

系统范围为随引擎发布的平台内置指令和仓库自带 JS 扩展指令，排除从项目或社区安装的 events-based 扩展。实现时从真实注册链确定身份，不通过 Builtin 前缀推断，也不把样本项目的全部指令认作系统指令。

映射表中的显式系统条目是权威来源；不在表内的指令保持原生 type。对维护的系统注册清单增加覆盖检查，新系统指令需同时提交固定名称；项目加载不因未安装的系统扩展报缺失。第三方即使命名与系统相似，也不能借用该系统映射。

短名使用合法 ASCII 标识符，采用可读 lowerCamelCase，不强制六字符上限。使用所属领域前缀解决同 kind 重名，例如 audioPlay、videoPlay；不使用流水号或哈希解决系统名称冲突。已发布映射不能随 catalog 刷新改变。

代表性命名方向（最终完整固定表在实施时随源代码提交并经过覆盖与冲突测试）：

| 原生 type | 作者名称 |
| --- | --- |
| SetNumberVariable（action） | setNumberVariable |
| CollisionNP（condition） | collision |
| DebuggerTools::ConsoleLog（action） | log |
| AddForceXY（action） | addForceXY |

action 和 condition 各自拥有名称空间，因为源码已经由 actions/conditions 分块。同一 kind 内不得有短名互相冲突，或短名遮蔽另一指令原生 type；不得由后注册者覆盖前者。冲突错误包含 kind、短名、双方原生 type 和 owner。

## 3. catalog、解析与规范输出

actions 和 conditions 中每条记录新增必需字段 dslName：系统指令使用固定短名，其他指令使用原生 type，后者允许现有的 :: 分隔格式。已有 name 继续表示显示名称，不能改变其含义；参数 dslName 完全不变；expressions 结构及 {{...}} 不变。

示例：

```json
{
  "type": "DebuggerTools::ConsoleLog",
  "dslName": "log",
  "parameters": [
    {"dslName": "message_to_log", "type": "string", "valueKind": "text"}
  ],
  "owner": {"extension": "DebuggerTools"}
}
```

参数元数据沿用实际生成结果，示例不改变任何参数契约。

```text
actions {
  log message_to_log="Start"
  setNumberVariable variable="Score" modification_sign="+" value=1
  SvgUI::SvgUIObject::SetNodeText svg_ui="Panel" element_id="title" text="Ready"
}
```

resolver 建立原生 type 和作者 dslName 的独立索引，先统一校验歧义，再进行精确解析。允许在当前格式文件中显式使用原生 type，作为 catalog 可追踪的精确入口；formatter 一律输出 dslName。该规则不是旧格式读取或迁移器。内部 AST 到原生模型的投影、semantics 规则键和代码生成仍用原生 type。

对任何输入名称，解析出的原生 instruction.type 必须与旧精确调用相同，参数顺序、默认值、inverted、awaited 和子指令保持不变。解析失败禁止模糊匹配或自动选择候选。

补全显示并插入 dslName，详情保留 type、owner 和说明；具名参数补全可识别两种精确名称。语义查询工具仍允许精确原生 type，增加短名解析并返回两种身份；分析和诊断同时提供作者名称及原生标识，不能破坏已有机器可读字段。

## 4. project.gdl 与版本契约

唯一受管理项目入口改为 project.gdl，URI 为 game://project.gdl；内部仍为 project 根，其他组件所有权不变。入口名称及 URI 从统一常量导出，避免各消费者继续硬编码。

作者格式升级至 13；GDL catalog 升级至 11；instruction catalog 升级至 5。各自在现有权威常量位置更新，不把独立版本域合并。semanticsVersion、semanticsRulesRevision 和模块地图版本在其结构/语义未变时保持不变。

遵循现有项目的最新格式策略：不增加 project.gdevelop 双读、双写、自动重命名或旧格式迁移器。旧入口和旧格式给出明确不支持诊断，不能退化为普通 JSON 项目导入。已有原生模型导入功能保留其现有边界，不成为旧 GDL fallback。

已有磁盘项目需要用户另行决定如何转换，本任务不自动改写用户 Documents 下的项目。最近项目里指向旧入口的记录不能被悄悄重定向或删除。

项目发现必须识别精确 basename project.gdl；不能把所有 .gdl 都当项目。入口内容仍需通过格式和 project 根校验。桌面文件关联可改为 .gdl，但打开其他组件文件时必须有明确路由/诊断，不得作为项目解析。

所有保存与恢复协议保持原子性：project.gdl 仍最后提交；资源安全、路径/符号链接限制、生成文件排除和临时文件恢复不变。两种入口共存时不猜测或合并，报入口冲突。

## 5. 影响层及文件

| 层 | 主要检查点 |
| --- | --- |
| catalog 生成 | Mcp/McpEventKnowledge.js；新增固定映射模块；隐藏/废弃 catalog 的对应生成路径 |
| catalog 校验、解析、格式化 | ProjectsStorage/SettingsDsl/InstructionCatalog.js、Events.js 及相邻测试 |
| 版本、schema、项目 catalog | SettingsDsl/SchemaInventory.js、ProjectSourceCatalog.js、EventsSemantics/InstructionSemanticsRegistry.js |
| 编辑器补全 | CodeEditor/SettingsInstructionCompletions.js；路径发现、名称插入、参数查询 |
| 项目存储与发现 | MultiFileProjectFormat、LocalFileStorageProvider、ProjectModuleMap、ProjectsStorage/index.js、MainFrame 文件监听 |
| 桌面入口 | electron-builder-config.js、ProjectFileOpenHandler、文件选择过滤器、启动参数、打包模板及相关测试 |
| MCP | McpEditorBridge、McpToolCatalog、McpGdlSemantics、语义查询、创建/重载/保存项目与校验工具 |
| AI 作者文档与模板 | gd-project-template 内 skills、references、AGENTS.md、项目结构文档和生成示例 |
| 仓库文档与脚本 | AGENT.md、docs/Architecture.md、GDL 规范入口与相关现行专题、创建/启动/校验脚本 |

实施时通过全仓检索补齐调用点。历史文档保留历史事实并标注适用版本，不能用盲目全局替换篡改历史记录。已有未提交修改必须保留并在当前内容上局部编辑。

## 6. AI 使用契约

AI 优先使用当前项目 catalog.actions/conditions 的 dslName 和参数 dslName，不能自行缩写或把显示 name 当作可执行名称。第三方和用户指令的 dslName 等于完整 type，因此使用相同规则，不需要 AI 自行判断来源。

原生 type 只用于精确查询、诊断和底层身份定位。所有生成 GDL 示例、MCP 返回示例、补全、formatter 和项目模板使用作者名称；不能只更新文档而继续由保存器输出长名。

catalog 仍是生成文件，不要求 AI 手工维护或直接修改。工具负责在项目创建、保存和扩展重载后按现有生成流程刷新 catalog，并对不支持版本给出重建提示。

## 7. 性能与错误处理

固定映射查找及名称索引构建为 O(N)，单条指令解析为 Map 精确查找；不增加网络请求、运行时代码或每条指令的全表扫描。每条记录新增一个字符串的磁盘开销可接受，不承诺未经测量的模型响应提速。

校验覆盖缺失/非法 dslName、重复作者名称、作者名称与原生标识交叉冲突、错误 owner、缺少系统映射及不支持版本。错误应定位来源和相关身份，不静默回退到另一指令。

## 8. 实施顺序与验证

1. 审批本规范；确定系统注册清单并提交完整固定映射及其覆盖测试。
2. 更新 catalog schema、双索引解析和短名规范输出，验证原生往返等价。
3. 统一 project.gdl 常量、项目打开/保存/发现/恢复、MCP 和桌面关联。
4. 更新 AI 文档、模板、示例及版本；重新生成仓库要求的生成输出，不手改用户项目 catalog。
5. 运行相关测试和类型/格式检查；按 AGENT.md 启动 macOS 后台构建与启动脚本后结束，不等待或报告最终构建成功。

必要回归：

- 系统映射覆盖、名称稳定、不同加载顺序及第三方扩展安装不改变短名；系统来源/owner 精确匹配。
- 同 kind 冲突拒绝、跨 kind 同名正常；短名遮蔽原生 type 的冲突拒绝。
- 每条系统 action/condition 的两种名称解析为相同原生身份，formatter 只输出 dslName；第三方和用户指令名称原样保留。
- 参数、表达式、semantics、异步和子指令行为不变；旧版本 catalog 明确拒绝。
- 补全插入短名、短名具名参数补全、MCP 精确查询和分析一致。
- 新项目实际创建 project.gdl；拆分/组合往返、保存恢复、入口最后提交、扫描排除和文件监听正确。
- 旧入口及双入口明确拒绝；普通 scene.gdl 不误判为项目；桌面路径与 Windows 路径测试更新。
- 检查现行 AI 文档和可执行脚本无过期入口，所有作者示例以新 catalog 解析验证。

## 9. 备选方案及待确认边界

不采用项目 alias map 或文件 import，避免分散作者名称；不自动缩写第三方名称，遵循本次用户范围；不缩短参数或表达式，避免扩大语言变更。

本提案将“优先使用短名”解释为允许精确原生名称输入、统一短名输出，而非彻底禁止原生名称。旧项目入口不提供兼容读取，这是现有仓库策略的延续。上述两点均纳入本规范审批范围。

## 10. 实施与验证记录

固定映射已覆盖当前注册清单的 1,817 条系统指令（1,090 actions、727 conditions，
包括隐藏/废弃条目）。代表名称为 setNumberVariable、collision、log、addForceXY。
解析支持 dslName 和精确原生 type，规范输出、补全和 AI 作者示例优先使用 dslName；
语义分析保持原生 instructionType 并增加 dslName，精确语义查询支持两种名称。
第三方/用户指令、参数和表达式名称不变。共享入口常量位于 ProjectEntry.js。

验证日期：2026-10-27。未修改用户 Documents 下的样本项目或生成 catalog。

- 相关 Jest 回归覆盖 38 个套件、505 个用例及 5 个快照。
  合并运行 504/505 通过；唯一失败是新增系统清单测试未统一隐藏指令过滤配置。
  修正该测试配置后，单独重跑 SystemInstructionNames.spec.js，3/3 通过。
  覆盖系统名称完整性/冲突、原生往返、第三方扩展安装稳定性、静态语义、MCP 短名查询、
  新项目创建、官方模板往返、保存恢复、旧入口拒绝、双入口保护、补全和文件监听。
- `node --test newIDE/electron-app/test/McpRendererRequestBroker.spec.js`：1/1 通过。
- 对本次涉及的 46 个编辑器 JavaScript 文件执行 ESLint（--max-warnings=0）和
  Prettier 检查：通过；`git diff --check` 通过。
- `npm run flow -- check --max-workers 2`：未通过，全仓报告 645 项错误。
  完整 JSON 诊断再次检查同为 645 项；不将本次结果描述为全仓类型检查通过。
- macOS 桌面完整构建及启动按 AGENT.md 使用后台脚本派发；不等待、监控或宣称最终成功。

后续维护系统指令时必须同时更新固定映射并执行覆盖测试；不允许在项目加载时自动生成新短名。

当前 instruction catalog 文件契约见 [按种类拆分规范](instruction-catalog-split-spec.md)（逻辑版本 6）。
