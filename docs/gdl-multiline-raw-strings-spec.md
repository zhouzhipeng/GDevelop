# GDL 多行原始字符串设计提案

状态：已实施；按用户确认不去缩进。日期：2026-10-30。

## 问题与目标

GDL 主要供 AI 阅读和修改，人类进行 review。当前 javascript.code 是原始代码子节点，内部不遵循普通属性/子节点语法；Syntax.js 使用 JavaScript tokenizer 寻找匹配花括号。建议将其改为字符串属性，保持 `node { key = value }` 结构，并使 GDL 字符串边界独立于嵌入语言的语法正确性。

目标：无需转义 JS 正文、确定的缩进和换行、任意定界符碰撞可表达、稳定局部修改、准确源码映射。非目标：GDL 插值、JS API/执行语义变更、字节级文件容器、自动 JS 格式化、其他字符串简写。

## 官方规范调研与取舍

- C# raw strings：三或更多双引号，增长定界符避免正文冲突，结束标记确定缩进，分隔用首尾换行不计入值。借鉴定界符和首尾换行规则，不采用去缩进。
  https://learn.microsoft.com/dotnet/csharp/fundamentals/strings/raw-string-literals
- Swift：结束标记前的缩进按空格/Tab 的精确字符前缀匹配，而非显示列数；换行统一 LF。仅作比较，GDL 不采用去缩进。
  https://docs.swift.org/latest/documentation/the-swift-programming-language/lexicalstructure/
- Rust：可增长 # 定界符，不执行转义。借鉴可扩展边界原则，不另外引入 r/# 前缀。
  https://doc.rust-lang.org/reference/tokens.html#raw-string-literals
- TOML 1.1：区分 basic/literal 多行字符串；literal 不执行转义。GDL 不复制两种多行模式。
  https://toml.io/en/v1.1.0#string
- YAML 1.2.2：literal/folded、缩进指示器、strip/clip/keep。GDL 不复制折行或尾换行模式，以减少生成规则。
  https://yaml.org/spec/1.2.2/#81-block-scalar-styles
- Terraform heredoc：具名独占行定界符，支持缩进形式，但仍有模板求值。GDL 不采用其模板求值，也不增加自定义名称选择。
  https://developer.hashicorp.com/terraform/language/expressions/strings
- Java text blocks：有去缩进、转义和行尾空格移除。GDL 不移除正文尾空格，不进行转义。
  https://docs.oracle.com/en/java/javase/25/text-blocks/index.html

这些来源证明设计有成熟先例，不证明对 AI 的效率优于其他形式；仍需任务实验。

## 拟议语法

```text
javascript {
  strict = true
  objects = "Object"
  expanded = true

  code = """
const otherObjects = eventsFunctionContext.getObjects("OtherObject");

for (const object of objects) {
  gdjs._collision3DExtension.separateFromObjects(object, otherObjects);
}
"""
}
```

这是通用 string 字面量，解码后仍为 string，不新增运行时值类型。javascript.code 要求 raw 字面量，其他 schema 决定字段是否接收字符串，不在 lexer 中按字段名启用。不新增语言标签、插值、单行 raw、尾换行开关或单引号变体。现有普通 JSON 字符串及表达式 `{{ ... }}` 含义不变。javascript.code 的规范输出始终为多行原始字符串，其他字符串字段先保持普通 JSON 输出，以限制无关 diff。

### 定界符

1. 开始标记是赋值右侧连续 N 个 ASCII 双引号，N >= 3；完整连续引号串确定 N。之后只允许空格/Tab，再接 LF 或 CRLF；不允许同一行正文或注释。
2. 结束标记必须是独占一行的恰好 N 个双引号，前后只允许空格/Tab；可在文件末尾结束。结束标记前的空白不参与正文解码。
3. 原始模式下，最早满足第 2 条的行结束字符串；不理解 JS 字符串、注释或括号。其他行全部是正文。正文可以包含引号串，只要不构成结束行。
4. 内容冲突时增长 N。规范序列化选 N = max(3, 正文最长连续双引号串长度 + 1)，保守避免所有引号串冲突。AST 格式化保留现有安全的 N，避免无关变更；生成器新增内容后必须重新验证边界。
5. 没有固定的小 N 上限，扫描计入现有文件/字符预算。不能对每个字符做长度 N 的重复匹配造成 O(nN) 扫描。

### 值与空白算法（最终批准方案）

1. LF/CRLF 输入解码为 LF，单独 CR 报错；不做 Unicode 规范化。
2. 开始行后的分隔换行不进入值。收集开始行与结束行之间的物理行，用 LF 连接，不额外添加末尾换行；零正文行表示空字符串。
3. 正文空格、Tab、空白行和行尾空格全部保留，不去缩进、不 trim、不折行、不转义、不插值。
4. 结束标记前后的空格/Tab 仅属于标记行，不影响正文；规范输出结束标记从第 1 列开始，正文原样输出。
5. 值 `"x"` 对应一行 x；值 `"x\n"` 对应一行 x 加一个空正文行；值 `"\n"` 对应两个空正文行。普通空字符串仍写 `""`，javascript.code 统一输出 raw 形式。
6. 控制字符约束与 GDL 字符串一致，正文允许实际 Tab 和 LF。需要字面 CR 等受限字符的普通字段可以使用 JSON 字符串。

### 冲突示例

```text
code = """"
const text = `
"""
`;
""""
```

此例中三个双引号原样进入 JS 模板字符串。修改正文为定界符冲突行时，编辑工具必须同时扩展首尾标记；解析器不能根据 JS 意图猜测该行是否是边界。

## AST、诊断与编辑工具

string 值保存 literal kind、N、原始文本范围、解码值和逐行原始偏移。JS 工具使用解码值，定位通过逐行映射回原始 GDL，正文从原始列 1 开始，逐行偏移用于 CRLF 映射。外层 token 预算计入字面量本身，字符/文件预算覆盖全部正文；JS 分析保留独立预算。

新增或复用稳定诊断：缺失结束标记、开始行有多余内容、非法控制字符、大小超限；携带开始位置和相关问题行。关闭后多余内容按外层语法报错，不重新解释已经关闭的字符串。

JS 语法错误仅由后续 JS 校验报告，不影响已闭合 GDL 的结构解析。未闭合字符串仍可能吞掉后文；不得声称完全恢复。编辑器可提供标记为不完整的恢复视图，但严格加载不得用启发式猜测边界。结束标记同行不允许注释；下一行可以写普通注释。

GDL formatter 不调用 JS formatter，不删除行尾空白，不改变解码值；移动节点时也必须原样保留正文。JS 格式化是独立操作。JS 模板字符串的有效缩进也必须保留。AST 保真与模型规范序列化是两种明确操作。

## 影响范围与实现顺序

1. SettingsDsl/Syntax.js：string lexer、值 AST、formatter、映射与诊断，移除 code 原始节点特例。
2. SettingsDsl/Events.js、EventModel.js 和相关 schema/catalog：javascript.code 从子节点改为 string 属性，仍映射原生 inlineCode；不改变 runtime 事件语义。
3. CodeEditor、JS 类型检查和 EventsSemantics 源码映射：按字面量逐行映射。检索全部 contentLocation/inlineCode 使用方，避免只改 parser。
4. 模板、示例、项目文件 skill、MCP 返回示例、规范、相关 round-trip/runtime 测试统一更新。权威 catalog 再生成，不手改生成物。

作者格式升级为 14，GDL catalog 升为 13。catalog 按实际结构变化升级；原生指令身份、表达式和运行时数据类型不变。

## 兼容、发布与错误处理

遵循现有最新格式策略：不双读旧 code 节点、不自动迁移旧作者文件。旧作者格式明确拒绝；新格式中旧 `code {}` 给出替代写法诊断。已有内存/原生模型通过新 writer 输出 string 属性，不构成旧 GDL reader。首次实施只在显式升级格式的发布中启用，reader、writer、工具与模板一并切换。

注意当前旧 code 提取包含结束标记前的 LF；新值规则不自动保留该 LF。序列化原生 inlineCode 必须根据实际末尾 LF 增加空正文行，保证值精确相等，不能暗中删改。

复杂度目标 O(源码字符数)，映射额外空间 O(正文行数)，值与源码副本占用受现有大小预算控制。保留默认正文限制并统一核对相关校验，不在此次修改中放宽预算。

## 验收与实验

- 读写值相等、格式化幂等、节点整体移动后值不变；保留注释与尾空白。
- 空字符串、一个/多个 LF、前导空行、尾部多空行、空白行、Tab 正文、任意正文缩进、CRLF、独立 CR、Unicode 和控制字符。
- JS 引号、反斜杠、正则、模板字符串、`${}`、`{{}}`、多重嵌套花括号；JS 错误不破坏闭合 GDL。
- 三/四/更多引号，碰撞行、超长引号串、缺失边界、错误数量、边界后垃圾字符、超限与错误范围。
- 编辑器 JS 补全、诊断行列、语义定位、旧格式拒绝、原生模型往返以及真实引擎执行结果。
- 同一组 AI 修改任务对照旧 code 块与新 raw string，记录最终行为正确率、首次通过率、边界/缩进错误率、修复轮次、token 和无关 diff。没有实验前不宣称模型准确率提升。

## 备选与待确认

保留 code {} 的优势是无需升级格式、正文边界已有实现；应作为对照组。heredoc 的可读标签有价值，但多了任意标签约定；Rust # 方案可扩展但增加前缀规则；YAML 缩进/折行/chomp 选择过多；普通转义字符串增加 JS 修改成本。

建议决定：采用一个多行 raw 形式，不加入插值与语言标签；语言由字段 schema 提供。用户已批准实施不去缩进的 raw 形式；AI 对照实验属于后续评估，不作为已完成的证据。


## 实施验证（2026-10-30）

- `CI=true npm --prefix newIDE/app test -- --watchAll=false --runInBand --silent src/ProjectsStorage src/CodeEditor src/EventsSemantics src/Mcp/McpEditorBridge.spec.js src/Mcp/McpEventTools.spec.js src/Mcp/McpEventKnowledge.spec.js src/Mcp/McpToolCatalog.spec.js`：34 个套件，529/530 项通过，5 个快照通过。唯一失败为 SystemInstructionNames.spec.js 的全量作者短名覆盖断言，使用 HEAD 的 Syntax.js 和 InstructionCatalog.js 替换依赖后同样复现，未修改命名机制。
- 最后调整 code 补全的 KeepWhitespace、重复字段抑制和字符串折叠后，定向运行 SettingsLanguage.spec.js 与 RawStrings.spec.js：25/25 项通过。
- `node scripts/test-unified-settings-runtime.cjs`：原生生成测试通过，Headless Chrome 156 运行场景 7/7 通过。
- 所有本次修改的 JS（不含用户原有 MultiFileProjectFormat/index.js）及新增测试通过 ESLint 和 Prettier；`git diff --check` 通过。
- `npm run flow -- check --max-workers 2`：全项目 659 项错误，未通过。JSON 检查显示涉及修改文件的报告主要位于原有未标注函数、WeakMap 和既有类型错误处；未宣称全项目类型检查成功。
- 本次未开展模型效率对照实验，不宣称生成准确率提升。
