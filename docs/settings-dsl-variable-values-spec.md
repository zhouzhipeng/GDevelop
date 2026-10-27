# GDevelop Language (GDL) 变量语法

状态：已实施。更新日期：2026-10-27。当前作者格式版本为 12，Settings catalog 版本为 10；本文件变量规则与统一事件契约共同生效。

变量直接声明在所属 owner 下。普通值使用数据字面量；需要为后代保存枚举、身份或编辑状态时，使用嵌套 variable 声明。禁止 metadata 节点和 path 注解。无历史作者语法兼容读取、迁移、回退或双写。

## 1. 普通声明

```text
scene {
  name = "Game Scene"

  variable {
    name = "CoinPitch"
    value = 1
  }

  variable {
    name = "Controllers"
    value = [{ Buttons = [{ State = "Idle" }], Joystick = {} }]
  }
}
```

禁止 variables、sceneVariables、globalVariables 集合包装和具名标量简写。变量只能声明在原生模型已支持的 owner 上。

## 2. 数据字面量

value 支持 string、有限 number、boolean、结构和数组；根据值推导原生类型。可显式指定一致的 type，规范输出省略可推导类型。null、NaN、Infinity、表达式和引用均不支持。

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

结构键沿用标识符/双引号字符串规则；字段以换行或逗号分隔。数组元素以逗号分隔。均允许尾逗号。空结构和空数组必须保留；异构数组继续可表达。value 内的 type、id、variable 等键只代表普通数据。

结构字面量在语义层仅允许 variable.value 使用，不开放其他组件的任意字段。

## 3. 信息直接写在变量声明内

```text
variable {
  name = "Mode"
  type = "enum"
  value = "Idle"
  values = ["Idle", "Run"]
  folded = false
  id = "a9ab811d-91cf-4b76-95a3-81d9cd86156b"
}
```

enum 必须显式声明；values 为非空、无重复字符串数组，且包含当前 value。非 enum 禁止 values。folded 和 hasMixedValues 必须为布尔值，包括显式 false 都要保留。

id 可省略，不自动生成 UUID。已有身份供编辑器重命名/引用重构使用，保存时保留。非空 id 必须为小写 UUIDv4，空字符串表达原生显式空 UUID；禁止 persistentUuid 作者字段。

## 4. 嵌套声明

当子元素有附加信息时，将该容器展开为 variable 子节点，并显式写 type = "structure" 或 "array"。此时容器不写 value；禁止同时使用 value 和子节点。

```text
variable {
  name = "Controllers"
  type = "array"

  variable {
    type = "structure"

    variable {
      name = "State"
      type = "enum"
      value = "Idle"
      values = ["Idle", "Pressed", "Released"]
      id = "a9ab811d-91cf-4b76-95a3-81d9cd86156b"
    }

    variable {
      name = "Joystick"
      value = {}
      folded = true
    }
  }
}
```

- 结构子变量必须有非空、唯一 name。
- 数组子变量禁止 name；出现顺序就是数组顺序。
- 子变量可继续使用普通 value 字面量，也可递归展开容器。
- scope 只能出现在双作用域 owner 的根变量，不允许写在子变量上。
- 空展开容器允许，但规范输出使用 value = {} 或 value = []。
- 序列化在后代确有附加信息时展开必要的祖先容器；没有附加信息的分支保留字面量。
- 身份、枚举和编辑状态随元素一起移动，数组插入、删除不需要维护独立路径。
- metadata 节点无论是否包含 path 都明确拒绝，不提供旧语法回退。

## 5. 作用域

普通 owner 由所属节点决定作用域，不写 scope。Extension 原生同时包含 globalVariables 与 sceneVariables，根变量必须指定 scope = "global" 或 "scene"。同一 owner、同一 scope 变量名称唯一；不同 scope 可同名。规范化先输出 global，再输出 scene，各自保持原有顺序。

## 6. 保存与诊断

编译仍产生原生 variable.children 树，不改变运行时变量 API。根变量和数组顺序始终有语义；结构字段保存源顺序。原生 map 中转排序时依据同版本已有源码恢复结构字段顺序，新字段追加。AST 使用有序条目，数字字符串键不被宿主对象排序；__proto__、constructor 等作为普通键安全处理。

语法节点与值字面量共享深度、token 和文件预算。编译与序列化按树遍历，拒绝重复结构子名、数组子名、嵌套 scope、类型冲突、无效 enum、非法身份及混用 value/子节点。错误指向相关字段或节点源码位置。未知字段不透传。

实现来源：SettingsDsl/Syntax.js、Variables.js、index.js、SchemaInventory.js、ProjectSourceCatalog.js。格式变更后旧 catalog 自动重建；旧作者格式明确拒绝。

## 7. 验收

覆盖普通 CoinPitch/Controllers 字面量、全体变量 owner、Extension 双作用域、异构/空容器、数字字符串和原型名称键、根与后代身份和编辑状态、嵌套 enum、数组前插后身份与约束跟随原元素、错误位置与预算限制，以及拒绝 metadata 和集合包装。保存/读取回归包括原生引擎模型与完整官方模板。
