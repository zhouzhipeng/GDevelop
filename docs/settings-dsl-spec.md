# GDevelop Language (GDL) 当前规范与文档入口

- 状态：已实施；当前作者格式 18，GDL catalog 17，instruction catalog 7。
- 统一事件契约：[统一 GDevelop Language (GDL)：函数、事件与 JavaScript](unified-settings-events-dsl-spec.md)。当前格式将函数和事件合入同一文档，旧 `.events` 文件明确拒绝。
- 变量契约：[递归变量描述节点](settings-dsl-variable-values-spec.md)。第 8.2 节仅作摘要，完整规则由该文档维护。
- 更新日期：2026-10-31
- 范围：全部现有 `.gdl` 作者文件；项目入口 `project.gdl` 同时使用本语法
- 工作名称：GDevelop Language (GDL)
- 文件扩展名：统一使用 `.gdl`；不新增 `.layout` 文件或单独的 Layout DSL
- 决策：完整替代 TOML；只支持本规范最新语法，不提供旧语法兼容、回退、双读双写或迁移器
- 所有普通属性直接放所属节点内，不增加 `settings` 包装块。
- 实现：`newIDE/app/src/ProjectsStorage/SettingsDsl`；共享布局数据验证：`LayoutDocument`；组件拆分/组合：`MultiFileProjectFormat`。

## 文档导航与权威来源

本页是当前 GDL 作者文档的唯一入口，各专题只维护自己的契约：

- [变量](settings-dsl-variable-values-spec.md)：递归描述节点、显式类型、元数据与作用域。
- [事件与 JavaScript](unified-settings-events-dsl-spec.md)：指令、表达式、控制流、代码块、Link 和执行顺序。
- [场景生命周期](scene-event-phases-spec.md)：固定签名、必需文件与执行时机。
- [Gameplay 测试存储](gameplay-tests-multifile-serialization-spec.md)：tests.gdl、测试脚本和本地结果。
- [JavaScript API](gdevelop-javascript-authoring-api-spec.md)：生成声明与实际脚本上下文。
- [事件语义分析](gdl-event-semantics-analysis-spec.md)及[实现覆盖](gdl-event-semantics-implementation-report.md)：区分已实现分析、未知范围与后续设计。

版本权威来源分别是 SettingsDsl/SchemaInventory.js、ProjectSourceCatalog.js 和 SettingsDsl/InstructionCatalog.js。项目作者格式、GDL catalog、instruction catalog、项目模块地图是不同版本域，不要求数值相同。模块地图当前为版本 2，仅发布 settingsPath。

普通配置、指令具名参数、GDevelop 的 {{...}}、JavaScript code 字符串使用不同上下文规则。{{...}} 内不是 JavaScript；code 内才使用 JavaScript。不存在独立事件源文件，constants.toml 与 tests/*.js 是明确的独立格式。所有字段和精确指令签名以当前项目生成的 catalog 为准。

## 1. 设计结论

全部 Settings 统一使用一种参考 KDL 节点结构的声明式语言。它是独立语法，不依赖标准 KDL 解析器。普通配置使用两种基本结构：

```text
key = value

node {
  key = value
}
```

普通节点的名称、ID、对象引用都是块内部属性。不支持 `layer "world" {}`、XML 标签、TOML 表头或行内节点属性。

核心目标是让每种组件都成为可阅读、可验证、可局部修改的文档。Scene、Prefab、Variant、External、Object、Function、Behavior、Extension、Resources、Tests 和 Project 共用词法、AST、格式化和诊断系统，通过根节点及 schema 区分能力。布局是 Scene 等组件内部的语义领域，不是一种独立语言。

当前语法覆盖组件配置与布局，不改变原生运行时行为。父子实例、UI 自动布局和数据绑定未实现，不能作为可用语法。

## 2. 动机与目标

GDL 将实例变量和行为覆盖放在所属实例内，减少局部修改时的跨段落查找。设计目标：

1. 实例相关数据就近组织。
2. 人与 AI 都只需掌握少量语法规则。
3. 2D、3D 使用统一的实例变换表达。
4. UI 后续可以增加布局容器，而不另造一套文件格式。
5. 保留严格 schema、catalog 验证和准确错误位置。
6. 保留 UUID、图层顺序、全局实例顺序和现有序列化数据。
7. 对格式未知字段报错，不悄悄忽略。

对象定义、行为定义、函数签名、资源清单和测试配置都在本规范范围内。事件作者语法统一由上方当前事件契约定义。非目标：重写 JavaScript 测试正文、图片模型音频资源或生成的运行时 JSON；支持配置中的任意表达式或完整 CSS。

## 3. 文件归属

每个组件使用自己的 `.gdl` 声明文件。场景、Prefab、Variant 和 External 的配置与布局一起声明，不拆成 settings/layout 文件对。其他组件保留独立文件边界，只统一语法。

```text
scenes/Battle/
  scene.gdl
  objects/
    Player.gdl
  functions/
    sceneUpdate.gdl
  external-layout/
    BonusRoom.gdl

extensions/Combat/prefabs/Knight/
  prefab.gdl
  objects/
  functions/
  variants/Armored/
    variant.gdl
    objects/
```

归属规则：

- Scene、Prefab、Variant 使用固定文件名；External 使用具名文件。
- 名称、描述、排序、组件变量和运行配置，与背景、边界、图层、实例共同属于同一个声明文件。
- 普通属性直接放根节点；禁止额外的 `settings {}`、`metadata {}`、`layout {}` 包装块。
- 子块只用于具有结构、集合或作用域的数据，例如 variable、对象组、行为共享数据、editor、layer、instance。
- 对象定义保持独立组件；每个函数的签名和事件正文合并在一个 .gdl 文件中，统一使用 GDevelop Language (GDL)。
- 所属关系由路径确定。根 `name` 表示组件名称，必须与解码后的所属目录名（External 为文件 stem）一致；命名空间包装不再重复名称。
- 根不写 `kind`、`settingsFormatVersion` 或每文件 `version`。根节点类型提供组件种类，整个项目只支持当前 schema；`project.gdl` 的 `formatVersion` 是精确匹配的格式标记，不是版本协商入口。
- 所有 `.gdl` 只由新解析器读取，不探测 TOML。禁止根级 `layout` 包装和独立 `.layout` 布局源；同一组件数据只允许一个所有者。
- 编辑器状态暂保留在 `editor`，个人视图状态是否迁出另行评估。
- `project.gdl` 使用相同 DSL，根为 `project`，统一入口后缀为 .gdl。formatVersion 使用当前常量 18。任何不匹配直接拒绝，不尝试旧读取器。
- 事件正文合入所属 .gdl；测试 `.js` 正文不变。`constants.toml` 是显式例外，仍为独立的编辑器常量文档；它不是 settings，也不属于本轮替换。生成的 catalog JSON 与运行时 JSON 不改语法。
- 单文件内配置与布局一起验证、保存；重命名或跨文件引用更新仍须事务保存。

合并的收益是减少配对文件和所有权分界；代价是修改配置与移动实例会触及同一文件。通过内容比较和 AST 局部编辑减轻 diff，而不声称能消除文件级冲突。

### 3.1 自有配置的覆盖范围

| 组件 | 合并进入根节点或有语义的子块 | 继续独立 |
| --- | --- | --- |
| Scene | name、order、title、排序/声音/输入/加载策略、场景变量、对象组、所需行为与共享数据、全部布局 | 对象定义、生命周期函数与事件、External 组件 |
| Prefab | name、order、描述及现有 prefab 自有配置、属性声明和变量等现有自有数据、默认布局 | 对象定义、函数、各个 Variant |
| Variant | name、order、描述及现有 variant 自有配置、布局 | 自有对象定义 |
| External | name、order、描述及现有 external 自有配置、布局 | 所属场景及其对象定义 |

这里的“全部”指所有现有 settings 类别中由对应组件拥有的数据，不包含另一组件拥有的数据。不存在于当前 owner 模型的变量/属性能力不得仅因表格描述而新增。

根级 variables 是组件变量，instance.variables 是实例变量，二者作用域不同。变量 schema 尽可能复用第 8.2 节；owner 现有变量如有额外元数据必须先补齐映射，不能裁剪。

对象组、所需行为、共享数据和其他复杂配置必须逐项登记节点类型、基数、字段和默认值；禁止直接透传任意块。当前运行时模型中需要表达的数据必须显式建模；新语法不提供 rawJson、旧字段透传或兼容包装。未知字段直接报错。

字段清单以共享 SchemaInventory、SettingsDsl 节点 schema 及注册类型元数据为准，生成 catalog 发布同一结构。

多行原始字符串的完整契约见 [设计与实现说明](gdl-multiline-raw-strings-spec.md)：不转义、不插值、不去缩进，保留正文空白。

## 4. 词法与语法

### 4.1 基础规则

- 文件为 UTF-8，规范输出 LF，末尾一个换行。
- 一行一个属性；节点之间用换行分隔，不使用分号。
- 块起始 `{` 与节点类型同一行，结束 `}` 独占一行。
- 空块允许写成 `properties {}`。模型中显式存在的空容器可以保留，避免把缺失值与空集合混为一谈。已注册的空记录数组可写为其模型字段名加 `= []`，例如 animations = []；非空记录集合必须使用重复子节点，禁止混用两种表达。parameters、properties 和 shared_properties 具名集合仅使用容器块，空集合也不使用数组赋值。
- 节点名称允许 `::` 命名空间，例如 `foo::bar`；非空节点必须换行书写，指令及其 `flags` 遵守同一规则。
- 属性名使用 ASCII 标识符：`[A-Za-z_][A-Za-z0-9_]*`。
- 用户定义属性名可使用双引号，例如 `"Display Name" = "Knight"`。
- 所有字符串类型的属性值均支持两种形式：JSON 双引号字符串（支持转义）和多行原始字符串（`"""` 或更长的双引号定界符，不转义）。这是一条通用值规则，不按字段名启用，`comment.text`、description、变量字符串及指令字符串参数与 code 一致。
- `//` 表示行注释，只在字符串之外生效；不提供块注释。
- 同一块内属性名不得重复；允许重复同类型子节点。
- 属性名与子节点类型不得冲突，例如同一块不能同时存在 `properties = 1` 和 `properties {}`。
- 不支持 include、宏、插值、函数调用、路径求值或条件语句。
- 缩进仅用于阅读，不决定语义。

### 4.2 值

支持字符串、有限数字、布尔值和数组：

```text
name = "World"
visible = true
opacity = 220
zoom = 1.25
position = [100, 50, 20]
flip = ["x", "y"]
```

任意接收字符串的 `key = value` 都可以选择单行或多行形式。例如：

```text
comment {
  text = "单行注释"
}

comment {
  text = """
第一行注释
第二行注释
"""
}
```

多行正文不转义、不插值、不去缩进；定界符前后的分隔换行不属于值。字段原有的名称、枚举等语义约束仍作用于解码后的字符串。普通模型中的字符串值包含 LF 时，格式化器统一输出多行原始字符串；无法直接表示的控制字符继续使用 JSON 转义。

数字使用 JSON 数字词法，允许负数、小数和科学计数法，不允许 NaN、Infinity、十六进制、日期、前导加号。需要整数的字段必须是安全整数。数组可跨行，允许尾逗号；混合数值精度可接受，但元素类型由字段 schema 限定。

不支持 `null`。禁止匿名内联对象 `{ key = value }`；结构数据使用具名子节点。字符串中 `"{Player.Health}"` 仍然是普通字符串，不触发绑定。

### 4.3 普通配置的简化语法定义

```text
document   := node EOF
node       := IDENT "{" NEWLINE members "}" NEWLINE?
            | IDENT "{" "}" NEWLINE?
members    := (assignment | node | NEWLINE)*
assignment := key "=" value NEWLINE
key        := IDENT | STRING
value      := STRING | RAW_MULTILINE_STRING | NUMBER | BOOLEAN | array
array      := "[" (value ("," value)* ","?)? "]"
```

空白和注释由词法层处理。数组内部允许换行。上述仅描述普通配置；具名变量集合及具名变量描述块见变量契约。事件指令、{{...}} 与原始 code 字符串见事件契约。核心解析器遇到语法错误即返回诊断；编辑器另有不完整文档补全，不代表完整的容错 AST。

## 5. 根节点与上下文

文件只能包含一个根节点。具名组件要求 `name`；Project、Resources 和 Tests 等聚合根按各自 schema 定义，不强加 name。单文件不声明 version。`order` 保留现有组件排序语义；是否适用以及连续性规则由项目上下文校验，不在本次语法替换中顺便改变。

| 根节点 | 场景背景 | 边界 | 图层定义、相机、效果 | 实例 |
| --- | --- | --- | --- | --- |
| `scene` | 必需 | 禁止 | 支持 | 支持 |
| `prefab` | 禁止 | 必需 | 支持 | 支持 |
| `variant` | 禁止 | 必需 | 支持 | 支持 |
| `layout` | 禁止 | 禁止 | 仅已有图层引用 | 支持 |

本节表格针对包含空间布局的四种组件；其他根见第 5.1 节。根节点必须与 owner 类型匹配。Variant 表示当前模型中的完整变体布局，不在语法版本 1 引入差量继承或 patch 语义。

布局子块：`bounds`（0/1）、`editor`（0/1）、`layer`（0/N）、`instance`（0/N）。组件配置可另有 `variables`（0/1）及逐项登记的对象组、行为共享数据等节点。允许上下文按现有模型约束为空；不得自动添加缺失图层。

### 5.1 全部文档根类型

| 文件/组件 | 根节点 | 主要内容 |
| --- | --- | --- |
| project.gdl | project | 入口、精确格式标记、项目配置 |
| resources.gdl | resources | 资源清单 |
| tests.gdl | tests | 测试元数据与脚本引用 |
| scene.gdl | scene | 场景自有配置与布局 |
| prefab.gdl | prefab | Prefab 自有配置与默认布局 |
| variant.gdl | variant | Variant 自有配置与布局 |
| external-layout/*.gdl | layout | External 自有配置与布局 |
| objects/*.gdl | object | 对象类型、资源引用、变量、行为 |
| functions/*.gdl | function | 函数签名、参数、返回信息 |
| behaviors/*/behavior.gdl | behavior | 行为定义、自有配置与属性声明 |
| extensions/*/extension.gdl | extension | 扩展元数据与自有配置 |
| external-events/*.gdl | fragment | 外部事件元数据 |

路径中具名所有者的具体分配保持当前目录契约；表格中的 behavior 路径只表示所属作用域，不要求重构已有目录。全局、场景、Prefab 和 Variant 对象共用 object 根，所属目录决定解析作用域。生命周期函数及扩展/行为/Prefab 函数共用 function 根。

project formatVersion 固定为 18；入口、模板和读取器共用 SETTINGS_FORMAT_VERSION 常量，只接受这一值。

### 5.2 Project 与资源清单示例

```text
project {
  formatVersion = 18
  name = "Adventure"
}
```

```text
resources {
  resource {
    name = "player-idle.png"
    kind = "image"
    file = "assets/player-idle.png"
  }

  resource {
    name = "battle-theme.ogg"
    kind = "audio"
    file = "assets/battle-theme.ogg"
  }
}
```

资源名称在资源根内唯一。资源 kind 的合法值与每类资源字段由注册的资源 schema 定义；示例不授权任意扩展名或路径。资源顺序保持出现顺序。

### 5.3 Object 示例

```text
object {
  name = "Player"
  type = "Sprite"
  order = 0

  animation {
    name = "Idle"

    direction {

      frame {
        resource = "player-idle.png"
      }
    }
  }

  behavior {
    name = "Movement"
    type = "PlatformBehavior::PlatformerObjectBehavior"

    properties {
      maxSpeed = 500
    }
  }

  variables {

    Health {
      type = "number"
      value = 100
    }
  }
}
```

这是对象定义而非实例：object.behavior 可以定义附着行为及其类型；instance.behavior 只能覆盖已附着行为。动画、方向、帧、碰撞遮罩、3D 模型和材质等节点按对象类型 schema 注册，不能把 Sprite 的子节点用于所有对象。实际类型字符串、属性名称与值须由 catalog 验证。

### 5.4 Function 与 External Events 示例

```text
function {
  name = "TakeDamage"
  order = 0
  description = "对目标造成伤害"
  functionType = "Action"
  folder = []

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
```

```text
fragment {
  name = "SharedCombat"
  description = "共享战斗事件"
}
```

函数 type、返回类型、参数细分类别、对象限制和表达式规则必须按函数 schema 补齐；示例只演示组织方式。函数和 External Events 的正文使用本文件内的 events 节点，不引用独立正文文件，也不嵌入编译后事件数组或正文字符串。参数出现顺序就是签名顺序。

### 5.5 Extension 与 Behavior 定义示例

```text
extension {
  name = "Combat"
  order = 0
  description = "战斗组件"
}
```

```text
behavior {
  name = "Health"
  order = 0
  description = "生命值管理"

  properties {

    maxHealth {
      type = "Number"
      value = "100"
      label = "最大生命值"
    }
  }
}
```

这里 behavior 根定义一个行为组件；object.behavior 是附着记录；instance.behavior 是覆盖记录。三者词法相同，语义与合法字段由父节点路径区分。扩展的行为、函数和 Prefab 仍是独立组件，不在 extension 文件重复完整定义。

### 5.6 Tests 示例

```text
tests {
  test {
    name = "Player can jump"
    scope = "project"
    type = "gameplay"
    order = 0
    description = "Space starts an upward movement."
    file = "tests/Player%20can%20jump.js"
  }
}
```

测试 scope 为 project 或 extension；type 为 gameplay，order 与 description 为必需字段；扩展归属和其他元数据由 gameplay test schema 校验。脚本路径仍使用项目根相对路径，正文独立保存；最后运行结果不是作者配置。

### 5.7 Schema 完整性要求

上述示例展示作者结构，不替代完整字段表。各组件的字段类型、默认值、可选性、子节点基数、顺序、引用目标和规范输出位置由实现 schema 与项目 catalog 发布。

静态字段和类型 catalog 共同构成严格 schema。自定义对象、行为与效果的动态属性由已注册类型提供；这是最新格式的扩展机制，不是任意字段透传或旧格式兼容。

## 6. 图层与实例：顺序决定的组织选择

基础版本将 `layer` 和 `instance` 都放在根节点下：

```text
scene {
  name = "Battle"
  order = 0
  background = "#202030"

  layer {
    id = "world"
    name = "World"
  }

  instance {
    id = "ef3ef49d-f20f-4450-b373-0ce43291a002"
    object = "Player"
    layer = "world"
    position = [100, 200]
  }
}
```

这是相对早期讨论示例的明确调整：当前格式不把 instance 嵌进 layer。原因是当前模型保存全局实例顺序，可能是 World、HUD、World 交错。按图层嵌套会改变顺序，或者需要额外 `order` 字段。

这里选择保留原始顺序，不增加排序元数据：

- 根下 `layer` 的出现顺序是图层顺序。
- 根下 `instance` 的出现顺序是全局实例顺序。
- `layer.effect`、`layer.camera` 的出现顺序分别是对应数组顺序。
- 实例通过 `layer` 引用本文件图层 ID。
- 基础版本禁止 `layer.instance` 和 `instance.instance`，遇到时明确报错。

不得通过嵌套实例或重排图层改变现有全局实例顺序。

## 7. 图层、相机与效果

### 7.1 Layer

必需属性 `id`、`name`。ID 为文件局部引用，匹配 `[a-z0-9][a-z0-9-]*`；名称为运行时图层名称，基础层名称可为空字符串。两者各自唯一。

基础版本沿用现有字段名，避免同时大规模改语义词汇：

```text
layer {
  id = "world"
  name = "World"
  rendering = "2d+3d"
  camera_type = "perspective"
  camera_behavior = "do-nothing"
  visible = true
  locked = false
  lighting = false
  follow_base_camera = false
  ambient = "#C8C8C8"
  near = 3
  far = 10000
  fov = 45
  max_2d_distance = 5000

  camera {
    size = [1920, 1080]
    viewport = [0, 0, 1, 1]
  }
}
```

枚举、默认值、数值限制沿用LayoutDocument 校验规则：例如 `far > near`，透视 near 必须大于 0，FOV 为 `(0,180]`。`lighting` 指现有 2D Lighting Layer，不代表启用 3D 灯光；3D 图层不得用它替代灯光效果。

不增加 camera position、rotation 等当前 layout schema 没有的字段。它们若需要静态作者支持，应通过独立语义提案定义。

### 7.2 Camera

每层最多 50 个 `camera`。保留默认模式下的非活动值：

```text
camera {
  size = "default"
  viewport = "default"
}

camera {
  size = [640, 360]
  viewport = [0, 0, 0.5, 1]
}

camera {
  size = "default"
  stored_size = [640, 360]
  viewport = "default"
  stored_viewport = [0, 0, 1, 1]
}
```

`stored_size` 只允许与 `size = "default"` 同用；`stored_viewport` 同理。它们保留默认模式下未启用的存储值，不改变运行时默认尺寸或视口。

### 7.3 Effect

效果嵌在所属 layer 下，不重复 layer 引用：

```text
effect {
  name = "World Glow"
  type = "Effects::Glow"
  enabled = true
  folded = false

  properties {
    strength = 2
  }
}
```

`name`、`type` 必需，名称在图层内唯一。参数必须与 catalog 中该效果的参数名和类型一致。示例效果及参数须由实际项目 catalog 确认后使用。

## 8. 实例

### 8.1 身份与变换

```text
instance {
  id = "ef3ef49d-f20f-4450-b373-0ce43291a002"
  object = "Player"
  layer = "world"
  position = [100, 50, 20]
  rotation = [15, 30, 90]
  z_order = 4
  size = [64, 32]
  depth = 24
  opacity = 220
  flip = ["x", "y"]
  locked = true
  sealed = true
  hidden = false
  keep_ratio = true

  properties {
    animation = 1
    skin = "red"
  }
}
```

- `id`、`object`、`layer`、`position` 必需。
- `id` 继续使用现有小写 UUIDv4，映射 `persistentUuid`，禁止保存时重新生成。
- 不在基础版本把 `id = "player"` 当 UUID 替代品，也不增加尚无持久化位置的 alias。
- `object` 必须在 owner 的对象上下文解析，沿用现有局部/全局解析规则。
- `position` 为 `[x,y]` 或 `[x,y,z]`；基础版本是现有绝对坐标。
- `rotation` 为 Z 轴角度数值或 `[x,y,z]`，单位为度，轴与旋转语义沿用引擎；不得假设欧拉矩阵的新组合顺序。
- `size` 与 `auto_size` 互斥，后者保留未启用自定义尺寸时的存储宽高。
- `z_order` 是绘制属性，不替代全局实例顺序。
- `properties` 只允许对象 catalog 声明的数字/字符串属性。
- 其余字段默认值和限制沿用现有 layout schema；例如 opacity 为 0–255 整数。

最新 schema 不提供 `unresolved` 兼容标记。未知对象直接报错，不通过旧导入状态绕过校验。

### 8.2 变量：统一描述块

变量使用唯一 variables 容器，所有成员统一为具名描述块，type 必填。
标量使用 value；结构使用 members 中的具名描述节点，数组使用 elements 中的重复 item 描述节点；每个后代显式指定 type，枚举和编辑状态直接放在所属描述节点。变量 ID 不进入源码。
Extension 双作用域分别使用 global_variables、scene_variables，不写 scope。

```text
variables {

  CoinPitch {
    type = "number"
    value = 1
  }

  Position {
    type = "structure"
    members {
      X {
        type = "number"
        value = 10
      }
      Y {
        type = "number"
        value = 20
      }
    }
  }

  Inventory {
    type = "array"
    elements {
      item {
        type = "string"
        value = "Sword"
      }
      item {
        type = "string"
        value = "Shield"
      }
    }
  }
}
```

匿名结构字面量和旧直接 variable 声明均不支持。完整规则见[变量规范](settings-dsl-variable-values-spec.md)。

### 8.3 行为覆盖

```text
behavior {
  name = "PlatformerObject"
  folded = false
  muted = false
  inherited = false
  quick = "visible"

  properties {
    maxSpeed = 500
    acceleration = 1500
  }

  property_visibility {
    acceleration = "hidden"
  }
}
```

行为必须已经附着于对象定义，本文件只能覆盖。名称在实例内唯一。属性采用 catalog 的 serialized key 与对应类型。quick 和 property_visibility 的值为 `default`、`visible`、`hidden`。未列出的细节沿用现有行为覆盖 schema。

## 9. 背景、边界与编辑器状态

Scene 必须有 background，颜色为大写 `#RRGGBB`；不接受为旧序列化数据保留的越界 rgb 写法。

Prefab 和 Variant 必须包含整数边界：

```text
bounds {
  min = [0, 0, 0]
  max = [128, 96, 0]
}
```

Editor 是可选单例块，保留已有字段和限制：

```text
editor {
  grid = true
  grid_type = "rectangular"
  grid_size = [32, 32, 32]
  grid_offset = [0, 0, 0]
  grid_color = "#9EB4FF"
  grid_alpha = 0.8
  snap = true
  zoom = 1
  window_mask = true
  selected_layer = "HUD"
  mode = "instances-editor"
}
```

`selected_layer` 仍引用运行时图层名称，不是图层 ID。不支持 `selected_layer_unresolved`；非空选中图层必须可解析。

## 10. Scene 声明示例：配置、世界对象与固定位置 HUD

此例使用当前布局语义，不包含尚未实现的 UI 容器。Player、ScoreText 及其属性/行为应已在对象文件和 catalog 中定义。

```text
scene {
  name = "Battle"
  order = 0
  title = "Battle"
  background = "#101820"
  standardSortMethod = true
  stopSoundsOnStartup = true
  disableInputWhenNotFocused = true
  resourcesPreloading = "inherit"
  resourcesUnloading = "inherit"

  variables {

    Score {
      type = "number"
      value = 0
    }

    Paused {
      type = "boolean"
      value = false
    }
  }

  editor {
    grid = true
    grid_size = [32, 32, 32]
    snap = true
    selected_layer = "HUD"
  }

  layer {
    id = "base"
    name = ""
    rendering = "2d+3d"
    camera_type = "perspective"
    near = 3
    far = 10000
    fov = 45

    camera {
      size = "default"
      viewport = "default"
    }
  }

  layer {
    id = "hud"
    name = "HUD"
    rendering = "2d"
  }

  instance {
    id = "ef3ef49d-f20f-4450-b373-0ce43291a002"
    object = "Player"
    layer = "base"
    position = [92, 552, 20]
    rotation = [0, 30, 90]

    properties {
      animation = 1
    }

    variables {

      Health {
        type = "number"
        value = 100
      }
    }

    behavior {
      name = "PlatformerObject"

      properties {
        maxSpeed = 500
      }
    }
  }

  instance {
    id = "4a1e5377-cbe7-4078-9a51-96a1e9956411"
    object = "ScoreText"
    layer = "hud"
    position = [24, 24]
  }
}
```

## 11. Prefab 与 Variant 声明示例

```text
prefab {
  name = "Knight"
  order = 0

  bounds {
    min = [0, 0, 0]
    max = [128, 96, 0]
  }

  layer {
    id = "base"
    name = ""
  }

  instance {
    id = "01fce651-91cd-4d11-bd56-ef1370807527"
    object = "Body"
    layer = "base"
    position = [0, 0]
    size = [128, 96]

    variables {

      Health {
        type = "number"
        value = 100
      }
    }
  }
}
```

```text
variant {
  name = "Armored"
  order = 0

  bounds {
    min = [0, 0, 0]
    max = [160, 112, 0]
  }

  layer {
    id = "base"
    name = ""
  }

  instance {
    id = "01fce651-91cd-4d11-bd56-ef1370807527"
    object = "Body"
    layer = "base"
    position = [0, 0]
    size = [160, 112]

    variables {

      Health {
        type = "number"
        value = 200
      }
    }
  }
}
```

示例分别位于 prefab 和 variant 自己的文件中；UUID 是否可在不同 owner 中复用沿用现有 validator 的 context/usedInstanceUuids 规则，不新增项目全局唯一要求，也不得放宽既有要求。Variant 对象上下文沿用当前变体对象解析规则。

## 12. External 声明示例

```text
layout {
  name = "BonusRoom"
  order = 0

  layer {
    id = "world"
    name = "World"
  }

  instance {
    id = "4f0234fc-e34d-41b9-88b9-e4a73316f7be"
    object = "TreasureChest"
    layer = "world"
    position = [12, 0, 8]

    variables {

      Gold {
        type = "number"
        value = 100
      }
    }
  }
}
```

所属 Scene 由目录确定。这里 layer 仅声明文件局部 ID 到场景图层名的映射：只允许 id、name，禁止 camera、effect 和图层配置。若目标 Scene 不存在 World 图层，必须报错。外部布局没有背景、边界，也不定义对象资源。

## 13. 解析、编译与验证架构

实现流水线：

```text
源文本 → Token → 带位置的 AST → 类型化 ComponentDocument
       → catalog/context 验证 → 组件配置与布局序列化片段
```

反向：

```text
现有组件配置与布局片段 → 严格检查 → 类型化 ComponentDocument → 规范文本
```

- 不使用正则拼接代替解析器。
- AST 保留每个属性、节点、数组元素的 source range。
- 整数、枚举、向量长度、引用、上下文和重复项在语义层验证。
- 将现有验证规则提炼为共享数据层，避免复制两套渐渐分歧的 validator。
- 引用解析在整份文件解析之后进行，允许引用后定义的图层。
- Layout 不接受 rawJson；无法表达的序列化字段必须阻止导出，而不是丢弃。
- 只有项目入口 formatVersion 标识当前作者格式；它必须与实现精确匹配。catalog 可有独立生成版本，布局和各个 settings 不建立独立版本协商机制。

ComponentDocument 分别持有组件配置和 LayoutDocument，内部共享现有布局验证器；文件层只有一个所有者。

实现 API：`parseSettingsSyntax`（带 source range 的 AST）、`decodeSettingsDocument`、`serializeSettingsDocument`、`formatSettingsDsl`；`compileLayoutDocument` / `decompileLayoutDocument` 仅处理内部数据，不读取另一种文本语言。完整项目验证通过 `composeLegacyProjectFromFiles` 执行。

## 14. 错误与 AI 修改支持

错误至少包含 code、file、line、column、结束位置、节点路径和说明。例如：

```text
LAYOUT_UNKNOWN_OBJECT
scene.gdl:42:14
instance[id=ef3ef49d-f20f-4450-b373-0ce43291a002].object
Object "Playre" does not exist in this scene context.
Did you mean "Player"?
```

必须覆盖：语法错误、重复属性、未知节点/属性、版本不支持、根上下文不匹配、非法 UUID、重复实例 ID、未知图层/对象/行为、参数类型错误、非法摄像机值、外部布局越权字段。

建议提供语义工具：按 UUID/对象查询实例、更新属性、替换变量、更新行为覆盖、插入/删除实例。工具基于 AST 定位，不能字符串全局替换。删除实例应返回相关引用诊断，不自动猜测修复策略。

源文本写入后先完整校验，通过后才更新项目模型；失败保留用户文本与诊断，禁止自动覆盖为上一次正确版本。

## 15. 规范化与注释

- 两空格缩进，`=` 两侧一个空格。
- 属性先于子节点；按 schema 固定字段顺序输出。
- 根顺序：入口 formatVersion（仅 project）、name、order、其他根属性、组件 variables、其他已注册配置子块、bounds、editor、layers、instances。
- 实例顺序：id、object、layer、变换与外观、properties、variables、behaviors。
- 不按 UUID 或对象名重排实例，不按名称重排图层。
- 可省略的默认字段不输出；非活动值、有效状态标记和 UUID 必须保留。
- 格式化与模型保存保留可匹配的源码注释。当前实现优先按身份或名称匹配节点，无身份时使用父节点内同类节点的出现次序；不保证匿名节点重排后的稳定身份。JavaScript 原始内容按事件契约保留，注释不得承载必需运行语义。
- 不做单位自动换算，不把数值字符串自动转换为数字。

## 16. 只支持最新格式的读取与保存

本规范明确不考虑任何旧作者格式兼容性：

- 只有一个 GDevelop Language (GDL) 解析器和一套最新 schema。
- 生产读取器不提供 TOML settings、格式探测、旧版本分支、双读双写或 fallback。
- 不开发迁移器、升级向导、旧项目转换器或兼容测试套件。
- TOML 输入、未知根、旧命名空间包装和不匹配的项目 formatVersion 直接报错。
- 不能通过内容猜测另一种语法；报错明确说明只支持当前 GDevelop Language (GDL)。
- 现有模板、示例项目、测试夹具、内置项目 authoring skill、catalog 生成器与工具输出一并改用最新语法。更新这些仓库资产属于实现工作，不是提供历史项目迁移能力。
- 重新保存新 DSL 项目必须保持当前有效模型完整；不需要保持历史格式的文本或特殊兼容状态。

加载流程：读取 project.gdl → 检查精确 formatVersion → 根据固定目录发现 settings → 全部用新解析器解析 → 项目级引用验证 → 构建模型。

保存流程：当前模型 → 对应根的最新 schema → 规范 DSL → 校验 → 内容比较 → 原子写入。配置与布局在同一组件中一起保存；跨文件重命名/删除事务仍须保证失败不破坏当前有效项目，这属于新格式的可靠性而非兼容性。

Dirty 保存只更新发生变化的组件文件。改变场景布局不重写无关对象或函数。改变对象定义按依赖验证相关组件，不强制重写它们。

## 17. 验证与验收

1. 所有 settings 类别以及 project.gdl 仅接受本 DSL，不存在 TOML parser 或旧读取器 fallback。
2. Scene、Prefab、Variant、External 的配置与布局在同一 settings 中；不存在独立 .layout 源或 layout/settings 包装块。
3. Object、Behavior、Function、Extension、External Events、Resources、Tests、Project 都完成最新 schema 与真实可加载夹具。
4. 当前有效模型的读写往返保留字段、数组顺序、UUID、变量元数据及非活动值；不以旧文本兼容为验收目标。
5. World/HUD/World 交错实例顺序不变；重排具名属性不改变模型。
6. 语法、重复字段、未知节点、类型错误、未知引用、非法上下文有准确位置。
7. Unicode、转义、注释、CRLF、多行数组、深度与资源预算有边界用例。
8. 格式化幂等；声明顺序有语义的数组不得排序。
9. 配置/布局保存不重写无关文件；失败不破坏当前有效项目。
10. 模板、仓库示例、catalog、生成器、AI 工具和项目技能只描述最新语法。
11. 旧 TOML 输入有拒绝用例，不要求旧格式成功解析或迁移。
12. 真实大型项目测量解析耗时、文件体积、诊断耗时和 AI 局部修改效果。

当前 Syntax.js 限制源码长度为 16 × 1024 × 1024 个 JavaScript 字符、token 为 2,000,000、嵌套深度为 100；JavaScript code 字符串校验限制为 2 × 1024 × 1024 个字符。文件系统读取器另有字节和项目总量预算，不能将字符数当作 UTF-8 字节数。

## 18. 官方模板导入边界与回归（2026-10-26）

模板服务提供的原生 JSON 快照在 URL 导入边界转换为当前项目模型；这不增加旧 `.gdl` 语法的读取、回退或迁移支持。转换规则：

- 自定义行为、行为共享配置和自定义对象 `content` 仅保留模板所附扩展定义仍声明的属性，包含隐藏属性。已删除、运行时不再读取的属性不进入新项目。内建或未知类型的属性不按猜测清理。
- 全局对象、场景对象、Prefab、Variant 和嵌套子对象配置使用同一规则；有效值、子对象覆盖和其他作者数据保留。
- 旧行为包装只有在内外 `name`、`type` 完全相同时才展开。
- 非光照图层中越界的、未使用的环境光颜色恢复为原生默认值 `[200, 200, 200]`；真正光照图层和有效颜色仍严格验证。
- 本地 `.gdl` 的未知字段仍报错，不从用户文档内容推断或扩展 schema。

DSL 序列化保留对象组的声明顺序。类型的惰性加载只补充缺失 schema，不能覆盖已注册的项目自定义类型；自定义对象动画中的 `loop` 映射到原生 `looping` 字段。

完整官方 `platformer` 和 `starting-platformer` 原始 JSON 作为离线回归样本保存，不预先清理样本。回归使用真实原生引擎、扩展元数据、URL 导入转换及本地保存/读取代码，要求首次保存、重新打开、再次保存均成功，并比较有效作者数据。代码生成专用参数按生产指令 catalog 规范化后比较。

## 19. 3D 效果参数与原生数字字段补充（2026-10-26）

效果类型同时提供公开编辑属性 `parameters` 和完整序列化参数 `serializedParameters`。后者包含引擎明确声明的隐藏、deprecated 参数，严格解码与布局验证使用后者；未声明参数仍报错。旧生成 catalog 自动重建，不增加旧作者语法兼容路径。

原生 JSON 数字样本不能证明字段只允许整数。对象配置推断使用 `number`，以支持默认值为整数的小数参数，例如 3D 纹理的 `tileScale = 0.2`。已有显式整数 schema 不变。

校验临时项目不得替换编辑器真实扩展的脚本路径或依赖。加载器保留各扩展的完整元数据快照，用于校验完成或失败后的恢复；替换与卸载必须释放原生快照。实际 GUI 与运行时验证见 `template-gui-regression-report-2026-10-26.md`。
