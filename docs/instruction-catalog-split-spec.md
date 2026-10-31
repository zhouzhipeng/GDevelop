# Instruction catalog 按指令种类拆分

版本说明：本文版本号记录该次变更的历史基线与升级过程，不代表当前版本。当前作者格式为 19，GDL catalog 为 18，instruction catalog 为 7；以 [GDL 当前规范](settings-dsl-spec.md) 及其列出的代码常量为准。

状态：历史契约，已由 [兼容指令拆分规范](instruction-catalog-compatibility-split-spec.md) 取代。

## 问题与目标

当前 `.gdevelop/instructions-catalog.json` 混合发布 conditions、actions、expressions，另有 `deprecated-instructions-catalog.json`。查找单一种类需要读取混合文件，生成产物没有按用途隔离。

改为恰好三个 instruction catalog 文件，生成代码、读取代码、测试与文档同步更新。不考虑旧文件兼容性。GDL catalog、TSL catalog 与声明文件不属于这三个文件的计数。

## 文件与数据契约

新文件名固定为：

- `.gdevelop/conditions-catalog.json`
- `.gdevelop/actions-catalog.json`
- `.gdevelop/expressions-catalog.json`

每个文件具有独立 format `gdevelop-gdl-instruction-kind-catalog`、formatVersion 1、kind（condition/action/expression）、共同的 instructionCatalogVersion、semanticsVersion、semanticsRulesRevision、sourceFingerprint，以及 entries 和 count。entries 只包含对应种类，保留现有每条指令的参数、owner、DSL 名与语义信息；仍每条 entry 一行，保持稳定排序和确定性输出。

instruction catalog 逻辑契约从 5 升至 6，权威常量仍由 InstructionSemanticsRegistry.js 管理。作者格式、GDL catalog 和事件语义版本不因文件拆分升级。

当前 authoring 和 deprecated catalog 的内容按种类合并到这三个文件，不再生成第四个 deprecated 文件。文件不标记作者可用性；兼容旧数据的条目与其他条目一起提供给读取方。同种类内按现有原生类型及 owner 身份去重，不覆盖作者条目。

加载三文件后重建内部 conditions/actions/expressions 视图，现有解析器与语义分析可继续共享内存索引；该内存视图不是额外生成文件。

## 生成、加载与错误处理

普通保存、generate-catalogs、校验时再生成和原生项目导入全部调用同一拆分序列化入口。三文件使用相同源指纹；缓存命中也必须确保三文件全部生成并验证成功，才报告 catalogsRegenerated。

常规读取要求三个文件全部存在，检查 kind、版本、条目、计数及共同指纹，拒绝缺失、重复种类、种类错配、版本/指纹失配和非法 JSON，诊断指向具体文件。保持现有有界读取和路径安全检查。现有明确忽略生成 catalog 的引擎元数据 bootstrap 路径保留，用于再生成。

成功写完并验证三个文件后，清理旧 instructions-catalog.json 和 deprecated-instructions-catalog.json。不得读取旧文件作为回退，不做双写或迁移。手工仅保留旧产物的项目需要执行再生成。

## 影响层与实施文件

- SettingsDsl/InstructionCatalog.js：路径、按种类序列化/验证/组装，authoring 与完整序列化视图区分。
- EventsSemantics/InstructionSemanticsRegistry.js：instruction catalog 版本常量。
- LocalFileStorageProvider/LocalProjectWriter.js：所有生成入口、缓存、写入验证、旧产物清理和返回统计。
- LocalFileStorageProvider/LocalMultiFileProject.js、Mcp/McpGdlSemantics.js：统一读取三文件。
- MCP bridge、工具描述与相关返回字段：修正产物路径、文件数量与生成成功条件。
- 项目文件观察、补全绑定及其他引用旧路径的消费者：追踪并同步更新。
- docs/Architecture.md、当前 GDL 规范、项目模板 README、PROJECT_STRUCTURE、AGENTS.md、gdevelop-project-files skill 及 references：列明三个文件及按种类查询方式。历史实施报告保留历史版本说明，明确当前契约链接。

## 范围、性能与发布

不改变指令原生 type、DSL 名、参数、执行行为、对象选择语义或项目作者语法。不修改用户已存在的其他工作区改动。

元数据枚举保持一次，拆分和组装线性执行，避免按种类重复构建引擎 catalog。条目不重复存储，三个 JSON 文件只增加少量文件系统操作。随编辑器改动一次性发布，无兼容阶段。

## 验证

- 序列化三个文件各含且仅含目标种类；所有条目按身份无损往返，输出确定且逐条单行。
- 三文件缺失、错配、非法条目、版本及源指纹不一致均给出可定位诊断。
- 普通保存、缓存命中、generate-catalogs、校验再生成和原生导入均生成三个文件，并清理旧文件。
- 加载后的 GDL 编译、补全、事件语义分析及已弃用原生指令序列化保持正确。
- 更新 LocalMultiFileProject、InstructionCatalog、MCP、文件观察和补全等相邻回归测试；运行受影响文件格式及静态检查。
- 完成代码检查后按仓库要求后台启动 macOS 实际构建及启动脚本；仅报告启动进程派发状态。

## 备选与待确认

保留合并文件再添加三份会制造重复事实源，不采用；每种类再单独输出 deprecated 文件会超过三个文件，不采用。

方案默认 deprecated 元数据纳入对应种类文件，并显式区分作者可用性；没有其他阻塞设计问题。
