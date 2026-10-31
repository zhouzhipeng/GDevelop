# GDevelop Language (GDL) 变量语法

作者格式 18，GDL catalog 17，instruction catalog 7。完整契约见 [递归变量描述节点](gdl-uniform-variable-descriptors-spec.md)。

所有变量放在 variables 具名集合，名称作为节点名，每个描述节点的 type 必填；不重复 name，不输出 ID。

```text
variables {
  Health {
    type = "number"
    value = 100
  }

  Player {
    type = "structure"
    members {
      Mode {
        type = "enum"
        value = "Idle"
        values = ["Idle", "Run"]
        folded = false
      }
      Inventory {
        type = "array"
        elements {
          item {
            type = "string"
            value = "Sword"
          }
          item {
            type = "structure"
            members {
              Name {
                type = "string"
                value = "Shield"
              }
              Count {
                type = "number"
                value = 1
              }
            }
          }
        }
      }
    }
  }
}
```

- 标量 type 为 number/string/boolean/enum，必须使用 value；enum 还需要包含当前值的非空唯一字符串 values。
- structure 必须有唯一 members 容器，其成员为具名描述节点，名称非空且唯一。
- array 必须有唯一 elements 容器，其成员只能是重复 item 描述节点，出现顺序即数组顺序；数组元素没有 name。
- 每个后代都使用同一描述规则，支持任意受预算限制的嵌套和异构数组。
- 空结构使用 `members {}`，空数组使用 `elements {}`，不能省略容器。
- folded/hasMixedValues 是所属描述节点的可选布尔属性；显式 false 保留。后代枚举也直接在所属节点写 type/value/values。
- 字符串支持 JSON 双引号或多行原始字符串。禁止 null、非有限数字和非安全整数。
- 禁止 json、metadata、JSON Pointer 映射、ID、scope、直接赋值、隐式结构、嵌套 variables 和旧 items 容器；item 仅用于 elements 内。
- 普通 owner 使用 variables；Extension 双作用域使用 global_variables/scene_variables；实例和事件局部变量使用相同契约。
- 根变量和数组顺序以当前模型为准；结构成员保留作者顺序，包括数字名称。模型保存时恢复可匹配的结构成员顺序。

只接受作者格式 18，不提供兼容读取、迁移或双写。
