# GDL 统一变量描述块与 JSON 复杂值

状态：用户已批准并实施。作者格式 17，GDL catalog 16。

## 问题与目标

格式 16 同时支持赋值、隐式结构、具名描述块及 items/item。描述块由 value/type 内容判定，业务字段可能改变整块含义。用户要求所有变量统一采用具名描述块：显式 type，标量 value，结构与数组通过 json 原始字符串承载。

目标：统一 variables、parameters、properties 的具名成员外形；变量无简写、无字段猜测；保留原生值、嵌套枚举、编辑状态、源码顺序与作用域；严格拒绝非法 JSON。
非目标：修改参数/属性描述符的字段类型、原生模型、运行时、属性优先解析、表达式或通用 raw string 词法；不新增通用 JSON 配置透传。

## 当前与拟议语法

```text
variables {
  Health {
    type = "number"
    value = 10
  }
  Enabled {
    type = "boolean"
    value = true
  }
  Name {
    type = "string"
    value = "Player"
  }
  Mode {
    type = "enum"
    value = "Idle"
    values = ["Idle", "Run"]
  }
  Position {
    type = "structure"
    json = """
{
  "X": 10,
  "Y": 20
}
"""
  }
  Enemies {
    type = "array"
    json = """
[
  {"Name": "Slime", "HP": 10},
  {"Name": "Boss", "HP": 100}
]
"""
  }
}
```

- 每个成员必须为具名节点，名称不为空且唯一，支持带引号的特殊名称；不允许 name、scope、id、persistentUuid。
- type 必填，值仅为 number/string/boolean/enum/structure/array。
- number/string/boolean/enum 必须且只能使用 value；类型严格匹配，不转换。enum 仍要求非空且唯一的字符串 values，包含当前值。
- structure/array 必须且只能使用 json；解码字符串必须为合法 JSON，根分别为对象/数组。普通 value 字符串不自动解析。
- json 接受通用 GDL 字符串的两种形式，规范输出始终为多行 raw string，包括空对象和空数组。此规则不新增一种字符串词法。
- 禁止直接赋值变量、隐式结构成员、variables 子容器、items/item 和匿名 GDL 结构值；不提供第二套复杂值语法。
- folded、hasMixedValues 保留为当前变量描述块上的可选布尔字段。
- parameters/properties/shared_properties 的现有具名描述规则和字段类型保持不变；不强制变量类型词汇用于参数和属性。
- global_variables/scene_variables、实例变量和事件局部变量使用相同成员契约。

## JSON 值契约与顺序

JSON 仅承载变量值。递归允许对象、数组、字符串、布尔和有限数字；拒绝 null、重复对象键、非安全整数、非有限值、非法控制字符、注释和尾逗号。不把数字字符串转成数字。对象成员名不为空；数组元素无名。__proto__/constructor 等名称作为普通数据安全处理，不通过普通对象属性写入建立原型。

使用能够保留对象成员源码顺序、键范围、数值 token 和重复键的严格解析表示；不能仅靠 JSON.parse 后的对象枚举恢复数字名称顺序。JSON 的值和语法错误统一通过 GDL string 偏移映射定位，支持 JSON 转义字符串及 raw CRLF。错误提供路径和原始行列；重复键同时可指出首次声明位置。

模型输出采用两空格缩进的 JSON；对象成员按原生顺序输出，已有源文件的结构成员顺序在原生 std::map 往返后按名称恢复；数组顺序由当前原生模型决定，不根据旧源码重排数组。修改值时重算 raw 定界符，确保正文碰撞安全。纯 GDL AST 格式化保留 json 字符串正文，不隐式重新格式化 JSON。

## 嵌套元数据（本规范补充的具体方案）

纯 JSON 无法保存子变量 enum/values/folded/hasMixedValues，因此增加可选 metadata 字符串字段，使用独立的 JSON Pointer 路径映射，不污染业务 JSON，也不恢复 items/item。

```text
State {
  type = "structure"
  json = """
{
  "Mode": "Idle",
  "Controllers": [{"Enabled": true}]
}
"""
  metadata = """
{
  "/Mode": {"type": "enum", "values": ["Idle", "Run"]},
  "/Controllers/0/Enabled": {"folded": false}
}
"""
}
```

- metadata 只允许在 structure/array 描述块出现；无元数据时省略。
- 路径从 json 根开始，遵循 JSON Pointer 的 ~0/~1 转义；数组索引为规范十进制，无前导零；拒绝不存在路径、空根路径、非法转义和重复路径。
- 每个记录只允许 type="enum"、values、folded、hasMixedValues。enum 只能标注字符串，必须同时提供合法 values；values 不能单独出现。编辑状态必须为布尔。
- 根变量元数据直接写在描述块上，不允许通过 metadata 重复声明。ID 不输出、不参与等价比较，沿用当前项目边界。
- 原生模型递归序列化同时生成数据与 metadata；重命名成员或调整数组后路径以当前模型重建。源文件里失效的路径直接报错，不自动迁移绑定。
- metadata 使用与 json 同一严格 JSON 解析器和错误映射。不能悄悄丢弃不支持的原生字段。

该字段已随本规范批准，用于满足现有无损往返要求。

## 影响层与文件

- SettingsDsl/Variables.js：统一描述块解码/编码、元数据映射、声明名称和结构顺序恢复。
- 新增严格变量 JSON 解析/打印模块，复用 Syntax.js 的字符串源码映射；复用文件/深度预算并限制解析节点数，不添加依赖于项目值执行的代码。
- SettingsDsl/SchemaInventory.js、index.js、Events.js、ProjectSourceCatalog.js：所有变量 owner、事件局部变量、schema、catalog、版本。
- CodeEditor/SettingsLanguage.js：取消赋值与隐式结构补全，提供 type/value/json/metadata 描述块，原始字符串内的 JSON 诊断和路径位置；避免把 JSON 正文识别为 GDL 节点。
- EventsSemantics/ProjectContext.js、SourceMap.js 和变量相关消费者：从描述块识别声明，保留变量类型和值分析；JSON 成员定位通过映射，不能把元数据当业务变量。
- MultiFileProjectFormat、LocalMultiFileProject：读写、等价检查、结构成员顺序与项目入口版本。
- 当前规范、模板、bundled 项目文件 skill、示例和相关 fixtures 同批更新。生成 catalog 通过权威生成接口更新，不手改生成物或用户项目。
- Core/GDJS 原生模型及运行时 API 不变，不需要为该语法修改原生变量模型。

## 兼容、版本与发布

沿用仓库仅支持最新作者格式的策略：作者格式 16 升至 17，GDL catalog 15 升至 16，instruction catalog 内容版本不变。不读取旧 GDL、不迁移、不双写。原生模型导入通过新 writer 输出格式 17；不自动扫描修改磁盘上的用户项目。

读取器、writer、模板、补全、schema 与文档同批切换。旧入口版本和旧变量语法给出明确诊断。任何数据/元数据校验失败在事务写入前终止，不静默裁剪。

## 性能与错误处理

扫描/解码/打印目标 O(源码字符数 + 变量节点数)，深度检查在递归前完成；路径遍历总成本受 metadata 字符预算限制。现有 16 MiB 源码限制、最大 100 层和 token 预算继续有效，内嵌 JSON 增加独立节点预算，不能靠一个 raw token 绕过限制。诊断不回显整个大型 JSON；提供稳定错误类别、变量路径和源码位置。

## 验证与验收

1. 标量/枚举/空结构/空数组/嵌套与异构数组/Unicode/特殊名称/数字名称/原型名称读写等价；writer 只输出描述块且所有成员都有 type。
2. 根和嵌套元数据、嵌套枚举、数组索引、Pointer 转义无损往返，ID 继续忽略；非法路径和元数据拒绝。
3. 拒绝旧简写、隐式结构、items/item、缺 type、错 value/json、两者混用、未知字段、重复名称。
4. 拒绝 JSON 重复键、null、非安全整数、溢出、错误根类型、注释/尾逗号、超深/超预算；定位覆盖 raw LF/CRLF 与普通 JSON 转义 GDL 字符串。
5. 格式化幂等、raw 定界符碰撞、JSON 字符串中的 {{}}、业务 value/type 键、结构顺序与数组顺序；注释保留和节点移动不改变数据。
6. 覆盖所有变量 owner、Extension 双作用域、事件局部变量、实例覆盖；保持参数/属性集合、作用域及事件运行语义。
7. 运行 SettingsDsl、ProjectSourceCatalog、MultiFileProjectFormat、LocalMultiFileProject、CodeEditor/Settings* 和 EventsSemantics 回归，相关格式/lint/类型检查；现有 SystemInstructionNames 覆盖失败单独报告，不混入语法修复。
8. 完成代码和检查后，按 AGENT.md 派发 macOS 后台构建启动脚本，只确认进程创建，不等待构建/启动结果。

## 备选与审阅项

不采用变量赋值简写、嵌套变量块或 {{}} 数据值；用户已选定统一描述块与 json 数据。保留内嵌 JSON 的成本：JSON 内不允许注释、需第二层校验和编辑器源码映射。

需审阅的新增细节主要是 metadata 的独立 JSON Pointer 映射；替代方案为拒绝带后代元数据的原生模型，但这会损失现有可保存项目的表达能力，不建议采用。


## 实施验证记录（2026-10-30）

- 统一描述块、严格且保序的变量 JSON 解析/打印、嵌套 JSON Pointer 元数据、原生模型映射、结构顺序恢复、补全和场景/事件 JSON 源码诊断均已实施。
- 作者格式更新为 17，GDL catalog 更新为 16；参数/属性字段、原生模型和运行时 API 不变。当前规范、bundled 指导、示例及 fixtures 同步。
- `CI=true npm --prefix newIDE/app test -- --watchAll=false --runInBand --silent src/ProjectsStorage src/CodeEditor/Settings src/EventsSemantics`：31 套中 30 套通过，494/495 项通过，5 个快照通过。唯一失败为评估时已复现的 SystemInstructionNames 全量固定名称覆盖测试；未修改该命名机制。
- `node scripts/test-unified-settings-runtime.cjs`：4 项原生代码生成集成测试通过，Headless Chrome 7/7 运行场景通过。包含新 JSON 局部变量及后代枚举/编辑状态的原生模型往返和代码生成验证。
- 最后补全断言收紧后，SettingsLanguage 定向回归 7/7 通过。
- 本次修改的 JavaScript 文件通过 ESLint（零 warning）和 Prettier；`git diff --check` 通过。
- `npm --prefix newIDE/app run flow -- check --max-workers 2` 未通过，最终报告 657 项全仓错误；本次新增的 validateVariables 参数标注错误已修复。不宣称全仓类型检查通过。
- 未修改用户项目或手工编辑生成 catalog。后台 macOS 构建启动脚本在验证后派发，实际进程创建结果见交付消息；不等待或宣称最终构建/启动成功。
