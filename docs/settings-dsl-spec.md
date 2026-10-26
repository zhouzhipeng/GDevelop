# GDevelop Language (GDL) 规范提案

- 状态：已批准实施；当前语法格式版本 12
- 统一事件契约：[统一 GDevelop Language (GDL)：函数、事件与 JavaScript](unified-settings-events-dsl-spec.md)。作者格式 12 将函数和事件合入同一文档，旧 `.events` 文件明确拒绝。
- 已批准的变量语法修订：[直接 variable 声明与值字面量](settings-dsl-variable-values-spec.md)。已取代第 8.2 节及相关变量示例。
- 日期：2026-10-25
- 范围：全部现有 `.gdl` 作者文件；项目入口 `project.gdevelop` 同时使用本语法
- 工作名称：GDevelop Language (GDL)
- 文件扩展名：统一使用 `.gdl`；不新增 `.layout` 文件或单独的 Layout DSL
- 决策：完整替代 TOML；只支持本规范最新语法，不提供旧语法兼容、回退、双读双写或迁移器
- 所有普通属性直接放所属节点内，不增加 `settings` 包装块。
- 实现：`newIDE/app/src/ProjectsStorage/SettingsDsl`；共享布局数据验证：`LayoutDocument`；组件拆分/组合：`MultiFileProjectFormat`。

## 1. 设计结论

全部 Settings 统一使用一种参考 KDL 节点结构的声明式语言。它是独立语法，不依赖标准 KDL 解析器。整套语法只提供两种基本结构：

```text
key = value

node {
  key = value
}
```

所有名称、ID、对象引用都是块内部属性。不支持 `layer "world" {}`、XML 标签、TOML 表头或行内节点属性。

核心目标是让每种组件都成为可阅读、可验证、可局部修改的文档。Scene、Prefab、Variant、External、Object、Function、Behavior、Extension、Resources、Tests 和 Project 共用词法、AST、格式化和诊断系统，通过根节点及 schema 区分能力。布局是 Scene 等组件内部的语义领域，不是一种独立语言。

第一版完整覆盖所有当前组件自有配置与布局数据，不因替换作者语法而改变运行时行为。父子实例、UI 自动布局和数据绑定作为独立扩展讨论，不隐含包含在基础版本中。

## 2. 动机与目标

当前标准 TOML 本身不是错误选择，但当前扁平布局把实例、实例变量、行为覆盖分成多个数组，通过 UUID 关联。局部修改需要跨段落查询；UI 树形结构也难以自然表达。

本提案希望实现：

1. 实例相关数据就近组织。
2. 人与 AI 都只需掌握少量语法规则。
3. 2D、3D 使用统一的实例变换表达。
4. UI 后续可以增加布局容器，而不另造一套文件格式。
5. 保留严格 schema、catalog 验证和准确错误位置。
6. 保留 UUID、图层顺序、全局实例顺序和现有序列化数据。
7. 对格式未知字段报错，不悄悄忽略。

对象定义、行为定义、函数签名、资源清单和测试配置都在本规范范围内。事件作者语法统一由上方格式 12 契约定义。非目标：重写 JavaScript 测试正文、图片模型音频资源或生成的运行时 JSON；支持配置中的任意表达式或完整 CSS。

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
- 根不写 `kind`、`settingsFormatVersion` 或每文件 `version`。根节点类型提供组件种类，整个项目只支持当前 schema；`project.gdevelop` 的 `formatVersion` 是精确匹配的格式标记，不是版本协商入口。
- 所有 `.gdl` 只由新解析器读取，不探测 TOML。禁止根级 `layout` 包装和独立 `.layout` 布局源；同一组件数据只允许一个所有者。
- 编辑器状态暂保留在 `editor`，个人视图状态是否迁出另行评估。
- `project.gdevelop` 使用相同 DSL，根为 `project`，保留引导入口文件名。formatVersion 使用最新常量 11。任何不匹配直接拒绝，不尝试旧读取器。
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

根级 variable 是组件变量，instance.variable 是实例变量，二者作用域不同。变量 schema 尽可能复用第 8.2 节；owner 现有变量如有额外元数据必须先补齐映射，不能裁剪。

对象组、所需行为、共享数据和其他复杂配置必须逐项登记节点类型、基数、字段和默认值；禁止直接透传任意块。当前运行时模型中需要表达的数据必须显式建模；新语法不提供 rawJson、旧字段透传或兼容包装。未知字段直接报错。

完整字段枚举是生产实施前的必过项；字段清单以共享 SchemaInventory、SettingsDsl 节点 schema 及注册类型元数据为准，生成 catalog 发布同一结构。

## 4. 词法与语法

### 4.1 基础规则

- 文件为 UTF-8，规范输出 LF，末尾一个换行。
- 一行一个属性；节点之间用换行分隔，不使用分号。
- 块起始 `{` 与节点类型同一行，结束 `}` 独占一行。
- 空块允许写成 `properties {}`。模型中显式存在的空容器可以保留，避免把缺失值与空集合混为一谈。已注册的空记录数组可写为其模型字段名加 `= []`，例如 parameters = []；非空记录集合必须使用重复子节点，禁止混用两种表达。
- 属性名使用 ASCII 标识符：`[A-Za-z_][A-Za-z0-9_]*`。
- 用户定义属性名可使用双引号，例如 `"Display Name" = "Knight"`。
- 字符串必须使用双引号；转义采用 JSON 字符串规则。
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

数字使用 JSON 数字词法，允许负数、小数和科学计数法，不允许 NaN、Infinity、十六进制、日期、前导加号。需要整数的字段必须是安全整数。数组可跨行，允许尾逗号；混合数值精度可接受，但元素类型由字段 schema 限定。

不支持 `null`。只有 variable.value 允许内联对象 `{ key = value }`；其他结构数据使用子节点。字符串中 `"{Player.Health}"` 仍然是普通字符串，不触发绑定。

### 4.3 简化语法定义

```text
document   := node EOF
node       := IDENT "{" NEWLINE members "}" NEWLINE?
            | IDENT "{" "}" NEWLINE?
members    := (assignment | node | NEWLINE)*
assignment := key "=" value NEWLINE
key        := IDENT | STRING
value      := STRING | NUMBER | BOOLEAN | array
array      := "[" (value ("," value)* ","?)? "]"
```

空白和注释由词法层处理。数组内部允许换行。上述为说明性语法；实现时须补足错误恢复、文件末尾换行和注释处理规则。

## 5. 根节点与上下文

文件只能包含一个根节点。具名组件要求 `name`；Project、Resources 和 Tests 等聚合根按各自 schema 定义，不强加 name。单文件不声明 version。`order` 保留现有组件排序语义；是否适用以及连续性规则由项目上下文校验，不在本次语法替换中顺便改变。

| 根节点 | 场景背景 | 边界 | 图层定义、相机、效果 | 实例 |
| --- | --- | --- | --- | --- |
| `scene` | 必需 | 禁止 | 支持 | 支持 |
| `prefab` | 禁止 | 必需 | 支持 | 支持 |
| `variant` | 禁止 | 必需 | 支持 | 支持 |
| `external` | 禁止 | 禁止 | 仅已有图层引用 | 支持 |

本节表格针对包含空间布局的四种组件；其他根见第 5.1 节。根节点必须与 owner 类型匹配。Variant 表示当前模型中的完整变体布局，不在语法版本 1 引入差量继承或 patch 语义。

布局子块：`bounds`（0/1）、`editor`（0/1）、`layer`（0/N）、`instance`（0/N）。组件配置可另有 `variable`（0/N）及逐项登记的对象组、行为共享数据等节点。允许上下文按现有模型约束为空；不得自动添加缺失图层。

### 5.1 全部文档根类型

| 文件/组件 | 根节点 | 主要内容 |
| --- | --- | --- |
| project.gdevelop | project | 入口、精确格式标记、项目配置 |
| resources.gdl | resources | 资源清单 |
| tests.gdl | tests | 测试元数据与脚本引用 |
| scene.gdl | scene | 场景自有配置与布局 |
| prefab.gdl | prefab | Prefab 自有配置与默认布局 |
| variant.gdl | variant | Variant 自有配置与布局 |
| external-layout/*.gdl | external | External 自有配置与布局 |
| objects/*.gdl | object | 对象类型、资源引用、变量、行为 |
| functions/*.gdl | function | 函数签名、参数、返回信息 |
| behaviors/*/behavior.gdl | behavior | 行为定义、自有配置与属性声明 |
| extensions/*/extension.gdl | extension | 扩展元数据与自有配置 |
| external-events/*.gdl | external_events | 外部事件元数据 |

路径中具名所有者的具体分配保持当前目录契约；表格中的 behavior 路径只表示所属作用域，不要求重构已有目录。全局、场景、Prefab 和 Variant 对象共用 object 根，所属目录决定解析作用域。生命周期函数及扩展/行为/Prefab 函数共用 function 根。

project formatVersion 固定为 11；入口、模板和读取器共用 SETTINGS_FORMAT_VERSION 常量，只接受这一值。

### 5.2 Project 与资源清单示例

```text
project {
  formatVersion = 12
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

  variable {
    name = "Health"
    value = 100
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

  parameter {
    name = "Target"
    type = "object"
    description = "目标对象"
  }

  parameter {
    name = "Amount"
    type = "expression"
    description = "伤害数值"
  }
}
```

```text
external_events {
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

  property {
    name = "maxHealth"
    type = "Number"
    value = "100"
    label = "最大生命值"
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

上述非布局示例定义作者结构，不替代完整字段表。实现前每个现有 settings 类别必须建立字段清单：字段类型、默认值、可选性、子节点基数、顺序、引用目标、插件扩展点与规范输出位置。没有完成全部类别就不算本规范实施完成，不能仅替换 Scene 后继续让其他 settings 使用 TOML。

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

这是相对早期讨论示例的明确调整：基础版本不把 instance 嵌进 layer。原因是当前模型保存全局实例顺序，可能是 World、HUD、World 交错。按图层嵌套会改变顺序，或者需要额外 `order` 字段。

这里选择保留原始顺序，不增加排序元数据：

- 根下 `layer` 的出现顺序是图层顺序。
- 根下 `instance` 的出现顺序是全局实例顺序。
- `layer.effect`、`layer.camera` 的出现顺序分别是对应数组顺序。
- 实例通过 `layer` 引用本文件图层 ID。
- 基础版本禁止 `layer.instance` 和 `instance.instance`，遇到时明确报错。

如果评估认为“实例必须嵌进图层”优先级更高，则需重新评审排序方案，不能静默改变现有行为。

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

枚举、默认值、数值限制沿用现有 layout v1 schema：例如 `far > near`，透视 near 必须大于 0，FOV 为 `(0,180]`。`lighting` 指现有 2D Lighting Layer，不代表启用 3D 灯光；3D 图层不得用它替代灯光效果。

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

`stored_size` 只允许与 `size = "default"` 同用；`stored_viewport` 同理。它们不是新的运行时能力，只是对应现有 TOML `{ default = [...] }` 的无损表达。

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

### 8.2 变量：直接声明和值字面量

变量直接放在所属 owner 下，不使用 variables、sceneVariables 或 globalVariables 包装，不递归嵌套 variable。

```text
variable {
  name = "CoinPitch"
  value = 1
  id = "a9ab811d-91cf-4b76-95a3-81d9cd86156b"
}

variable {
  name = "Controllers"
  value = [
    {
      Buttons = [{ State = "Idle" }]
      Joystick = {}
    }
  ]
}
```

字符串、数字、布尔、结构和数组按 value 推导类型；enum 显式声明 type 和非空 values。空结构与空数组分别是 {} 和 []。普通 owner 的作用域由位置决定；Extension 同时拥有 global、scene 默认变量时，variable 必须声明 scope。

原生 UUID、折叠状态和 enum 约束直接放在所属 variable 声明；后代有附加信息时使用嵌套 variable，容器显式声明 structure/array 且不写 value。禁止 metadata 节点和路径注解。结构字段和数组元素均保留顺序。完整规则、例子和错误要求见 [变量语法规范](settings-dsl-variable-values-spec.md)。

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

  variable {
    name = "Score"
    value = 0
  }
  variable {
    name = "Paused"
    value = false
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

    variable {
      name = "Health"
      value = 100
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

    variable {
      name = "Health"
      value = 100
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

    variable {
      name = "Health"
      value = 200
    }
  }
}
```

示例分别位于 prefab 和 variant 自己的文件中；UUID 是否可在不同 owner 中复用沿用现有 validator 的 context/usedInstanceUuids 规则，不新增项目全局唯一要求，也不得放宽既有要求。Variant 对象上下文沿用当前变体对象解析规则。

## 12. External 声明示例

```text
external {
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

    variable {
      name = "Gold"
      value = 100
    }
  }
}
```

所属 Scene 由目录确定。这里 layer 仅声明文件局部 ID 到场景图层名的映射：只允许 id、name，禁止 camera、effect 和图层配置。若目标 Scene 不存在 World 图层，必须报错。外部布局没有背景、边界，也不定义对象资源。

## 13. 当前数据模型与新节点映射（不是兼容读取规则）

| 当前逻辑位置 | 新 DSL 位置 | 语义变化 |
| --- | --- | --- |
| owner settings 的 name、order、普通配置 | 组件根属性 | 不再使用 scenes.<name> 等包装 |
| owner settings 的组件变量 | 根 variable | 与 instance.variables 区分 |
| owner settings 的对象组、共享数据等 | 根下已注册的语义子块 | 全量字段 schema 必须明确 |
| owner kind | 根节点类型 | 不重复写字段 |
| settingsFormatVersion | 删除 | 仅入口 formatVersion 标识最新项目格式 |
| layout.version | 删除 | 不设置独立布局语法版本 |
| layout.background | scene.background | 无 |
| layout.bounds | prefab/variant.bounds | 无 |
| layout.editor | 根 editor | 无 |
| layout.layers | 根 layer | 保留出现顺序 |
| layers.cameras | layer.camera | 数组改重复节点 |
| layout.effects | layer.effect | layer 引用由归属取代 |
| effects 的参数字段 | effect.properties | 隔离参数与结构字段 |
| layout.instances | 根 instance | 保留全局顺序 |
| instances.at | instance.position | 仅改名 |
| instances 的其他字段 | instance 同名字段 | 无 |
| instances.properties | instance.properties | 内联表改块 |
| layout.variables | instance.variable | 去掉 instance UUID 反向引用 |
| variables.children | variable.value | 普通字面量；附加信息随嵌套 variable 声明保存 |
| layout.behaviors | instance.behavior | 去掉 instance UUID 反向引用 |
| camera.size/viewport 默认对象 | 默认标记与 stored_* | 无损拆分 |

本规范替代旧作者语法；当前运行时字段语义可参考：`docs/gdevelop-layout-toml-spec.md`；实际实现位于 `newIDE/app/src/ProjectsStorage/LayoutToml/index.js`。文档与代码如有差异，实施前必须先补齐明确的规范修订，不能依赖猜测。

## 14. 未来扩展：层级与 UI 布局（非 v1）

以下只展示语法发展方向，基础版本解析器必须拒绝这些未启用的节点/字段。这些能力加入时直接更新最新 schema 与项目格式常量，不保留旧语法分支，不允许猜测处理。

```text
scene {
  name = "Battle"
  order = 0
  background = "#101820"

  layer {
    id = "world"
    name = "World"
  }

  layer {
    id = "hud"
    name = "HUD"
  }

  instance {
    id = "ef3ef49d-f20f-4450-b373-0ce43291a002"
    object = "Knight"
    layer = "world"
    position = [0, 0, 0]

    instance {
      id = "4a1e5377-cbe7-4078-9a51-96a1e9956411"
      object = "Sword"
      position = [0.4, 1, 0]
    }
  }

  screen {
    layer = "hud"
    reference_size = [1920, 1080]
    scale_mode = "fit"

    row {
      anchor = "top-left"
      padding = 24
      gap = 12

      instance {
        id = "01fce651-91cd-4d11-bd56-ef1370807527"
        object = "PlayerAvatar"
        size = [64, 64]
      }
    }
  }
}
```

实现之前必须回答：

1. 子实例如何持久化父引用、继承旋转缩放、处理运行时销毁和 reparent？
2. 跨层父子关系是否允许？隐藏、透明度、碰撞是否继承？
3. 层级展开顺序与当前全局实例顺序如何兼容？
4. UI 容器是否产生运行时实体？如何获得文本/图片的内在尺寸？
5. fit、窗口宽高比、安全区、屏幕坐标与相机如何组合？
6. 布局驱动属性与事件修改位置发生冲突时，谁拥有最终值？
7. 绑定如何更新、校验、检测循环和处理来源实例不存在？

这些不能用简单“编译成绝对坐标”解决所有动态场景。应作为独立模型和运行时设计评审。

## 15. 解析、编译与验证架构

建议流水线：

```text
源文本 → Token/CST → 带位置的 AST → 类型化 ComponentDocument
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

## 16. 错误与 AI 修改支持

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

## 17. 规范化与注释

- 两空格缩进，`=` 两侧一个空格。
- 属性先于子节点；按 schema 固定字段顺序输出。
- 根顺序：入口 formatVersion（仅 project）、name、order、其他根属性、组件 variable、其他已注册配置子块、bounds、editor、layers、instances。
- 实例顺序：id、object、layer、变换与外观、properties、variable、behaviors。
- 不按 UUID 或对象名重排实例，不按名称重排图层。
- 可省略的默认字段不输出；非活动值、有效状态标记和 UUID 必须保留。
- 直接格式化工具应通过 CST 保留注释；编辑器模型重存首版允许移除注释，与当前 canonical-source 策略一致。该限制须在编辑器中说明，注释不得承载必需语义。
- 不做单位自动换算，不把数值字符串自动转换为数字。

## 18. 只支持最新格式的读取与保存

本规范明确不考虑任何旧作者格式兼容性：

- 只有一个 GDevelop Language (GDL) 解析器和一套最新 schema。
- 删除生产路径中的 TOML settings 读取/写入、格式探测、旧版本分支、双读双写、兼容适配和 fallback。
- 不开发迁移器、升级向导、旧项目转换器或兼容测试套件。
- TOML 输入、未知根、旧命名空间包装和不匹配的项目 formatVersion 直接报错。
- 不能通过内容猜测另一种语法；报错明确说明只支持当前 GDevelop Language (GDL)。
- 现有模板、示例项目、测试夹具、内置项目 authoring skill、catalog 生成器与工具输出一并改用最新语法。更新这些仓库资产属于实现工作，不是提供历史项目迁移能力。
- 重新保存新 DSL 项目必须保持当前有效模型完整；不需要保持历史格式的文本或特殊兼容状态。

加载流程：读取 project.gdevelop → 检查精确 formatVersion → 根据固定目录发现 settings → 全部用新解析器解析 → 项目级引用验证 → 构建模型。

保存流程：当前模型 → 对应根的最新 schema → 规范 DSL → 校验 → 内容比较 → 原子写入。配置与布局在同一组件中一起保存；跨文件重命名/删除事务仍须保证失败不破坏当前有效项目，这属于新格式的可靠性而非兼容性。

Dirty 保存只更新发生变化的组件文件。改变场景布局不重写无关对象、函数或 events。改变对象定义按依赖验证相关组件，不强制重写它们。

## 19. 验证与验收

1. 所有 settings 类别以及 project.gdevelop 仅接受本 DSL，不存在 TOML parser 或旧读取器 fallback。
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

资源预算按实际读取器内存预算确定，设置节点深度、token 数与文件体积上限。阈值在实施中测量定稿。

## 20. 实施范围与待定细节

已确定：全量替换 settings 语法；保留 .gdl；配置直接放根；统一解析器；只支持最新格式；没有独立 Layout DSL；不提供任何旧语法兼容。

建议实施顺序：

1. 完成所有根类型及组件字段 schema 清单，明确原字段到新属性/节点的映射。
2. 实现共享词法、CST/AST、诊断和规范格式化。
3. 接入全部组件读写、入口引导和跨文件引用检查，移除旧 settings TOML 路径。
4. 更新全部模板、样例、夹具、catalog、AI 工具、编辑器语言支持和文档。
5. 验证新格式预览、导出、重载与保存；不加入历史格式读取或迁移阶段。

仍需评估的细节：实例根级排列、UUID 与别名、编辑器个人状态边界、各组件完整字段名。它们不重新打开“是否保留 TOML”或“是否兼容旧格式”的决策。

父子实例、UI 自动布局和绑定属于另行设计的模型能力，不因语法替换自动实现。


## 21. 实施与验证记录（2026-10-25）

当前实现的作者格式固定为 8；所有 settings 根与项目入口使用 SettingsDsl。LayoutDocument 只包含共享数据验证及模型投影，不提供 TOML 读取入口。旧 settings TOML 读写、JSON 项目自动迁移及旧示例兼容性运行器已移除。Constants TOML 与 IfDo 正文保持各自的格式。

字段结构的实施来源：

- `newIDE/app/src/ProjectsStorage/SettingsDsl/Syntax.js`：语法、AST/source range、注释与格式化。
- `newIDE/app/src/ProjectsStorage/SettingsDsl/SchemaInventory.js`：静态组件字段清单。
- `newIDE/app/src/ProjectsStorage/SettingsDsl/index.js`：严格节点 schema、动态类型注册、组件编解码与变量归属投影。
- `newIDE/app/src/ProjectsStorage/LayoutDocument/index.js`：2D/3D 布局数据校验。
- `newIDE/app/src/ProjectsStorage/ProjectSourceCatalog.js`：发布实际节点 schema 和注册类型信息；catalog 格式版本为 6。
- `newIDE/app/src/CodeEditor/SettingsLanguage.js`：现有 Monaco 版本的语法高亮、格式化及实时语法诊断。

回归覆盖包括全部组件根、本地事务/恢复、首次打开和 catalog 重建、MCP 校验/生成、实际引擎模型保存、Sprite 多边形、物理行为字段、全局实例顺序、UUID、非活动相机尺寸、变量树、拒绝未知字段与 TOML、以及随项目分发的 GDevelop Language (GDL) 示例。

存储、MCP 与编辑器语言的完整相关测试：17 个测试套件，291 项测试、5 个快照通过。命令为 `CI=true npm test -- --watchAll=false --runInBand src/ProjectsStorage src/CodeEditor/SettingsLanguage.spec.js src/Mcp/McpEditorBridge.spec.js`（在 newIDE/app 运行）。

1,200 个实例、每实例一个变量的测量样本约 237,584 字符；一次本机测量为序列化含自校验 30ms、独立解析 18ms、模型验证 5ms。它是单次开发机结果，不是性能承诺。实例变量、行为和效果的归组使用索引，避免按实例重复扫描全部记录。

全量 Flow 检查仍受仓库其他文件的现有错误阻塞；相关单元测试和针对修改文件的 ESLint 为独立检查。桌面构建/启动按仓库流程交给后台启动脚本，其完成状态不能由上述测试结果推断。


### 2026-10-26：模板行为字段注册修正

注册行为字段时，以初始化后的引擎默认序列化内容及已验证的属性映射为准，不把编辑器属性名直接作为序列化键。隐藏、废弃属性仍可包含有效的运行时数据：例如编辑器 UseLegacyTrajectory 对应保存字段 useLegacyTrajectory。未知字段继续拒绝，不引入旧格式兼容或任意字段透传。

读取默认内容会恢复借用的元数据实例；没有序列化绑定的 shared-data wrapper 单独处理，不再使正常行为默认字段一起丢失。生成的 settings catalog 版本更新为 6，使旧的生成缓存重新构建；作者格式仍为 8。

本次修正验证：17 个相关测试套件、296 项测试及 5 个快照通过；覆盖轨迹标志 true/false 的对象往返、首次保存与重新打开、旧 catalog 缓存重建，以及借用元数据实例的状态恢复。修改文件的 ESLint 与格式检查通过。

## 22. 官方模板导入边界与回归（2026-10-26）

模板服务提供的原生 JSON 快照在 URL 导入边界转换为当前项目模型；这不增加旧 `.gdl` 语法的读取、回退或迁移支持。转换规则：

- 自定义行为、行为共享配置和自定义对象 `content` 仅保留模板所附扩展定义仍声明的属性，包含隐藏属性。已删除、运行时不再读取的属性不进入新项目。内建或未知类型的属性不按猜测清理。
- 全局对象、场景对象、Prefab、Variant 和嵌套子对象配置使用同一规则；有效值、子对象覆盖和其他作者数据保留。
- 旧行为包装只有在内外 `name`、`type` 完全相同时才展开。
- 非光照图层中越界的、未使用的环境光颜色恢复为原生默认值 `[200, 200, 200]`；真正光照图层和有效颜色仍严格验证。
- 本地 `.gdl` 的未知字段仍报错，不从用户文档内容推断或扩展 schema。

DSL 序列化保留对象组的声明顺序。类型的惰性加载只补充缺失 schema，不能覆盖已注册的项目自定义类型；自定义对象动画中的 `loop` 映射到原生 `looping` 字段。

完整官方 `platformer` 和 `starting-platformer` 原始 JSON 作为离线回归样本保存，不预先清理样本。回归使用真实原生引擎、扩展元数据、URL 导入转换及本地保存/读取代码，要求首次保存、重新打开、再次保存均成功，并比较有效作者数据。代码生成专用参数按生产指令 catalog 规范化后比较。

## 23. 3D 效果参数与原生数字字段补充（2026-10-26）

生成的 Settings catalog 版本为 7；作者文件语法版本仍为 8。效果类型同时提供公开编辑属性 `parameters` 和完整序列化参数 `serializedParameters`。后者包含引擎明确声明的隐藏、deprecated 参数，严格解码与布局验证使用后者；未声明参数仍报错。旧生成 catalog 自动重建，不增加旧作者语法兼容路径。

原生 JSON 数字样本不能证明字段只允许整数。对象配置推断使用 `number`，以支持默认值为整数的小数参数，例如 3D 纹理的 `tileScale = 0.2`。已有显式整数 schema 不变。

校验临时项目不得替换编辑器真实扩展的脚本路径或依赖。加载器保留各扩展的完整元数据快照，用于校验完成或失败后的恢复；替换与卸载必须释放原生快照。实际 GUI 与运行时验证见 `template-gui-regression-report-2026-10-26.md`。


## 24. 变量修订实施（2026-10-26）

当前作者格式为 9，生成 Settings catalog 为 8。直接 variable 声明、复合 value 字面量、Extension 双作用域与 metadata 路径注解取代旧变量容器。省略 id 不会由 DSL 编解码器生成 UUID；已有 id 用于编辑器变量重构，保存时保留。

原生结构变量使用有序 map，编辑器中转会按键排序。保存器依据同版本已有源码保留结构字面量字段顺序，新增字段追加；比较原生项目时结构按名称比较，根变量和数组顺序仍有语义且不得重排。格式化 AST 独立保留所有结构键的源顺序，包括数字字符串键。

## 25. 嵌套变量声明修订（2026-10-26）

当前作者格式为 10，生成 Settings catalog 为 9。变量的 type、values、id、folded、hasMixedValues 与对应值放在同一 variable 内，移除 metadata/path。普通数据继续使用 value 字面量；后代有附加信息时展开必要祖先容器，显式 type = "structure" 或 "array"，禁止 value 与子声明混用。结构子变量具名且唯一，数组子变量无名且按出现顺序排列。旧 metadata 写法明确拒绝。完整契约见变量语法规范。

## 26. 统一事件作者格式（2026-10-26）

作者格式 12、Settings catalog 10、instruction catalog 3。函数和外部片段正文只保存在其 .gdl 的顶层 events 中。conditions/actions 使用无 if/do 前缀的精确 catalog 指令；执行事件使用 event.type，默认 standard；group/comment/link 为独立节点；子节点直接嵌套；JavaScript 使用原始多行 code 块。移除旧 IfDo 解析器及 .events 配对读写。完整边界、模型映射和验收见统一事件契约。
