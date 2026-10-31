# GDL 递归变量描述节点

状态：用户已批准并实施。当前作者格式 18，GDL catalog 17，instruction catalog 7。

本契约替代格式 17 的 json 复杂值和 metadata JSON Pointer 映射。当前语法摘要与完整示例见 [变量语法](settings-dsl-variable-values-spec.md)。

## 统一结构

GDL 保持两种基本结构：`key = value` 和 `node { ... }`。复杂变量不再通过字符串嵌入 JSON，也不引入匿名对象字面量、反引号数据、动态求值或插值。

根变量和结构成员是具名描述节点。数组元素是固定名称 item 的描述节点。每个描述节点显式指定 type，合法值为 number、string、boolean、enum、structure、array。

| type | 必需内容 | 禁止内容 |
| --- | --- | --- |
| number/string/boolean | 类型相符的 value | 子节点 |
| enum | 字符串 value、包含该值的非空唯一字符串数组 values | 子节点 |
| structure | 唯一 members 容器，内含具名描述节点 | value、elements |
| array | 唯一 elements 容器，内含重复 item 描述节点 | value、members |

members 和 elements 自身不接受属性。空容器显式使用 members {} / elements {}。结构成员名称非空且唯一，可使用带引号的特殊名称；业务名称 type、value、members、elements、item 不保留，位于 members 内时均是普通成员名。elements 内只接受 item。

## 元数据与作用域

每个描述节点直接承载自己的 folded、hasMixedValues；只接受布尔值，缺失与显式 false 不混淆。枚举的 type/value/values 也保存在该描述节点，不使用路径旁表。

所有 owner 复用同一递归模型：项目、场景、对象、Prefab、实例及事件局部变量使用 variables；Extension 使用 global_variables 和 scene_variables。不改变原生变量作用域、表达式绑定和事件执行行为。

作者层不接受 name、scope、id、persistentUuid、json 或 metadata。模型 writer 忽略原生身份字段，不将其输出到作者文件。数组原生元素无 name；结构成员有 name。

## 解析、格式化与诊断

共享 GDL 解析器负责结构、注释、字符串和源范围；变量解码器递归检查字段、类型、容器基数、名称唯一性及数组元素种类。错误直接定位原始节点或值，不再经过 JSON 字符串偏移映射。

每个变量集合最多解码 200,000 个描述节点；每个 writer 根变量使用同样节点预算；递归受 MAX_SETTINGS_DEPTH 和共享语法深度/文件/token 预算限制。结构包装块同样计入语法深度。

格式化保留源码注释，字符串仍采用通用 JSON 转义或多行原始字符串规则。结构成员序列不得通过 JavaScript 对象键枚举重建，以免数字名称被排序。原生结构映射可能排序，保存时按同版本源码恢复匹配成员顺序；根变量和数组顺序始终由当前模型决定。

## Catalog 与编辑器

variableSchemas.variable 发布标量字段与 members/elements 子容器。members 引用 variableSchemas.variables，elements 引用 variableSchemas.elements；后者只包含重复 item，引用 variableSchemas.variable。引用使用字符串，不构造循环 JSON 对象。

补全支持根变量、结构成员、数组 item 及任意嵌套描述节点，按 type 建议 value、members 或 elements；enum 建议 values；元数据直接补全 folded/hasMixedValues。不再建议 json 或 metadata。

事件源码映射递归标记每个描述节点及其属性，保留结构路径和准确源范围，不发布虚构的 JSON 字符位置。

## 版本与兼容性

SETTINGS_FORMAT_VERSION 从 17 升至 18，PROJECT_GDL_CATALOG_FORMAT_VERSION 从 16 升至 17；instruction catalog 仍为 7，因为原生指令身份和参数契约不变。

不读取旧作者格式，不迁移、不双写、不提供 json/metadata 别名。原生模型导入通过新 writer 输出递归节点。不会自动改写磁盘上的用户项目。

## 验证要求

- 标量、结构、异构数组、递归空容器和特殊名称往返。
- 根及后代 enum、folded=false、hasMixedValues=false 无损保留。
- 拒绝旧 json/metadata、错误或缺失容器、重复成员、错误 item 名、隐式类型、非法数字和超预算数据。
- 项目、Extension 双作用域、对象、实例与事件局部变量使用同一规则。
- 原生事件模型和真实代码生成器往返不改变变量数据及生成行为。
- 编辑器嵌套补全、准确错误位置、catalog 引用与严格字段保持一致。
- 模型保存保留匹配结构成员顺序，根变量及数组顺序遵循当前模型。
