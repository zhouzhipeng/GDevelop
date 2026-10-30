# GDevelop Language (GDL) 变量语法

作者格式 17。完整实施契约见 [统一变量描述块与 JSON 复杂值](gdl-uniform-variable-descriptors-spec.md)。

所有变量统一放在 variables 具名集合，名称作为节点名，type 必填；不重复 name，不输出 ID。

```text
variables {
  Health {
    type = "number"
    value = 10
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
  Inventory {
    type = "array"
    json = """
["Sword", {"Name": "Shield", "Count": 1}]
"""
  }
}
```

- 标量 type 为 number/string/boolean/enum，必须使用 value；enum 需要包含当前值的非空唯一字符串 values。
- 复杂 type 为 structure/array，必须使用 json，根值分别是对象/数组；与 value 互斥。
- json 和 metadata 接受通用 GDL 字符串，规范输出为 raw 多行字符串。不根据普通字符串内容推断类型。
- JSON 递归支持对象、数组、字符串、布尔、有限数字；拒绝 null、重复键、空成员名、非安全整数、注释和尾逗号。
- 根 folded/hasMixedValues 使用描述块布尔字段。后代枚举和编辑状态通过 metadata 中的非空 JSON Pointer 路径保存；~0/~1 分别表示 ~ 和 /。

```text
variables {
  State {
    type = "structure"
    json = """
{"Mode": "Idle"}
"""
    metadata = """
{
  "/Mode": {"type": "enum", "values": ["Idle", "Run"], "folded": false}
}
"""
  }
}
```

metadata 每条记录只接受 type="enum"、values、folded、hasMixedValues；路径必须指向现有后代，不能指向根。enum 只能标注字符串，values 不可单独出现。

保持变量和 JSON 对象成员源码顺序，包括数字键。数组顺序以当前模型为准。JSON 诊断映射到原始 GDL 字符范围，包括 CRLF 和转义字符串。

普通 owner 使用 variables；Extension 双作用域使用 global_variables/scene_variables。实例和事件局部变量使用相同契约。
不支持直接变量赋值、隐式结构、嵌套 variables、items/item、通用 variable 声明、name/scope/ID 字段和旧作者格式。无兼容读取或迁移。
