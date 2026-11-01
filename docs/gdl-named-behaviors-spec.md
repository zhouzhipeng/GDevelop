# GDL 具名 behaviors 集合

状态：当前语法。作者格式 22，GDL catalog 21，instruction catalog 7。

## 对象附着行为

```text
object {
  name = "Player"
  type = Sprite
  behaviors {
    Movement {
      type = PlatformBehavior::PlatformerObjectBehavior
      properties {
        maxSpeed = 500
      }
    }
  }
}
```

实例覆盖同样使用 `behaviors { Movement { properties { … } } }`，仍只允许覆盖已附着行为，不允许声明 type。适用于所有使用对象或实例 schema 的 owner，包括场景、外部布局、Prefab、Variant 和子实例。

独立行为定义文件继续使用 `behavior { name = "Health" … }`；shared_behavior、行为函数及指令中的行为引用语法不变。

## schema、顺序与错误

- 每个 owner 最多一个 behaviors 容器；成员节点名映射到原生 name，成员内部禁止重复 name。
- 支持普通标识符及双引号成员名，包括空格、数字和特殊名称；沿用现有具名集合词法规则。
- 保持源码成员顺序及原生数组顺序，禁止按对象键枚举或排序重排。
- 重复名称、重复容器、旧 behavior 子节点、非法 owner、未知字段均在源码位置报错，不静默覆盖。
- 保留现有 type、properties、overrides、折叠、静音、继承、快捷定制和可见性规则，不添加字段透传。
- 空集合使用 behaviors {}，序列化遵循现有集合的空值省略策略；不支持 behaviors = []。
