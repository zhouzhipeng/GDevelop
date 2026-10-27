# GDL 事件语义分析：首版实施与验证记录

日期：2026-10-27。基线提交：`6100c9c942550e5e312d73a720fc7414e1e2b758`。结果针对当前工作区，未创建提交、安装包或部署。

对应 [已批准的 spec](gdl-event-semantics-analysis-spec.md)。本次交付是基础静态分析链路，不代表 spec 中所有高级规则和后续阶段均已完成。

## 已实施

- 保持 GDL 作者格式 13、GDL catalog 11；instruction catalog 升为 4，增加语义版本、规则修订和每条指令的 known/partial/unknown 契约。
- 独立 `EventsSemantics` 模块提供规则注册、源码映射、选择状态、执行维度、项目上下文及聚合分析；不将分析字段写入原生事件模型。
- 精确类型和实际 catalog 参数决定规则，不根据指令名正则或参数字符串猜测对象角色。
- 项目打开入口检查主/废弃指令 catalog 的版本和语义契约；遇到旧生成 catalog 时自动重建，保留当前 GDL 源文件不变。
- 对已登记的正向 CollisionNP、Delete、变量写入、PickAll/PickRandom 等提供基本解释；处理 ForEach 的目标基数、父动作后的子事件入口、兄弟选择隔离和世界副作用。
- 新增 `compileSettingsEventsWithSyntax` 伴随 API，原 `compileSettingsEvents` 返回类型保持不变。修正无子块指令的源码范围，使其包含完整参数和多行表达式。
- 源码映射区分两个 While 条件列表，覆盖递归子指令、参数、flags、局部变量和 JS 原始区域。事件路径包含 group/comment/link。
- 低优先级提示覆盖多对象删除与单次变量副作用、筛选后创建、选择替换，以及 ForEach 中对其他多选对象的操作。提示不会阻止保存，也不自动插入循环。
- 新增公开只读 `analyze_gdl_events` 和 `get_gdl_instruction_semantics`，注册 schema、bridge、示例和权限清单。精确查询返回规则实现及测试证据路径。
- 基于声明指纹检测 catalog 过期，基于源码内容快照拒绝过期定位。只改事件正文不要求刷新指令签名 catalog；改变声明后显式要求 generate-catalogs。
- 分析工具不写源码、catalog 或编辑器内存，不执行用户代码。新增只读源码树读取模式：发现待恢复事务时停止，不触发自动恢复，也不重置编辑器的 settings 类型注册。
- `validate_project_files` 增加独立 pickingAnalysis。通过 `openMultiFileProjectWithSources`，结构验证、JS 检查和 picking 分析使用同一份实际读取的源码树；不改变既有 valid/runtimeVerified 的含义。
- 编辑器增加 buffer 语义悬浮说明及内容/catalog 缓存。没有项目符号绑定时明确返回未知，避免伪造当前选择。
- 同步 bundled 项目文件 skill 和 GDL 参考，修正当前教学入口残留的格式 11 说明。

## 使用方式

已有本地项目先运行 generate-catalogs 或 validate_project_files，生成当前版本并绑定声明指纹。单独的分析调用不会隐式刷新生成文件。

```json
{
  "file": "scenes/Main/functions/sceneUpdate.gdl",
  "detail": "summary",
  "max_events": 40
}
```

以上请求用于 `analyze_gdl_events`。可增加 `event_path` 查询子树；索引来自原始混排作者列表。工具仍读取所需父链和前序上下文。

```json
{"kind":"condition","type":"CollisionNP"}
```

以上请求用于 `get_gdl_instruction_semantics`。精确类型必须存在于项目 catalog。分析结果的 complete 仅表示当前规则覆盖完成，不表示游戏需求或动态行为已得到证明。

## 预算和退化策略

- 每个分析最多访问 10,000 个事件、50,000 条指令；项目聚合共享这两项预算。
- 每个选择状态最多保留 64 个对象符号，大对象组可降为未知；选择来源链保留最近 16 项。
- 默认返回 40 个事件，最多 200 个；每个事件保留至多 100 个条件和 100 个动作摘要，诊断最多 200 项。
- 每次响应限制为 128 Ki UTF-16 字符，约束的是字符数，不是固定 UTF-8 字节数。超限会裁剪并显式返回 partial/truncated。
- 当前无 continuation 分页；可通过 event_path 缩小查询范围。不能将截断结果视为完整覆盖。
- unknown、规则抑制与输出截断都不会把 runtimeVerified 变成 true。

## 实际验证

相关回归命令：

```sh
CI=true npm --prefix newIDE/app test -- --watchAll=false --runInBand --silent src/ProjectsStorage src/CodeEditor src/EventsSemantics src/Mcp/McpEditorBridge.spec.js src/Mcp/McpEventTools.spec.js src/Mcp/McpEventKnowledge.spec.js src/Mcp/McpToolCatalog.spec.js
```

结果：最终回归：31 个套件、434 项测试、5 个快照全部通过（约 65 秒），包含新增分析、悬浮、原生事件、旧 catalog 自动重建和 MCP 端到端路径。

真实原生生成与浏览器运行：

```sh
node scripts/test-unified-settings-runtime.cjs
```

Headless Chrome 155：7/7 场景通过。除原有 OR、父选择传入 JS、Else 和循环场景外，新增验证：

1. 两枚碰撞 Coin 和一枚远处 Coin：普通事件删除两枚，加分 1。
2. 相同输入，碰撞筛选后的 ForEach：删除两枚，加分 2。
3. PickAll 后删除：远处 Coin 也进入作用范围，最终无 Coin，加分 1。
4. PickRandom：仅删除当前碰撞选择中的一枚，远处 Coin 保留。
5. 兄弟事件恢复选择基线：第二个事件不继承前一兄弟的碰撞筛选。
6. JS 传入选择长度为 2，容器 getObjects 长度为 3。

端到端测试还确认：工具调用前后源码/catalog 字节不变，不触发 reload；修改声明返回 catalog-stale；旧快照返回 stale；项目外路径被拒绝；待恢复事务被保留并返回 MULTIFILE_PENDING_TRANSACTION。

规模样例：3,000 个空事件的分析测量为约 25ms，默认输出 21,487 个 UTF-16 字符。这个数字来自单次开发机测量，不代表复杂逻辑、磁盘读取、catalog 生成或其他机器的性能承诺。

全部变更的源码/测试文件执行 ESLint（零错误、零警告）及 Prettier 检查；脚本语法和 diff 空白检查单独执行。本次没有重新构建桌面分发包，没有以单元测试替代真实浏览器行为断言。

## 明确未完成的范围

以下能力保留 partial/unknown，不能将本次首版描述为完整程序分析器：

- OR/AND/Not 的完整选择数据流合并，以及对象条件 inverted 的特殊规则。
- 任意表达式的副作用和求值次数证明。
- Repeat/While/ForEachChild 的固定点和跨迭代不变量；ForEach 目前侧重当前迭代的对象基数。
- Create 的成功性、动态对象名及完整的列表首次物化分析。
- 跨函数/Link 的上下文相关摘要、递归调用固定点和行为 Diff。
- 任意 JS、异步 continuation 或未知扩展的完整副作用。
- 逐条件的运行时 picking 插桩和轨迹。
- 完整分页、按文档异步取消，以及编辑缓冲区与磁盘项目符号的深度绑定。

SignalReceived 的调度识别按当前 C++ 源码契约实现并有结构匹配测试；本地预构建测试 WASM 未提供该条件的元数据，因此未声称完成信号场景的原生浏览器验证。规则证据中区分源码和已运行夹具。

Else 仍遵守当前 GDL 较严格的邻接规则。未因原生生成器跳过 comment/disabled 而放宽作者格式。

## 后续实施顺序

优先扩充已有真实引擎夹具来精化逻辑合并、反选、创建和循环规则，然后增加跨文件摘要与行为 Diff。运行时轨迹仍按 spec 独立评审，不作为基础分析链路的默认副作用。

当前 instruction catalog 文件契约见 [按种类拆分规范](instruction-catalog-split-spec.md)（逻辑版本 6）。
