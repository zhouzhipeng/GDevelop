# Settings DSL 变量语法修订草案

状态：已批准实施。日期：2026-10-26。

本修订取代 `settings-dsl-spec.md` 第 8.2 节及其他章节的变量示例。作者格式版本为 9；旧版本 8 的变量语法不再支持。

## 问题与目标

现有语法将原生变量树逐层暴露为 `variables/sceneVariables/globalVariables → variable → variable`，重复书写 name、type、value。简单变量也多一层集合容器，复杂数组难以阅读。

新设计明确分开两件事：`variable {}` 声明变量身份、作用域及编辑元数据；`value` 表达实际数据。禁止变量集合包装和递归 variable 子节点。继续保留名称、值、enum、UUID、折叠状态及现有变量模型的其他有效元数据。

非目标：增加运行时变量类型、改变事件语义、支持表达式/函数调用、引入任意对象字段或给其他组件开放 raw JSON。

## 1. 直接声明多个 variable

```text
scene {
  name = "Game Scene"

  variable {
    name = "CoinPitch"
    value = 1
    id = "a9ab811d-91cf-4b76-95a3-81d9cd86156b"
  }

  variable {
    name = "Score"
    value = 0
  }
}
```

不再允许 `variables {}`、`sceneVariables {}` 或 `globalVariables {}`。普通变量一律使用 variable 声明，不再提供另一套具名标量简写。

变量直接属于其声明所在的现有 owner。Scene、Project、Object、Instance、Prefab 等只能声明其原生模型已经支持的变量，不能因为语法统一而增加新的变量容器。

## 2. value 使用数据字面量

支持 string、number、boolean、结构字面量及数组字面量。实际结构不再重复 type/name/value：

```text
variable {
  name = "Controllers"
  value = [
    {
      Buttons = [
        { State = "Idle" }
      ]
      Joystick = {}
    }
  ]
}
```

结构内部是 `key = value`，数组内部直接放值。数组元素无 name，位置就是索引。保留所有键与值，不将 Joystick 等空结构省略。

```text
variable {
  name = "PlayerState"
  value = {
    Health = 100
    Alive = true
    Inventory = ["Sword", "Shield"]
    Position = { X = 10, Y = 20, Z = 0 }
    "Display Name" = "Knight"
    Options = {}
    History = []
  }
}
```

`{}` 明确表示空结构；`[]` 明确表示空数组。字段名为 type、value、id、metadata、variable 等时，在 value 内都只是普通数据，没有隐藏含义。

### 类型推导

| value | 原生变量类型 |
| --- | --- |
| `1`、`0.2` | number |
| `"Idle"` | string |
| `true` | boolean |
| `{ ... }` | structure |
| `[ ... ]` | array |

type 可以显式书写，但必须与值一致；规范化输出对可推导类型省略 type。例如 `type = "number"` 配 `value = "1"` 必须报错，不能隐式转换。

变量 value 中 `[1, 2, 3]` 始终是原生 array 变量，不因长度为 2 或 3 而变成向量类型。其他字段的数组仍按原有字段 schema 验证。

不支持 null、未声明类型、引用、表达式、NaN 或 Infinity。不增加“array of number”之类的运行时类型。原生数组允许的异构元素继续可表达，按每个元素的值分别推导。

## 3. 作用域由 owner 决定

普通 owner 不重复书写 scope。例如 scene 下的 variable 是场景变量，instance 下的是实例变量。

现有 Extension 模型同时有 globalVariables 和 sceneVariables 两套默认变量，无法仅凭 owner 判定。因此只在这种双容器 owner 上要求显式 scope，取值为 global 或 scene：

```text
extension {
  name = "SpriteMultitouchJoystick"

  variable {
    scope = "scene"
    name = "Controllers"
    value = [
      {
        Buttons = [{ State = "Idle" }]
        Joystick = {}
      }
    ]
  }

  variable {
    scope = "global"
    name = "ControllerCount"
    value = 1
  }
}
```

这保留原生两套变量的区别，不增加包装块。单容器 owner 禁止多余 scope；双容器 owner 缺少 scope 必须报错，不猜默认作用域。同一 owner、同一 scope 下变量名必须唯一，不同 scope 可同名。

## 4. enum 与根变量元数据

```text
variable {
  name = "Mode"
  type = "enum"
  value = "Idle"
  values = ["Idle", "Run", "Jump"]
  folded = false
  id = "a9ab811d-91cf-4b76-95a3-81d9cd86156b"
}
```

enum 不能仅从字符串推导，必须显式声明。values 非空、值唯一，且包含当前 value。非 enum 禁止 values。

根 variable 允许现有模型需要的编辑元数据，例如 folded、hasMixedValues。id 可省略，DSL 不为变量自动生成 UUID。编辑器变量重构使用已有身份对比编辑前后快照，因此保存时保留模型中已有 id。id 映射到该变量模型的 UUID；非空值沿用 UUIDv4 约束，`id = ""` 表达原生模型显式保存的空 UUID。不再另设 persistentUuid 作者字段。缺省与显式空值按原生容器既有规则映射，不能生成或丢弃已有 UUID。

## 5. 子元素元数据使用独立路径注解

普通数据采用字面量后，仍需无损保存少数子元素的 UUID、enum、折叠状态等。为此允许 variable 内重复 metadata 节点，不恢复递归 variable，也不往值中塞保留键。

```text
variable {
  name = "Controllers"
  value = [
    {
      Buttons = [{ State = "Idle" }]
      Joystick = {}
    }
  ]

  metadata {
    path = [0, "Buttons", 0, "State"]
    type = "enum"
    values = ["Idle", "Pressed", "Released"]
    id = "a9ab811d-91cf-4b76-95a3-81d9cd86156b"
  }

  metadata {
    path = [0, "Joystick"]
    folded = true
  }
}
```

规则：

- metadata 只在需要保存实际元数据时输出，不为每个子元素生成空注解。
- path 从当前变量的 value 开始；字符串定位结构字段，非负整数定位数组元素。`"0"` 与 `0` 不同。
- path 必须非空并且精确指向已有元素；不自动创建字段、补数组空洞或转换结构类型。根变量元数据直接放在 variable 内。
- 同一路径最多一条 metadata，不允许相互覆盖。
- metadata 不允许 name 或 value，只能修饰已有值的类型约束及现有编辑元数据。enum 是显式类型注解；其他 type 必须与目标字面量一致。
- 数组插入、删除、移动时，编辑器基于变量模型和 AST 同步更新路径；格式化只改排版，不改变数组顺序。

这是一条用于无损往返的补充规则。普通 Controllers 示例不需要任何 metadata 节点。

## 6. 词法、语法和 AST

新增值语法：

```text
value := string | number | boolean | array | object
array := '[' (value (',' value)* ','?)? ']'
object := '{' (key '=' value (separator key '=' value)* separator?)? '}'
separator := ',' | newline+
```

数组可跨行，但元素之间必须有逗号。结构字段可用换行或逗号分隔，支持尾逗号。结构键沿用现有标识符/双引号字符串规则，拒绝重复键。

只有 `=` 之后的 `{` 才开始值字面量；节点名之后的 `{` 仍是节点块，因此 `variable {}` 与 `value = {}` 无歧义。允许紧凑值 `{ State = "Idle" }`，不改变普通节点目前的多行声明规则。

语法 AST 必须保留结构条目的源顺序、重复键位置和注释位置，不能只用 JavaScript 普通对象表示结构条目，否则数字字符串字段名会被 Object.keys 重新排序。`__proto__`、constructor 等作为结构数据键安全处理，不影响宿主对象原型。

结构字面量在词法层可解析，但语义层只允许 variable.value 使用；其他普通组件字段不能借此绕过原有 schema。metadata.path 的混合字符串/整数数组是此字段的显式类型。

## 7. 编译、序列化与诊断

- 声明顺序决定同一容器根变量顺序；结构条目与数组元素均保持顺序，不自动按名称排序。
- 编译 value 字面量为现有原生 variable.children 树，随后应用 metadata。原生运行时数据结构、事件引用和变量 API 均不改变。
- 序列化从现有原生变量树产生字面量，并只为确有附加元数据的后代输出路径注解。原生有效元数据必须先登记映射，不能静默丢弃。
- Extension 中两套原生变量容器分别保存其内部顺序；规范化时先输出 global，再输出 scene。
- 空变量集合规范化为没有 variable 节点；值中的空结构、空数组必须保留。
- 诊断区分重复变量、重复结构键、未知作用域、类型不符、非法 enum、重复路径和不存在的路径，并指向具体键、值或 path 分量的源码位置。
- 词法节点块与值字面量共用既有深度、节点数、文件大小等预算；不能各自给一份预算叠加绕过限制。解析与基本编译保持线性复杂度，元数据定位成本与路径总长度成正比。

## 8. 影响文件与实施顺序

1. `SettingsDsl/Syntax.js`：结构字面量、嵌套数组、条目顺序与位置信息。
2. `SettingsDsl/index.js`、`SchemaInventory.js`：直接 variable 声明、owner/scope 映射、字面量变量树及路径元数据编解码；移除旧变量容器与递归 variable 编解码。
3. `LayoutDocument`、`MultiFileProjectFormat`：实例变量直接嵌入 instance，保留持久身份及原生变量树映射；同步作者格式版本。
4. `ProjectSourceCatalog`、`SettingsLanguage`：生成 schema、文档与补全同步；按生成契约提升 catalog 版本，让缓存重建。
5. 模板/技能说明、完整 Settings DSL 规范及示例同步替换。原生 JSON 模板导入继续使用原生变量模型，保存时输出新语法。
6. 完成单元、真实原生模型、多文件保存及完整官方模板回归，再按仓库流程构建桌面版。

## 9. 兼容性与验收

只支持修订后的最新作者格式。不保留旧 variables、sceneVariables、globalVariables 包装块、递归 variable 或旧标量简写；不增加兼容读取、降级、回退或双写。源码版本不符或旧语法出现时明确拒绝。外部模板服务的原生 JSON 数据不是旧 DSL 作者格式，导入后正常输出最新语法。

必须覆盖：

1. 用户提出的 CoinPitch 与 Controllers 示例。
2. 多个根 variable、所有现有 owner 与 Extension 双作用域。
3. 多层结构/数组、混合元素、空值集合、带空格/数字/原型名称的键，以及顺序保存。
4. 根与后代 UUID、显式空 UUID、折叠状态、hasMixedValues、enum 的无损往返。
5. 重复名、重复键、错误类型、非法 scope、无效路径和超预算输入的拒绝及准确位置。
6. 旧包装及旧递归语法的明确拒绝。
7. 三个现有官方完整模板的保存、读取、再保存；运行时变量值与事件表现不改变。

## 10. 替代方案与评审点

继续使用递归 variable 无法解决重复样板问题；将值变成 JSON 字符串会丢失结构校验、定位及编辑能力；完全移除元数据会破坏有效项目的无损保存。全量使用带类型的构造器也会使简单数据重新变得繁琐，因此不采用。

建议采用本草案的统一值字面量，type 默认推导。需要重点评审的两处是：双容器 Extension 要求显式 scope；罕见子元素元数据使用 path 注解。这两处承担原生模型中确实存在、不能丢失的信息。
