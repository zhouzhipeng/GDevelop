# GDL 具名 behaviors 集合

状态：用户已批准并实施。作者格式 22，GDL catalog 21，instruction catalog 7。

## 问题与目标

对象附着行为及实例行为覆盖目前使用重复的 `behavior { name = "…" }`。
改为与 parameters、properties 一致的具名集合，减少重复名称声明并集中行为配置。
不改变原生项目模型、行为执行顺序、运行时接口或独立行为文件的根节点。

## 当前与拟议行为

旧写法：

```text
object {
  name = "Player"
  type = Sprite
  behavior {
    name = "Movement"
    type = PlatformBehavior::PlatformerObjectBehavior
  }
}
```

新写法：

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

## 影响层与文件

- SettingsDsl/index.js、SchemaInventory.js：对象和布局实例 schema、具名集合编解码及动态行为类型属性。
- SettingsDsl/Syntax.js、引用分析、CodeEditor/SettingsLanguage.js：检查具名成员上下文、补全、诊断、重命名及引用绑定，保留成员名的行为身份。
- ProjectSourceCatalog.js：发布与实际解析一致的具名集合 schema。
- MultiFileProjectFormat、LayoutDocument、EventsSemantics：确认消费者经原生模型读取行为，修复任何直接依赖旧 AST 的路径。
- 同步当前文档、模板、bundled 作者指导及相关 fixtures；不直接修改用户项目或生成 catalog。

## 版本、兼容与发布

作者格式由 19 升至 20，GDL catalog 由 18 升至 19；instruction catalog 保持 7。
不支持旧语法、旧版本读取、迁移器、fallback 或双写。新解析器、序列化器、catalog、补全、模板及文档同批发布。
Core/GDJS 原生序列化数据及运行时 API 保持不变。

## 性能

集合编解码保持线性遍历，沿用有序 AST 和名称索引；仅新增常量级容器深度。不宣称运行时性能收益。

## 验证与交付

覆盖对象附着行为及实例覆盖的多成员、空集合、特殊名称、顺序、全部元数据和往返等价。
覆盖重复容器/名称、内部 name、旧写法、错误 owner、实例 type 及未知属性的拒绝。
验证独立 behavior 根节点不受影响，行为类型解析、名称引用、重命名、补全和 catalog 契约一致。
运行 SettingsDsl、SettingsLanguage、ProjectSourceCatalog、MultiFileProjectFormat 和相关语义分析回归及修改文件的格式/lint 检查。
代码完成后遵循 AGENT.md，后台派发 macOS 构建启动脚本，不等待或宣称最终构建结果。

## 替代方案与开放问题

只在旧重复节点外增加 behaviors 容器会保留 name 冗余，不采用。
保留两种作者语法会增加解析、补全及文档维护成本，不采用。
不将本次扩展到 animations、effects 或其他集合。无待定产品决策。

## 实施验证记录（2026-10-31）

- 对象附着行为与全部布局 owner 的实例覆盖使用唯一具名 behaviors 集合，独立 behavior 根节点保留。
- 动态行为属性 schema、源码位置、补全、catalog、作者指导及 fixtures 已同步；旧重复节点及空数组赋值拒绝。
- 新增 14 项回归，覆盖特殊名称与顺序、元数据、属性、四类布局 owner、独立定义和非法输入；原有存储、原生模型往返及事件语义分析回归同时通过。
- SettingsDsl、SettingsLanguage、ProjectSourceCatalog、MultiFileProjectFormat、LocalMultiFileProject、EventsSemantics、McpEditorBridge：20 套、525 项全部通过。
- 修改 JavaScript 文件的 ESLint（零 warning）及 git diff --check 通过。快捷定制可见性的枚举描述去掉多余的 or，使合法 hidden 值通过现有枚举校验。
- 交付前按 AGENT.md 后台派发 macOS 构建启动脚本；不等待或报告最终构建/启动结果。
