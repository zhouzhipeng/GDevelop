# GDL 具名集合与变量简写

版本说明：本文版本号记录该次变更的历史基线与升级过程，不代表当前版本。当前作者格式为 18，GDL catalog 为 17，instruction catalog 为 7；以 [GDL 当前规范](settings-dsl-spec.md) 及其列出的代码常量为准。

历史规范：变量简写部分已被 [统一变量描述块规范](gdl-uniform-variable-descriptors-spec.md) 的格式 18 取代。参数与属性具名集合仍有效。

状态：已批准并实施。作者格式 16，GDL catalog 15。

## 问题与目标

当前 variable、parameter、property 重复声明 name，常见数据过于冗长。
统一使用具名集合容器，保持 `node { key = value }` 的结构；集合元素名称作为键或节点名。
保留变量身份、枚举和编辑状态、参数全部约束及属性描述符全部元数据。
不改变原生项目模型、运行时行为或事件执行顺序。

## 新语法

```text

function {
  name = "TakeDamage"
  functionType = "Action"

  parameters {

    Target {
      type = "object"
      description = "目标对象"
    }

    Amount {
      type = "expression"
      description = "伤害数值"
    }
  }
}

behavior {
  name = "Health"

  properties {

    maxHealth {
      type = "Number"
      value = "100"
      label = "最大生命值"
    }
  }
}

scene {
  name = "Game"

  variables {
    Health = 100
    Inventory = ["Sword", "Shield"]

    Position {
      X = 10
      Y = 20
    }

    Mode {
      type = "enum"
      value = "Idle"
      values = ["Idle", "Run"]
    }
  }
}
```

### 具名参数和属性

- 参数统一放在唯一的 parameters 块内；每个子节点名称即参数 name。
- 属性描述符统一放在唯一的 properties 块内；每个子节点名称即属性 name。
- 子节点内禁止再次声明 name；其余字段沿用各 owner 的现有 schema，不推导或更改默认值类型。
- 不增加 `Amount = "expression"` 等第二套参数简写。
- 参数顺序即签名顺序，属性保持原有记录顺序；重复名称报错。
- 共享属性描述符使用 shared_properties，避免与普通 properties 争用同一个容器。
- 已有 properties 值映射（实例覆盖、行为配置等）继续按原 owner 的 schema 解释；不误判为属性描述符集合。
- 空集合用 parameters {}、properties {}、shared_properties {}，不再用相应的 `= []`。

### 变量

- 原先允许变量声明的 owner 改为接收唯一 variables 容器，包括事件局部变量。
- `名称 = 标量或数组` 声明普通变量，数组允许异构和递归数组。
- `名称 { ... }` 声明结构变量；内部递归使用相同规则。空块表示空结构。
- 去掉匿名结构字面量；数组里的结构元素用具名结构相同的成员语法表达，但以具名描述块 数组声明承载，不另引入匿名块元素。
- 不提供通用变量声明节点；复杂变量直接以自身名称作为描述节点。
- 具名描述块保留 type、value、values、folded、hasMixedValues；不重复 name，不输出变量 ID。
- 完整结构声明的子成员放进 variables {}，不再直接重复 variable 子节点。
- 完整数组声明通过 items {} 中重复 item {} 表达；每个 item 使用具名变量描述块字段但禁止 name，子结构使用 variables，子数组使用 items。
- 数组中存在结构或后代元数据时，使用完整数组声明；纯标量及递归纯数组使用赋值简写。
- 同一集合简写与完整声明共享名称唯一性检查；名为 variable 或无法作为节点名的变量可使用完整声明。
- Extension 的双作用域变量分别使用 global_variables {}、scene_variables {}，禁止 scope 字段；单作用域 owner 使用 variables {}。
- 结构内业务字段 type、id 等是普通变量名，只有完整声明内部才解释为元数据。
- 序列化优先简写；只有元数据、数组结构元素或名称表达限制需要时才输出完整声明。

## 表达式直接引用属性

按用户确认，表达式直接使用属性名，不要求 getProperty 方法或 properties 前缀：

```text
setProperty {
  name = "Height"
  value = {{ Height + 1 }}
}
```

Height 表示运行时当前属性值，不是声明时默认值或编译期字面量。

### 名称查找与遮蔽

- 对表达式中可作为值引用的裸标识符，优先查找当前 owner 作用域中可见的属性，再查找原有变量作用域链：**属性 > 变量**。
- 属性不存在时，变量仍沿用引擎原有局部、owner、场景、全局等适用作用域和优先级；不重新定义变量之间的查找规则。
- 同名属性遮蔽变量，无论变量的作用域有多近；不得因期望类型不同而回退到变量。
- 找到属性但原生表达式不支持该类型时，报告属性类型错误；保留引擎已有的合法数值/文本转换。例如文本属性 Height 与数值变量 Height 同名，数值运算仍按文本属性校验，不能改读变量。
- 同名变量可通过现有原生显式变量访问表达式读取；沿用已有作用域访问能力，不为本方案另加一种变量语法。
- 属性可见性依据当前 owner 和既有访问控制；首个实施范围为已有属性别名支持的行为函数文件。其他 owner 只有已有明确属性作用域时才接入，不按名称搜索其他对象、行为或文件。
- 不可见属性不参与查找；既无可见属性也无变量时，沿用原生未解析名称的诊断规则，不隐式新建属性或改变变量创建语义。
- 仅可用作表达式标识符的属性名支持裸引用；特殊名称继续使用现有显式原生属性访问能力，本轮不新增括号访问语法。

### 语法边界与编译

- 此规则用于 {{ ... }} 中的属性值引用，包括指令参数和已有允许表达式的循环字段；普通字符串、普通 settings 值和 JavaScript code 不参与。
- 只解析表达式 AST 中的裸值引用，不改写字符串内容、函数调用名称、显式对象/行为成员或命名空间限定引用。
- 结构变量的成员键不单独参与属性查找；显式变量访问及其后续成员读取保持原有含义。
- 通过既有原生表达式 AST 绑定属性身份并生成属性读取代码，读取运行时当前值；不通过正则或全文字符串替换实现。
- 数字、文本、布尔属性按原生表达式类型能力校验；原生表达式无法承载的类型给出明确诊断，不伪造转换或更改运行时接口。
- GDL 编译、补全、重命名、引用分析、诊断、语义分析和模型转回 GDL 使用同一名称解析规则。模型转回裸引用前验证绑定身份，不能让原本的变量读取变成属性读取；必要时输出原生显式变量表达式。
- 移除表达式别名 getProperty(name=...)，不提供兼容读取。conditions 中的 getProperty {} 和 actions 中的 setProperty {} 节点调用保持当前职责，本节只替换表达式读取形式。

### 验证

覆盖属性单独存在、变量单独存在、同名属性遮蔽最近局部变量、类型错误不回退、显式变量读取、嵌套事件和循环字段。
覆盖文本/数字/布尔类型能力、属性可见性、owner 边界、未知名称、函数同名、成员同名、命名空间和字符串不误改写。
覆盖属性/变量重命名、补全绑定、原生模型往返身份不变，以及旧 getProperty 表达式别名拒绝。

## 词法、诊断与顺序

普通标识符作为动态节点名；允许双引号动态节点名，例如 `"Display Name" { ... }`，仅在具名集合上下文合法。
赋值键继续支持双引号。非空块仍要求换行，不引入节点头参数、分号或同行字段。
解析器保留混排赋值和子节点的源码顺序，不使用 JavaScript 对象枚举顺序表示集合。
重复容器、重复名称、键与节点重名、未知字段、错误 owner、非法元数据均在原始源码位置报错。
文件、token、深度预算覆盖新增容器；不引入任意 JSON 透传。

## 影响层与实施文件

- SettingsDsl/Syntax.js：上下文允许具名集合的字符串节点名，保留有序成员及注释。
- SettingsDsl/Variables.js、index.js、Events.js：新集合与原生模型双向映射、局部变量和 schema 校验。
- SettingsDsl/SchemaInventory.js、ProjectSourceCatalog.js：集合 schema、作者提示、格式版本和 catalog 更新。
- GDL 补全、诊断、源码编辑、变量结构顺序恢复、事件分析消费者同步新 AST 契约。
- BehaviorPropertySyntax.js、InstructionOperands.js 及原生表达式解析/绑定接口：用属性优先的裸引用替换 getProperty 表达式别名，不能只修改输出文本。
- MultiFileProjectFormat 及项目入口校验：使用新版本；模板、bundled skill、当前文档和所有相关 fixtures 同步。
- parameter/property 的调用点按现有所有 owner 逐一覆盖，不仅修改本文示例中的 function/behavior。
- Core/GDJS 原生序列化数据和运行时 API 不变。

## 兼容性与发布

按用户要求，不考虑任何兼容性：不保留旧语法读取、旧版本支持、迁移器、双写或 fallback。
作者格式升级至 16，GDL catalog 升级至 15；不因本变更改变 instruction catalog 内容版本。
新版本编译器、生成 catalog、模板、补全和文档同批更新。旧语法明确报错。

## 性能

解析、校验和序列化保持线性遍历；新增集合容器只增加常量级层级成本。
用有序 AST 成员表达集合，名称索引用 Map，避免排序和数字键重排。

## 验证与交付

覆盖所有变量 owner、Extension 双作用域、事件局部变量、空集合、嵌套结构、异构数组、结构数组、元数据、枚举、身份、特殊名称、数字名称和原型名称。
覆盖全部参数/属性描述符 owner、共享属性、原有 properties 值映射、签名顺序、重复名称和未知字段。
验证新作者文本与原生模型往返等价、格式化幂等、注释和混排成员顺序、补全和 catalog 一致性。
旧重复声明、匿名结构字面量、旧空集合写法和旧格式版本必须拒绝。
执行相关 SettingsDsl、catalog、MultiFileProjectFormat、补全和语义分析测试；代码实施完成后按 AGENT.md 启动 macOS 后台构建启动脚本。

## 替代方案与待审阅决策

全部展开为 variable 节点最统一但过于冗长，已由用户否定。
保留匿名结构值和展开声明会继续维护两套结构语法，不采用。
本方案保留复杂变量的显式声明作为必要扩展点；数组使用 items/item，避免让数组元素冒充具名变量。
已批准采用 shared_properties、global_variables/scene_variables 和复杂数组 items/item。


## 实施验证记录（2026-10-30）

- 新语法、模型映射、格式化、catalog、补全、事件静态分析和 bundled 作者指导已同步。
- 使用既有原生表达式 AST 实现裸属性引用；在 ProjectScopedContainers 统一调整属性优先级，保留引擎原有合法类型转换。
- `SettingsDsl`（排除下述固定名称测试）、`ProjectSourceCatalog`、`MultiFileProjectFormat`、`CodeEditor/Settings*`、`EventsSemantics` 定向回归：17 套、302 项通过。包含与属性同名的事件局部变量的原生代码生成及保存往返。
- ProjectsStorage、CodeEditor/Settings*、EventsSemantics 扩大回归：31 套中 30 套通过，449 项通过、1 项失败，5 个快照通过。失败为未修改的 SystemInstructionNames 覆盖测试：condition `Distance3D` 缺少固定作者名称映射。
- 重编译 `GDCore_tests` 与 `libGD.js` 并通过官方复制脚本同步测试/编辑器运行库。
- 原生 `ExpressionParser2,WholeProjectRefactorer,ExpressionCompletionFinder`：4,344 条断言通过。
- GDevelop.js 行为与自定义对象代码生成集成回归：32 项通过。
- 原生全量测试在 `ArbitraryResourceWorker / ExposeLayoutResources` 的 bitmapFonts 资源计数断言失败；未修改该资源测试或资源扫描逻辑。
- 修改的 JavaScript 文件 Prettier、ESLint（零 warning）及 `git diff --check` 通过。
- 全仓 `flow check --show-all-errors` 未通过，报告 657 个错误；包含既有 UI、WeakMap 泛型及 catalog 类型问题。此次新增的具名集合补全类型错误已修复。
- 桌面构建和启动按 AGENT.md 在交付前以后台脚本派发；不等待或宣称其最终构建/启动结果。


## 用户修订：完全移除通用变量声明

变量始终使用 variables 容器内的赋值或具名节点，不生成通用 variable 节点，也不重复 name。变量 id/persistentUuid 不再写入源码或参与保存等价比较。枚举、编辑状态和复杂数组使用自身名称作为描述节点。描述块由 value 或合法 type 识别；有 value/type 业务字段的结构用 type="structure" 加 variables 显式承载。实例、事件及所有 owner 同步规则。

修订验证：ProjectsStorage、CodeEditor/Settings*、EventsSemantics 回归排除已知固定名称覆盖失败后，30 套、448 项和 5 个快照通过。另对用户 My project17 做只读整项目加载、重新分解与重组等价验证，确认所有生成 .gdl 均无通用变量声明；该项目的场景、扩展和入口版本标记已同步修正。新增变量 ID 忽略覆盖生命周期事件及外部布局，实例自身 UUID 仍参与等价校验。
