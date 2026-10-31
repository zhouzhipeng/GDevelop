# GDL catalog 节点 schema 清理

版本说明：本文版本号记录该次变更的历史基线与升级过程，不代表当前版本。当前作者格式为 18，GDL catalog 为 17，instruction catalog 为 7；以 [GDL 当前规范](settings-dsl-spec.md) 及其列出的代码常量为准。

状态：已批准并实施；仅修改生成 catalog 契约，不修改 GDL 作者语法。

## 问题与现状

当前 GDL 使用 `node { ... }`，但 ProjectSourceCatalog 仍发布
`layoutTables` 和 `table`，验证器及序列化器也依赖这些名称。
对象配置推断代码还保留 `childTables`、TOML `header` 和 `emptyForm`。
其中对象 schema 先参与类型注册，再在最终生成时被 getObjectSettingsSchema
转换为解析器使用的 schema；因此保留推断路径并改用节点描述。
SchemaInventory 也保留旧表
描述，实施时须区分仍参与当前 schema 的数据和不再使用的历史定义。

## 目标与非目标

生成的作者指导只描述当前 GDL 节点、字段和基数。清除 TOML 表声明提示，
保持当前解析、序列化、布局顺序、变量及事件语义不变。
不修改 constants.toml，不迁移历史作者语法，不手改用户项目的生成文件。

## 提议契约

- GDL catalog formatVersion 从 11 升为 12。
- 顶层 `layoutTables` 及 `counts.layoutTables` 改为 `layoutNodes`。
- 布局条目仅以 `node` 标识，移除 `table` 别名；唯一性校验使用
  `node` 和可选 variant，并校验 node 是非空字符串。
- 当前节点 schema 使用 `childNodes`；子节点名称使用当前 schema 的
  node 标识及基数约定，禁止用 TOML 点路径代替节点嵌套。
- 生成的 schema 不含 `table`、`childTables`、TOML `header` 或
  TOML `emptyForm` 提示。重复节点的空集合通过省略节点表达，不提供
  `name = []` 作为替代声明。
- 保留字段本身合法的数组值及其他非语法元数据。

## 影响范围与实施顺序

1. 追踪 SettingsDsl/SchemaInventory 和当前 getSettingsSchemas 导出路径，
   检查节点名称、基数及注册对象类型 schema；清除可确认无消费者的旧表
   推断代码，仍使用的部分改为当前节点描述。
2. 修改 ProjectSourceCatalog 的构建、验证、计数、序列化与版本。
3. 全仓搜索并更新实际消费者、MCP 输出、测试及模板文档中的契约引用；
   不改无关历史记录或 TOML 常量文档。
4. 验证本地项目加载/保存会重建旧版本生成 catalog，且不会把旧 schema
   注册为当前作者元数据。

## 兼容、错误处理与发布

这是生成元数据的版本变更，不保留旧字段别名。沿用严格版本检查和现有
catalog 重建机制；若某入口缺少重建，应在其现有生成流程补齐。
无可用引擎元数据时按现有错误机制报告，不静默使用版本 11。
作者格式版本和 instruction catalog 版本不变。

## 性能

不增加项目遍历；使用现有 schema 和生成流程。删除无效中间推断可减少
工作，但不以性能重构扩大范围。

## 验证

- catalog 构建、严格验证、计数和序列化测试覆盖 layoutNodes，拒绝旧版本。
- 对真实生成 catalog 递归断言不存在旧 schema 键及 TOML 声明提示。
- 覆盖嵌套对象节点、重复节点以及当前层/相机/效果/行为/实例 schema。
- 本地多文件项目回归：旧生成 catalog 重建，新 catalog 保存、重开一致。
- 运行相关 ProjectSourceCatalog、SettingsDsl、LocalMultiFileProject 和受影响
  MCP 测试及格式检查；代码完成后按 AGENT.md 启动 macOS 后台构建启动器，
  不等待构建或应用启动结果。

## 替代方案与开放问题

仅删除 table 而保留 layoutTables 会继续暴露过时概念；保留别名会使作者
指导继续混杂旧语法，因此均不采用。无待用户选择的功能问题；实施以
实际当前解析器 schema 为权威，不根据旧 TOML 描述猜测节点名称。
