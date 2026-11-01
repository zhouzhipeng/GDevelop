# GDL 事件生成 JavaScript 与 AI review 工具

状态：已批准；当前实现契约。日期：2026-11-01。

## 问题与目标

AI 修改 GDL 事件时需要检查真实编译器输出，以确认对象选择、动作执行次数、循环边界和调用上下文。现有 validate_project_files 预检生成代码，但不提供代码正文；analyze_gdl_events 是保守静态解释，不能替代真实生成结果。

新增 generate_gdl_javascript MCP 工具，以保存的项目内 GDL 文件为入口，在真实项目上下文中生成所属编译单元的 JavaScript。同步 bundled 项目 skill，要求事件逻辑修改后读取生成代码并反向 review。纯配置修改不要求调用。

非目标：修改 GDL 语法、改变代码生成或 picking 语义、执行游戏、证明行为正确、提供通用导出打包、实现精确 GDL→JS sourcemap。

## 当前实现

- EventsSheet/GenerateEventsCode.js 已支持场景完整代码、扩展自由函数代码、完整行为和完整自定义对象代码。
- 行为和对象尚无公开的逐方法生成入口；场景入口生成完整生命周期代码。
- McpExtensionTools.js 使用该生成入口预检扩展函数，但只返回摘要。
- 磁盘项目读取与验证路径位于 McpEditorBridge.js、LocalMultiFileProject.js；复用其项目构建和扩展元数据初始化能力，审查并隔离全局注册状态，不能直接使用旧编辑器模型。

## 公共接口

工具名：generate_gdl_javascript。

输入：file 为必填项目相对路径；context_file 为可选调用方函数路径，仅用于外部片段。拒绝未知输入字段。

输出：success、status、requestedFile、contextFile、sourceSnapshot、mode、generatorRevision、generatorVersion、generatedScope、owner、includesOtherFunctions、artifacts、dependencies、diagnostics、runtimeVerified:false。

artifacts 包含生成文件绝对路径、字符数和内容指纹。完整未压缩 JS 写入项目 tmp/gdl-javascript-review/<snapshot>/ 下的独立缓存目录，不把大型代码正文默认注入工具响应；AI 必须读取该文件。使用受控目录与路径校验，拒绝符号链接逃逸，不覆盖作者文件。产物目录包含源码快照；每次调用在独立子目录中写入完整代码，不覆盖既有产物。

sourceSnapshot 覆盖构建项目所用的全部受管理源文件、生成 catalog、生成模式与编译器会话身份；artifact 指纹另行标识具体生成代码。依赖列表列出生成器请求的 include，不将其描述为所有外部 runtime 文件的内容快照。检测读取期间变化，返回 stale 而不是混合新旧源。返回生成模式，采用现有 compilationForRuntime=true 路径；不声称与所有预览模式字节一致。

## 支持范围

| 输入 | 实际生成范围 |
| --- | --- |
| 场景函数 | 所属完整场景 |
| 扩展自由函数 | 该函数 |
| 行为方法 | 所属完整行为 |
| 自定义对象方法 | 所属完整对象 |
| 外部片段 | 通过 context_file 指定调用方，生成调用方所属编译单元 |
| 纯配置文件 | unsupported-file-kind，不生成伪造的执行代码 |

外部片段须验证调用方确实通过直接或传递 Link 使用目标片段。缺少调用方返回 context-required；循环 Link 按真实编译器诊断处理。首版不提供事件级 JS 截取，也不宣称文件与生成代码一一对应。

## 实现流程与副作用

1. 校验当前为保存的本地项目，路径属于受管理源树。
2. 只读读取磁盘源快照；有待恢复事务则停止，不隐式恢复。
3. 在临时项目中按现有生产链路解析并建立类型、函数和扩展上下文。需要的 catalog 缺失或过期时明确要求 generate-catalogs，不隐式改写生成作者文件。
4. 根据真实组件归属解析 scope，调用原生生成器，收集诊断与依赖。现有辅助函数丢弃的诊断和 includes 需补充保留，既有调用者兼容。
5. 检查 JS 语法并写入完整产物，返回清单。生成失败不得返回看似成功的半成品。
6. 清理临时 WASM 对象及临时注册状态；不 reload、不启动预览、不执行生成代码。

工具写缓存，因此 annotations 应为 readOnlyHint:false、destructiveHint:false、openWorldHint:false。当前每次重新生成，避免复用过期输出；同一源码与编译器会话的 sourceSnapshot 稳定，产物自身可能包含新生成的内部标识。对超预算、并发冲突和基础设施失败给出独立诊断。

## Skill 强制流程

维护 resources/gd-project-template/skills/gdevelop-project-files/SKILL.md、references/gdl-usage.md 与项目 AGENTS.md；同步 MCP 作者指导和工具说明。

凡新增或修改 GDL 事件逻辑，包括条件、动作、循环、子事件、Link、JS 事件和影响执行的 flags，必须：

1. 保存修改并通过 validate_project_files。
2. 对每个受影响编译单元调用 generate_gdl_javascript，读取返回的完整 JS 文件并检查与修改相关的代码及上下文。共享编译单元可按同一快照去重。
3. 检查选择列表来源与传递、调用/迭代次数、变量副作用、父子与兄弟事件、异步上下文。必要时查看 runtime helper 实现，不根据函数名猜测。
4. 修正 GDL 后重新校验、生成和 review；后续源修改使旧 review 失效。
5. 外部片段变更覆盖所有受影响调用方编译单元；不能只选一个调用方代表全部上下文。
6. 在最终说明记录 reviewed 文件/编译单元和未确定事项。生成成功不等于逻辑正确；仍按已有流程执行行为相关运行验证。

纯配置改动无需调用本工具。工具不可用、生成失败或无法理解关键 helper 时，明确报告 review 未完成，不声称已通过。配置变化若伴随事件逻辑修改，仍按事件流程执行。

## 影响层与文件

- McpToolCatalog.js：schema、工具说明、示例和作者流程。
- McpEditorBridge.js 及独立生成处理模块：分派、磁盘上下文、生命周期管理。
- EventsSheet/GenerateEventsCode.js：保留诊断与 include 信息，兼容原调用者。
- MCP 服务工具注册、权限/允许清单：沿现有注册链路同步。
- 项目模板 AGENTS、SKILL、GDL reference 和当前事件规范：使用边界及强制 review。

## 兼容、性能与发布

新增工具，不改变作者格式、catalog 版本、既有工具含义或运行时行为。无需迁移；旧生成入口调用者保持兼容。现有用户项目不会被工具自动改写 skill；新建项目使用更新模板。

按编译单元生成，项目上下文仍可能需要完整加载；不承诺编译耗时与单文件大小成正比。复用磁盘读取的源码预算，生成 JS 限制为 16 Mi 字符，返回文件而不截断代码。当前不自动清理缓存，调用者可删除 tmp/gdl-javascript-review 中的过期产物。

## 验证与验收

- schema、工具注册、bridge 分派、允许清单及作者指导一致。
- 原生生成测试覆盖场景、自由函数、行为、自定义对象；验证 returned scope 与实际范围一致。
- 外部片段的多调用方、无调用方、非调用方和循环引用。
- 磁盘新源码优先于旧编辑器内存；调用前后作者源、catalog、编辑器状态不变。
- catalog-stale、源码变化、未恢复事务、生成器诊断、JS 语法失败、预算与路径逃逸。
- 真实生成夹具验证多金币删除与单次加分、ForEach 逐枚加分、父动作改变子事件选择。
- Skill 明确事件强制、配置豁免、读取代码、修改失效及运行验证边界。
- 按仓库 AGENT.md 运行相关回归、lint、格式检查，随后后台派发 macOS 构建启动脚本；不等待或宣称最终构建结果。

## 备选与开放问题

直接返回全部项目 JS 会扩大上下文与生成开销；单事件脱离上下文编译可能误导 picking review，均不作为首版方案。

首版接受完整编译单元输出；精确函数/事件定位与源映射留待后续。底层临时扩展注册的隔离实现需在实施时复用并测试现有磁盘验证链路；若无法保证隔离，不得回退为静默使用编辑器旧模型。
