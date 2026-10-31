# 将兼容指令拆到独立 catalog

版本说明：本文版本号记录该次变更的历史基线与升级过程，不代表当前版本。当前作者格式为 18，GDL catalog 为 17，instruction catalog 为 7；以 [GDL 当前规范](settings-dsl-spec.md) 及其列出的代码常量为准。

状态：已批准。

## 问题与目标

当前三个按种类划分的 instruction catalog 将正常作者指令和额外的 deprecated、hidden 兼容指令合并，使用者无法直接排除兼容条目。将所有额外兼容指令集中写入一个独立文件，让三个种类文件只包含正常作者指令，同时保留旧项目的无损读取和序列化能力。

## 当前行为

`buildProjectDeprecatedInstructionCatalog` 计算完整元数据相对于作者 catalog 的差集；原生项目导入还可能追加用于保留旧数据的推断指令。`serializeInstructionCatalogFiles` 将差集合并到三个种类文件。读取方校验并组装三个文件。旧的 `.gdevelop/deprecated-instructions-catalog.json` 被列为待清理文件。

## 方案与数据契约

继续输出 `.gdevelop/conditions-catalog.json`、`.gdevelop/actions-catalog.json`、`.gdevelop/expressions-catalog.json`，每个文件仅含对应种类的作者指令。新增 `.gdevelop/deprecated-instructions-catalog.json`，集中保存所有额外的 deprecated、hidden 和旧数据兼容指令，分别放入 actions、conditions、expressions 数组。沿用内部完整 catalog 的结构、逐条单行与确定性排序；包含版本、语义版本、规则修订、源指纹和各类计数。即使没有额外条目也输出空文件。兼容文件不必区分 deprecated 与 hidden 来源。

按现有身份规则去重：action 和 condition 使用 type，expression 使用 type 与 returnType；同身份的作者条目优先，额外文件只存差集。保留条目的参数、owner、DSL 名及语义。逻辑 instruction catalog 版本从 6 升至 7；作者格式、GDL catalog 和事件语义版本不变。

读取时校验四个文件的格式、版本、计数、种类及共同源指纹。完整视图合并四文件，供旧指令解析、转换和语义分析；明确请求作者视图时只组装三个种类文件，补全和作者指令发现使用作者视图。写入、加载和消费方须明确选择视图，避免隐式丢失旧项目数据。文件不完整或不一致时提供指向具体文件的诊断。

项目技能文件必须明确告知 AI：兼容 catalog 仅用于理解和阅读旧项目已有指令，不得从中选择或引入指令来编写新的事件逻辑。正常指令发现和编写使用三个作者 catalog；MCP 查找也须支持遵守这一边界。

## 影响范围

调整 `SettingsDsl/InstructionCatalog.js` 的路径、序列化、校验与组装；调整 `EventsSemantics/InstructionSemanticsRegistry.js` 版本；追踪 `LocalProjectWriter.js`、`LocalMultiFileProject.js`、MCP 读取和查找、文件观察与补全等消费者。普通保存、generate-catalogs、校验再生成和原生导入均输出四文件；将新兼容文件从清理列表移除。同步当前规范及项目模板指导。保留工作区已有的无关修改。

## 兼容、迁移与发布

四文件作为一个版本化整体发布，不将旧三文件视为新格式，也不双写旧格式。升级后需要重新生成 catalog；保留现有无需读取生成文件的 bootstrap 再生成路径。先成功写入并验证新集合，再清理已退役的 `instructions-catalog.json`。不更改项目作者语法、原生 type、参数或执行语义。

## 性能与错误处理

继续复用现有元数据枚举及差集构建，拆分与合并为线性处理并保持稳定排序；增加一次小文件读写。缺失、损坏、版本或指纹不匹配时拒绝将不一致的文件集作为完整视图，并提示再生成；不能默默忽略兼容文件。

## 测试与发布验证

覆盖分类文件不含额外指令、兼容文件包含全部三类差集及旧数据推断条目、重复身份处理、确定性输出与完整/作者视图往返。覆盖缺失、格式错误、版本和指纹不一致。验证所有生成入口、缓存、旧项目转换、补全与 MCP 消费者；更新相邻回归测试和模板文档。代码完成后按仓库要求运行相关检查并后台启动 macOS 构建与启动脚本，只确认进程已创建。

## 非目标与备选方案

不改变指令本身的可用性或执行行为，也不为每种类各建一个兼容文件。保留兼容条目在种类文件中并添加标签无法满足集中隔离的目标，因此不采用。

## 待确认

无阻塞设计问题；文件名复用先前退役的兼容 catalog 路径，版本升级用于区分新契约。
