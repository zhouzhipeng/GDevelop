# External Events 事件片段重构规格

> Version 7 amendment: fragment execution semantics remain, but every
> `.events` fragment now has a same-stem `.settings` description owner. See
> [external-events-settings-project-module-map-spec.md](external-events-settings-project-module-map-spec.md).

- 状态：用户已于 2026-09-20 批准实施；按随后指示取消兼容性支持，先验证引擎，再一次性迁移 JurassicWorld。
- 日期：2026-09-20。
- 请求：将 External Events 定位为拆分场景事件的代码片段，每份片段只保存一个 `.events` 文件。
- 实施范围：GDevelop 引擎、编辑器、文件格式、工具与文档，以及 JurassicWorld 项目迁移。
- 多文件格式：6；settings catalog 格式：3。

## 1. 审查结论

当前复杂结构来自引擎将 External Events 建模成了生命周期函数容器：

1. `Core/GDCore/Project/ExternalEvents.h` 持有
   `SceneLifecycleEventsFunctions`；`GetEvents()` 只是 `sceneUpdate` 的别名。
2. `Core/GDCore/Events/Builtin/LinkEvent.cpp` 按调用方的生命周期角色选择
   外部容器中的同名函数，然后将事件插入引用位置。
3. 多文件读写器要求一个 `external-events.settings`，再为每个生命周期
   函数保存一对 `.settings` 和 `.events`。
4. 编辑器、遍历器、校验器、搜索及生成的 authoring catalogs 都沿用了这个模型。

因此，单独移动游戏目录中的文件不能完成重构：目前的文件发现器只扫描
外部 owner 子目录，编辑器保存时也会重新生成原结构。

审查的游戏位于：

```text
C:/Users/Administrator/Documents/Codex/2026-09-18/new-chat/outputs/JurassicWorld
```

2026-09-20 的工作区快照如下，实施迁移前须重新核对：

| 项目 | 当前状态 | 迁移目标 |
| --- | --- | --- |
| 外部事件 | 28 份，均只有 `sceneUpdate` 文件 | 28 份单文件片段 |
| 外部事件文件 | 84 个：56 个 settings、28 个 events | 28 个 events |
| `external-events/` 下的子目录 | 56 个 | 0 个 |
| 外部事件文本 | IfDo 事件正文 | 保留正文 |
| 外部引用 | 复核时 28 处，分布在场景及建造片段的 update 正文中 | 保留位置与层级 |
| 嵌套引用 | 4 处，位于父事件下 | 保留父条件和对象筛选 |

Git 已跟踪 27 份外部事件的 81 个文件；第 28 份 `ModularConstruction`
是工作区新增片段。审查期间该片段从未引用的占位内容变为已被引用的建造
事件，引用位置也发生了调整。项目另有建造系统相关未提交修改。
迁移以最新磁盘内容为输入，保留这些内容与当时的引用状态，提交时区分
本任务改动和其他工作的改动。以上计数是审查证据，不是迁移的硬编码输入。

## 2. 目标与边界

External Events 是具名事件列表，在 `link` 的位置展开。它没有自己的
函数签名、参数列表、返回值、生命周期注册或调用栈。

本次改动要同时实现：

- 一个外部事件对应一个平铺的 `.events` 文件。
- External Events 核心模型直接持有 `gd::EventsList`。
- 编辑器直接打开该事件列表，移除外部事件的生命周期导航和函数属性。
- 保存、重新打开、重命名、删除、引用定位、预览和导出使用相同模型。
- 新读写器只接受版本 6；本任务单独对 JurassicWorld 执行一次性迁移。
- 更新规范、生成器、模板技能和项目说明。

场景自身的生命周期函数、Prefab/Behavior/Extension 的真正函数、
External Layouts、IfDo 指令语法及游戏业务逻辑不属于此次设计调整。
本次也不合并现有 HUD 片段、不新增业务片段、不改写场景的执行顺序。

## 3. 文件结构与身份

迁移前：

```text
scenes/Game/external-events/HUDMenuInput/
  external-events.settings
  functions/
    sceneUpdate.settings
    sceneUpdate.events
```

迁移后：

```text
scenes/Game/
  scene.settings
  functions/
    sceneUpdate.settings
    sceneUpdate.events
  external-events/
    HUDBootstrap.events
    HUDMenuInput.events
    HUDActionBar.events
    HUDQuests.events
    ModularConstruction.events
    ...
```

规范路径为 `scenes/<Scene>/external-events/<Fragment>.events`，URI 为
`game://scenes/<Scene>/external-events/<Fragment>.events`，名称按现有
托管路径的编码规则表示。

- 直接扫描 `external-events/` 下的 `.events` 文件，每个文件声明一份片段。
- 片段名称由文件名解码并移除最后一个 `.events` 后缀获得；所属场景由
  上级目录对应的 `scene.settings` 身份获得。
- 文件内容只使用 IfDo DSL。空文件、仅注释文件、暂未引用的文件均有效。
- 不创建片段 settings、片段子目录、`functions/`、片段清单或 TOML 文件头。
- 不向 `scene.settings` 增加 `externalEventFiles` 等登记数组。
- 继续使用项目级唯一片段名称，使用 `link "名称"` 引用片段。
  不在此次修改中引入同名片段的跨场景寻址语法。
- 名称按 NFC 规范化，检查大小写折叠后的冲突；新建或导入冲突名称时明确报错。
  不使用需要额外名称映射表才能还原的哈希后缀。中文、空格、百分号、
  Windows 保留名称和末尾点必须经过可逆编码及路径往返测试。
- 外部事件的旧 `order` 只控制列表展示。新列表按名称稳定排序；内存重建
  按场景顺序、片段名称排序，不再持久化外部事件的手工列表顺序。
  执行顺序始终由事件树中的 `link` 位置决定，与文件枚举顺序无关。

其他组件的名称、顺序和路径规则保持原合同。本次的无 settings 规则仅适用
于 `external-events/` 下的事件片段；真正的函数仍要求同名文件对。

## 4. 展开与作用域语义

以下语句保持可用：

```events
link "HUDMenuInput"
```

语义等价于在这个位置放入 `HUDMenuInput.events` 的事件列表。

1. 父条件、缩进层级、对象筛选、循环、局部变量和先后顺序按照原地展开的
   事件树处理，不为片段新增函数边界。
2. 场景在 `sceneLoad` 中引用片段，片段在加载阶段执行；在 `sceneUpdate`
   中引用则在更新阶段执行。片段本身不选择角色，也不因存在于目录而执行。
3. 信号参数和卸载阶段的指令限制来自真实调用位置。同一片段被多个阶段
   引用时，分别按每个调用上下文验证，不能固定按 `sceneUpdate` 验证一次。
4. 结构性检查对所有片段执行；依赖父条件、变量或生命周期的语义检查在
   展开后的调用上下文执行。未被引用的片段不生成运行代码。
5. 片段可以引用其他片段。循环引用和缺失目标应在
   预览或导出前报告，并给出片段文件及引用链。
6. 保留禁用状态和事件元数据。Link 引用整个片段。
   多处引用、Trigger Once、局部变量和异步续接须保持各调用位置的隔离行为。
7. Link 只能指向外部事件片段，不接受场景名。
8. 本次不扩展扩展函数中的引用能力；现有支持的上下文按原地
   展开的规则验证，不能因去掉函数包装而引入新的对象可见性。

实现仍可由编译器使用内部 JavaScript 辅助函数。它们不成为项目作者可见
的函数模型，也不能改变片段的对象筛选和作用域语义。

## 5. 核心、编辑器与工具变更

| 层 | 主要源文件或目录 | 变更 |
| --- | --- | --- |
| 核心数据模型 | `Core/GDCore/Project/ExternalEvents.h/.cpp` | 持有 EventsList；调整复制、克隆、序列化；删除外部生命周期容器 API |
| Link 展开 | `Core/GDCore/Events/Builtin/LinkEvent.cpp` | 外部目标直接读取 GetEvents；场景目标继续按调用阶段解析 |
| 依赖与遍历 | `Core/GDCore/IDE/DependenciesAnalyzer.*`、`WholeProjectRefactorer.cpp`、`IDE/Events/` | 每份片段结构遍历一次；上下文验证仍区分实际调用者；保留循环检测 |
| 作用域与代码生成 | `Core/GDCore/Project/ProjectScopedContainers.*`、Core/GDJS 的 EventsCodeGenerator | 分离片段源身份与调用者上下文；保留选择、变量和阶段限制 |
| WASM | `GDevelop.js/Bindings/Bindings.idl` | 移除 ExternalEvents 的函数容器绑定，重新生成绑定与声明 |
| 编辑器 | `MainFrame/EditorContainers/ExternalEventsEditorContainer.js`、`SceneContextLifecycleFunctions*`、`ProjectManager` | 单事件表；场景专属生命周期组件不再接收 ExternalEvents |
| 搜索与校验 | `Utils/EventsGlobalSearchScanner.js`、`Utils/EventsValidationScanner.js`、事件路径与导航调用处 | 定位到片段及事件路径；生命周期是调用上下文，不是片段身份 |
| 文件投影 | `ProjectsStorage/MultiFileProjectFormat/index.js` | 新平铺路径的分解、组合、版本校验与迁移规范化 |
| 本地存储 | `ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject.js` | 直接发现片段；更新变更侦测、事务、旧文件清理和恢复 |
| Catalog 与 JS | `ProjectsStorage/ProjectSourceCatalog.js`、`JavaScriptAuthoringApi.js` | 片段只有 eventsUri；移除伪造的函数/settings URI；JS 检查采用真实调用上下文 |
| 内部工具适配 | `Mcp/McpEventTools.js`、`Mcp/McpExtensionTools.js` 等现有消费者 | 场景函数与外部片段使用不同目标类型；不新增公共 MCP 工具 |

表中的编辑器文件均位于 `newIDE/app/src/` 下。实施时继续追踪调用方，不直接
修改 WASM glue、复制的运行时或项目 `.gdevelop` 生成文件。

外部事件编辑器保留对象/变量上下文、撤销重做、选择、搜索跳转和资源热更新。
片段页签只定位事件路径，不再恢复外部函数角色。场景页签恢复合同不变。

生成的 catalog 应把外部片段描述为事件源，包含 `scene`、`name`、`eventsUri`，
不再声明它是 TOML settings 类型，也不产生四个生命周期条目。公开或内部
数据结构中的外部 `functionSettingsUri`、`eventsFunction`、角色身份须同步移除；
不能通过返回不存在的文件或虚构函数维持接口表面兼容。settings catalog
版本 3 增加 `eventFileKinds`，单独声明不需要 settings 的 IfDo 片段。

## 6. 版本与迁移

### 6.1 新格式边界

多文件格式从 5 升至 6，统一更新项目及受版本约束的 settings 标记。
IfDo DSL 版本和嵌入 layout 格式不变。旧编辑器应拒绝版本 6，避免把片段
当作孤立文件忽略后再次保存。

`optional-scene-lifecycle-functions-spec.md` 也曾提议格式 6，但文档目前标为
待批准，当前多文件实现仍是版本 5。本规格批准后明确修订其中关于
External Events 的提案；场景生命周期能力不因本规格被顺带启用或撤销。

### 6.2 批准后的兼容性修订

用户明确要求“不需要考虑兼容性”。引擎不提供版本 5 外部函数树的读取、
双格式保存、隐式转换或兼容页签。旧目录和旧版本直接报错；旧单文件中的
外部生命周期字段也明确拒绝，避免静默丢失正文。ExternalEvents 的规范
序列化只包含 `name`、`associatedLayout` 和 `events`。

下面的迁移只针对 JurassicWorld 最新磁盘快照，是本任务的一次性操作，
不是引擎内常驻兼容机制。迁移前核对所有正文、包装字段和引用阶段；遇到
多阶段正文、目标冲突或未知作者数据时中止，不猜测转换。文件正文保留
原始字节，片段名字和每处 Link 的顺序与层级保持不变。

### 6.3 JurassicWorld 迁移

当前审查显示外部引用均来自 sceneUpdate，28 份正文均位于 update，
因而没有已发现的跨阶段歧义。最终迁移须使用最新文件重新确认这一点。

验收逐份保存迁移前后的正文哈希，并比较全部 Link 的目标、顺序、事件
路径和缩进层级。保留 `ModularConstruction` 及其当时的引用状态。根据实际
迁移结果更新 README 和 `ui-module-map.json`，不把业务脚本的其他修改混入。

更新 `tools/setup_modular_construction.py` 的事件生成部分，使其直接创建
`external-events/ModularConstruction.events`；检查其余项目工具，清理仍会
生成旧外部包装的代码和示例。

### 6.4 事务与回滚

继续使用现有项目写事务、源文件大小限制、路径与 symlink 安全检查。
片段文件先提交，`project.gdevelop` 最后提交。删除旧路径前已有备份与
事务日志；失败或崩溃恢复完整旧树。源文件在预检后发生变化时终止该次
提交并要求重新读取，不能覆盖其他编辑器或任务的新内容。

迁移过程中产生的备份属于事务状态，不是新项目结构中的常驻 sidecar。
新旧结构混用、旧 owner 残留或同一身份同时出现两种正文时给出明确诊断。

## 7. 文档更新

实施时同步修改以下权威文件，删除“每个 events 都是函数”的绝对规则，
明确场景函数、扩展函数与外部片段的区别：

- `docs/Architecture.md`
- `docs/gdevelop-new-formats-spec.md`
- `docs/gdevelop-events-dsl-spec.md`
- `docs/embedded-layout-settings-format-spec.md`
- `docs/scene-owned-externals-format-spec.md`
- `docs/scene-event-phases-spec.md`
- `docs/optional-scene-lifecycle-functions-spec.md` 中 External Events 的适用范围
- `newIDE/app/resources/gd-project-template/skills/gdevelop-project-files/SKILL.md`
- 上述技能的 `references/events-dsl.md` 及相关 JavaScript authoring 路径示例
- JurassicWorld 中对应的技能副本、README、事件模块清单及生成工具说明

保留必要的历史迁移说明并标明已被替代。通过生成器刷新项目的
`.gdevelop/settings-catalog.json` 和声明，不手工修补生成内容。

## 8. 验证、性能与实施顺序

必须覆盖的回归包括：

1. ExternalEvents 的空列表、复制/克隆和序列化往返；不再生成生命周期字段。
2. 同一片段在四个场景阶段展开同一正文，阶段约束由调用者决定；空片段为
   no-op，未引用片段不执行。
3. 嵌套 Link、循环依赖、缺失目标及调用位置诊断。
4. 条件和循环内展开、对象筛选、局部变量、多个调用位置的 Trigger Once
   与异步续接；源事件树不能被编译过程意外修改。
5. 平铺读写、创建/删除/重命名/迁移场景、名称编码与冲突、文件重排后行为
   不变；拒绝版本 5，验证版本 6 往返；拒绝旧外部生命周期输入。
6. 其他 `functions/` 中缺少 settings 的 events 仍须报错；未引用片段有效。
7. 事务中断恢复、目标冲突、读后修改保护、用户文件保护及新旧结构混用。
8. 编辑器打开、撤销重做、页签恢复、搜索跳转；catalog 与 JS 诊断没有旧路径。
9. JurassicWorld 全部片段正文和引用的静态等价比较，以及迁移后保存、
   重开和预览中 HUD 初始化、菜单、快捷栏、恐龙提示与建造显示的回归。

优先复用邻近的 Core `SceneLifecycleEventsFunctions`、`DependenciesAnalyzer`
测试，GDevelop.js 场景代码生成集成测试，以及编辑器的
`MultiFileProjectFormat`、`LocalMultiFileProject`、`ProjectSourceCatalog`、
`JavaScriptAuthoringApi`、`EventsGlobalSearchScanner` 和
`EventsValidationScanner` 测试。

预期减少磁盘扫描与解析的包装文件、核心空生命周期容器，以及重复的
catalog 条目。保持现有 Link 编译期展开方式，不新增每帧文件读取或运行时
片段注册器；上下文校验可以按片段与实际调用上下文缓存，但不得跨不同
作用域错误复用结果。此处是设计预期，不作为已测量的性能提升。

实施顺序：先修核心与绑定，再接通编辑器、读写和工具，随后更新规范与
模板；通过针对性回归后迁移 JurassicWorld。迁移通过项目要求的 catalog
生成、文件验证、任务改动提交、reload 和预览验收流程。

引擎代码修改完成后按 `AGENT.md` 派发真实 Windows 构建启动脚本，并在
确认后台进程创建后结束该实现会话，不把派发成功当作构建或预览成功。
需要新引擎的项目验收在新版本可用后继续，记录实际验证结果。

## 9. 备选方案与审批范围

- 只把函数文件挪平：仍保留错误的外部生命周期模型，编辑器和调用语义继续复杂。
- 每份片段保留 settings：重复记录路径已经表达的身份，未满足单文件目标。
- 向场景 settings 写入片段清单：增加双重登记和同步成本。
- 在片段文件头嵌入 TOML 或新指令：让纯事件文件承担资源配置职责。
- 合并全部 HUD 事件：失去按职责拆分场景事件的用途。

用户已批准单 `.events` 片段模型，并要求不实现兼容层。外部事件没有
生命周期函数；旧列表 order 改为名称排序；旧格式直接拒绝。实施和验证
完成情况以实际测试及 JurassicWorld 迁移报告为准。


## 10. 实施结果（2026-09-20）

- 核心外部事件仅持有 EventsList；已重新生成 WASM、Flow 与 TypeScript 绑定。
- 引擎和编辑器的存储、搜索、引用、作用域、校验及工具使用平铺片段；格式 6 与 settings catalog 3 已启用。场景生命周期函数保持原模型。
- Core 回归：138 个断言通过。相关编辑器/存储回归：213 项通过；场景代码生成集成：10 项通过。新增展开测试包括 group/range 的原始源位置、缺失组、空列表、禁用父事件和循环引用。
- 修改的 JavaScript 通过 ESLint；生产编辑器构建成功（保留既有动态依赖警告）；模板技能校验通过。
- 存储套件中的既有 Physics3D 隐藏属性断言与扩展声明不一致。通过 HEAD 版本 catalog 生成器复现后，将该项单独记录，未改变 Physics3D 实现或其测试期望。
- JurassicWorld：28 份片段由 84 个文件、56 个子目录简化为 28 个文件、0 个子目录；56 个包装文件移除，332 个保留的 settings/入口更新版本标记。
- 游戏全部 41 份事件源逐字节保留，28 处外部 Link（其中 4 处子事件引用）文本、顺序和缩进不变。README、模块索引、作者技能及 5 个相关工具脚本已同步。
- 新编辑器打开、生成 catalogs、序列化往返、语义检查、代码生成及 reload 成功。5 项现有玩法测试的 52 个断言全部通过；8 帧暂停预览的 7 个 HUD/对象/运行时错误断言全部通过，验收返回 runtimeVerified=true、completionReady=true。
- 一次性迁移脚本与原始源备份保存在临时验证目录，未加入引擎常驻读写器。项目中保存了 `external-events-migration.md` 验证记录。

既有 Physics3D 失败的原始检查命令（工作目录 `newIDE/app`）：

```powershell
npm test -- --watchAll=false --runInBand src/Utils/EventsValidationScanner.spec.js src/ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject.spec.js
```

其中 `preserves hidden Physics3D behavior properties without exposing them in the catalog`
期望 catalog 不包含 `layers`，但当前 Physics3D 扩展将 `layers`、`masks` 等属性公开。
使用 HEAD 版本的 catalog 生成器验证了相同行为。其余存储用例通过；此单项
在后续存储回归中排除，未计入通过数量，也未修改该断言来掩盖失败。
