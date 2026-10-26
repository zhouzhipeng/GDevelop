# 统一 Settings DSL 实施与验证记录

日期：2026-10-26。基线提交：b5db04cba757755aa0f6cb99a1bd5e26b9eeef8f，结果针对当前未提交工作区；包含此前已实现的变量修订。

## 已实施范围

- 作者格式 11、Settings catalog 10、instruction catalog 3。函数/片段签名与正文仅保存在一个 .settings 中。
- 显式 conditions/actions，裸 catalog 指令；event.type 默认 standard；group/comment/link 独立；子节点直接嵌套。
- Else、全部循环、局部变量、子指令、标记及原生有效编辑数据的编解码。
- 原始多行 code 块。使用 Acorn 8、ECMAScript 2022 扫描 JS 边界，覆盖注释、正则、字符串、模板和插值；不执行待校验代码。
- 严格结构/schema 校验、共享预算、精确参数和 JS 错误位置。表达式 AST 不与名为 expression 的普通结构字段混淆。
- 统一解析/格式化、源码注释保留、原始 JS 文本保留；只执行规范明确声明的换行规范化。
- 本地保存/重开/恢复、目录发现、catalog 重建、模块地图、MCP 源定位和 JavaScript 作者检查同步使用 settings。
- Settings 编辑器结构补全、catalog 指令/具名参数补全、折叠/大纲、嵌入 JS 补全/悬浮说明和错误映射。本地文件读取项目 catalog；其他编辑器可显式绑定 catalog。
- 删除独立 IfDo 实现/入口，拒绝 .events 和旧版本。无兼容读取、迁移器、双写或 raw JSON 作者逃生口。
- 更新 bundled skill、相关作者参考及规范入口。

## 回归命令

在 newIDE/app 执行：

```sh
CI=true npm test -- --watchAll=false --runInBand --silent src/ProjectsStorage src/CodeEditor src/Mcp/McpEditorBridge.spec.js src/Mcp/McpEventTools.spec.js src/Mcp/McpEventKnowledge.spec.js
```

最终结果：28 个测试套件、390 项测试、5 个快照全部通过（约 64 秒）。覆盖真实原生引擎往返、三个完整官方模板（platformer、starting-platformer、starting-3D-platformer）、本地事务/恢复、首次打开时 catalog 引导、MCP 校验、JS API/位置、catalog 补全、源码注释及错误输入。

专项覆盖 3,000 个事件的序列化/读取、过深事件拒绝和过大 JS 块拒绝；不将开发机运行时间作为性能承诺。

## 真实浏览器运行

从仓库根执行：

```sh
node scripts/test-unified-settings-runtime.cjs
```

该脚本先运行 NativeEvents.spec.js，通过当前原生引擎生成代码，再启动现有 GDJS Karma/Headless Chrome 运行时。临时源码/配置自动清理，不修改用户项目。需要已构建的 GDJS runtime、newIDE/app 与 GDJS/tests 依赖及 Chrome。

已在 Headless Chrome 155 中通过，实际断言：

- OR 条件选择参与碰撞的玩家，远处玩家不被 JS 修改。
- 删除被选中的金币，远处金币保留。
- 子 JS 继承父事件传入的玩家对象，选中玩家 X 最终为 42，未选中玩家 X 为 5000。
- Else 分支执行预期动作；Repeat、While、ForEach 和 ForEachChild 的总计分最终为 11。
- While 正确终止，QueueSize 最终为 0。

另比较往返前后生成的 JS；仅对引擎按原生堆地址命名的 userFunc 标识符作双射规范化，其他代码必须相同。生成代码另作 JS 语法检查。

## 额外检查与边界

修改的 app JavaScript 完成 ESLint、Prettier 检查；脚本通过 node --check；git diff --check 通过。

额外运行 ResourcesEditor/ProjectFilesPanel.spec.js 时，7 项 Windows 路径断言在本 macOS 环境失败，涉及 D:\\Project 路径与移动/sidecar 路径。该组件与测试未纳入本次修改；不将这次额外检查宣称为全仓测试通过。

已补充生产版编辑器构建和 Electron GUI 实测，见下节；尚未生成分发安装包。picking 可视化与行为 diff 仍属于规范明确列出的后续编辑器优化。

## Electron 桌面平台项目实测

2026-10-26 使用 `python3 scripts/start-macos-app.py --no-launch` 完整构建并同步生产版编辑器，然后通过 `--skip-build` 启动。构建成功，存在动态依赖请求警告。通过 GUI 的 Create new game → Platformer 创建官方 starting-platformer 模板，保存为 `/Users/zhouzhipeng/Documents/GDevelop projects/Settings DSL Platformer Test/project.gdevelop`。原用户项目未修改。

- 保存格式为 11，254 个 `.settings`，0 个 `.events`；场景生命周期函数的签名和 events 同处一个文件，扩展 JavaScript 使用 `code {}`。
- 从磁盘重新打开成功，无未保存更改被丢弃；结构、事件代码生成、扩展代码生成、JavaScript 作者 API 和语义检查通过。模板的官方触摸控制扩展存在已审查 API 声明缺失警告，未阻止验证。
- 重开后启动暂停预览，稳定 60 帧：Player `(128, 288)`。
- Right 按住 30 帧：Player `(248, 288)`；Space 按住 15 帧：约 `(301.125, 141.563)`；再运行 90 帧：约 `(301.333, 288)`，正常落地。每次测试自动释放按键。
- 运行错误 0，纹理加载失败 0；截图人工确认角色、地面、金币和移动按钮正常显示。
- 截图位于测试项目 `artifacts/verification/unified-settings-gui/preview.png`。测试完成后恢复实时预览，可用方向键和空格直接体验。

## 最终验收摘要

- 相关回归：28/28 suites，390/390 tests，5/5 snapshots。
- 原生生成代码与真实 Headless Chrome runtime：通过。
- ESLint：本次修改的 app JS 无错误、无警告；Browserslist 提示为依赖数据更新通知。
- Prettier、node --check、git diff --check：通过。
- 旧 IfDoEventsDsl、eventsDslVersion、gdevelop-ifdo-instruction-catalog：src 中无残留入口。
- 无 .events 作者文件生成；发现旧正文文件时明确拒绝。
