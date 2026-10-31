# GDL 符号引用

状态：已实施。作者格式 22，GDL catalog 21，instruction catalog 7。
当前入口见 [GDL 规范](settings-dsl-spec.md)。不提供旧作者格式兼容读取。

## 值与身份

符号引用是独立于字符串和计算表达式的值种类。词法形式为
`[\p{L}_][\p{L}\p{N}_]*(?:::[\p{L}_][\p{L}\p{N}_]*)*`，支持中文及命名空间。
`true`、`false`、`null`、`NaN`、`Infinity` 不能作为引用。
引用不支持计算、插值、字符串转换或括号包装。

```text
object {
  name = "Player"
  type = Sprite
  behaviors {
    "Movement" {
      type = PlatformBehavior::PlatformerObjectBehavior
    }
  }
}
```

`name` 声明名称，`type` 引用注册类型。引用类别由字段 schema 决定；
相同拼写不会使对象、对象类型、行为附件和行为类型互相替代。
对象和类型解析仍使用现有 owner、注册类型和项目级校验。
这不引入动态类型构造或新的运行时对象查找规则。

## 适用字段

- 对象定义的 `type`：对象类型引用。
- 对象附着行为、场景共享行为的 `type`：行为类型引用。
- 行为定义的 `objectType`：对象类型引用。
- 实例的 `object`、ForEach 的 `object`：对象或当前上下文允许的对象组引用。
- 实例行为覆盖的 `behaviors` 成员名：标识已附着行为；不再使用 name 字段。行为定义的 `name` 仍为名称声明字符串。
- 指令中 valueKind 为 object/behavior 的参数：对象/行为引用。
- JavaScript 事件的 `objects`：对象或对象组引用。
- `objectGroups` 的成员数组：对象引用数组。
- `objectGroupRequiredBehaviors` 的成员数组：行为类型引用数组。
- 函数参数及表达式返回声明的 `supplementaryInformation`：当 type 为
  object/objectList/objectPtr 时为对象类型引用，为 behavior 时为行为类型引用；
  其他类型保留字符串契约。catalog 使用 `referenceKindsByType` 发布该条件。

`objectType = ""`、上述类型约束的空字符串以及 `objects = ""` 表示没有约束或
没有对象选择，是空值标记，不是带引号的符号引用。其他非空引用必须裸写。
资源名称、路径、图层标识、普通文本、枚举标签和名称声明保持原有字符串契约。

## 解析与保存

AST 使用 `reference: true` 标记引用值，并保存原始 source range。
原生模型仍使用字符串存储符号身份；解码器检查引用种类后投影原生值，
序列化器依据 schema 重建裸引用，不从模型字符串内容猜测种类。
数组元素分别保留引用标记和位置。引用字段拒绝字符串及计算表达式，
普通字符串字段和变量初始值拒绝符号引用。

在允许表达式的指令参数及循环字段中，单个裸符号也可以作为原生表达式的
叶节点，例如 `count = Count`；这不允许引用字段接受计算表达式。
格式化保留字符串与符号的区别，不把 `"Player"` 自动改成 `Player`。

作者格式从 18 升至 19，GDL catalog 从 17 升至 18。原生指令身份及参数
valueKind 不变，instruction catalog 仍为 7。

回归覆盖类型与实例引用、Unicode、命名空间、具名参数类型约束、引用数组、
错误类型、源码位置、编辑器补全、存储往返、原生事件代码生成及浏览器执行。
