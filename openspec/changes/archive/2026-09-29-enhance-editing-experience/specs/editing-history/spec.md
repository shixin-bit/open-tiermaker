## Purpose

为排行榜编辑器提供撤销/重做历史栈与键盘快捷键能力,让用户在拖拽失误、误删、改名错误时能快速回退,熟练用户能用键盘完成核心操作提升效率。

## Requirements

### Requirement: Undo / Redo 历史栈

系统 SHALL 为排行榜的 `TierState` 编辑维护一个三段式(past / present / future)历史栈,用户 SHALL 能通过 Undo / Redo 操作在历史栈中前后移动。所有 `TierState` 修改动作(增删图片、拖拽排序、tier 标签 / 颜色修改)SHALL 自动推入历史栈。

#### Scenario: 拖拽图片后撤销

- **WHEN** 用户将一张图片从图片池拖到 S 等级行,然后按下 `Ctrl+Z`(Mac 下 `Cmd+Z`)
- **THEN** 该图片从 S 等级行消失,回到图片池中,页面恢复到拖拽前的状态

#### Scenario: 撤销后重做

- **WHEN** 用户按 `Ctrl+Z` 撤销了一次操作,然后按下 `Ctrl+Shift+Z`(Mac 下 `Cmd+Shift+Z`,或 `Ctrl+Y`)
- **THEN** 被撤销的操作重新生效,图片重新出现在 S 等级行

#### Scenario: 连续同类型编辑合并

- **WHEN** 用户在 300ms 内连续修改 A 等级的标签名称(从 "A" → "A1" → "A12" → "A123")
- **THEN** 历史栈中只生成一条记录;用户按一次 `Ctrl+Z` 直接回退到 "A",而非逐字符回退

#### Scenario: 不同类型编辑不合并

- **WHEN** 用户先拖拽图片(动作类型 `drag`),然后 100ms 内修改 tier 标签(动作类型 `tier-label`)
- **THEN** 历史栈生成两条独立记录,用户按 `Ctrl+Z` 先撤销标签修改,再按一次撤销拖拽

#### Scenario: 历史栈上限截断

- **WHEN** 历史栈 `past` 数组长度达到 100,用户继续做新的编辑动作
- **THEN** 系统丢弃 `past` 数组中最旧的一条记录,新动作正常推入,栈长度保持 100

#### Scenario: 空历史栈时 Undo 灰禁

- **WHEN** 历史栈 `past` 为空(用户刚打开排行榜未做任何编辑)
- **THEN** 工具栏的 Undo 按钮显示为禁用态(灰显);用户按下 `Ctrl+Z` 不产生任何效果

#### Scenario: 撤销后做新动作清空 future 栈

- **WHEN** 用户撤销了若干次(`future` 栈非空),然后做了一次新的编辑动作
- **THEN** `future` 栈立即清空,用户无法通过 `Ctrl+Shift+Z` 重做被清空的操作

#### Scenario: 多图删除只生成一条历史记录

- **WHEN** 用户选中三张图片后按 `Delete`,系统一次性删除这三张图片
- **THEN** 历史栈只新增一条记录;用户按一次 `Ctrl+Z` 能恢复全部三张图片

### Requirement: Undo / Redo 工具栏按钮

编辑页 Header SHALL 显示 Undo 和 Redo 两个按钮,分别带 `canUndo` / `canRedo` 灰禁态。按钮顺序 SHALL 为 Undo 在左、Redo 在右,紧邻"保存"按钮左侧。

#### Scenario: Undo 按钮可用态切换

- **WHEN** 用户做了第一次编辑动作
- **THEN** Undo 按钮从灰禁态变为可点击态;Redo 按钮在编辑前为灰禁,撤销一次后变为可点击

#### Scenario: 点击 Undo 按钮触发撤销

- **WHEN** 用户点击工具栏的 Undo 按钮
- **THEN** 系统执行一次撤销,效果与按 `Ctrl+Z` 一致;Undo 按钮状态根据新的 `canUndo` 实时更新

### Requirement: 编辑动作的类型标记与合并窗口

每次 `TierState` 编辑动作 SHALL 携带 `actionType` 字符串标识,系统 SHALL 据此判断是否与上一次动作合并。连续 `actionType` 相同且时间间隔 ≤ 300ms 的动作 SHALL 合并为一条历史记录。

支持的 `actionType` 至少包括:`'drag'`(拖拽结束)、`'tier-label'`(等级标签改名)、`'tier-color'`(等级颜色修改)、`'image-add'`(添加图片)、`'image-remove'`(单图删除)、`'images-remove'`(多图批量删除)、`'reset'`(全量重置)。

#### Scenario: 添加图片不合并

- **WHEN** 用户连续上传三张图片(每次 `actionType: 'image-add'`)
- **THEN** 每次添加生成独立历史记录;用户按三次 `Ctrl+Z` 才能撤销到添加前

#### Scenario: 用户主动中断合并窗口

- **WHEN** 用户做了一次编辑后,300ms 合并窗口内按下 `Esc` 或点击空白处
- **THEN** 当前合并窗口立即关闭;下一次同类型编辑将生成新的历史记录

### Requirement: 全局键盘快捷键

系统 SHALL 在排行榜编辑页注册全局 `keydown` 监听,支持以下快捷键:`Ctrl+Z` / `Cmd+Z`(撤销)、`Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Ctrl+Y`(重做)、`Ctrl+S` / `Cmd+S`(保存,登录用户)、`Delete` / `Backspace`(删除选中图片)、`Esc`(取消选中)。

#### Scenario: 拖拽进行中所有快捷键被忽略

- **WHEN** 用户已选中若干图片,然后开始拖拽其中一张(`activeId` 非空,`isDragging` 为 true),拖拽途中按下任意快捷键
- **THEN** 系统忽略所有快捷键响应:`Ctrl+Z` / `Ctrl+Shift+Z` / `Delete` / `Esc` 均为 no-op(不撤销、不重做、不删除选中、不清空选中);仅 `Ctrl+S` / `Cmd+S` 仍调用 `e.preventDefault()` 阻止浏览器保存网页行为,但**不**触发保存逻辑(拖拽中间态不是用户期望的最终结果)。拖拽结束后(`onDragEnd` 或 `onDragCancel` 触发,`activeId` 置空),快捷键恢复响应

#### Scenario: 输入框聚焦时跳过快捷键

- **WHEN** 用户焦点在标题输入框、URL 输入框、tier 标签输入框等可编辑元素(`<input>` / `<textarea>` / `[contenteditable]`)内,且未处于拖拽中
- **THEN** `Ctrl+Z` / `Delete` / `Esc` 由浏览器原生处理(在输入框内撤销输入、删除字符、失焦);系统**不**触发 TierState 级别的撤销或图片删除;`Ctrl+S` 仍触发保存(并阻止浏览器默认保存网页行为)

#### Scenario: Ctrl+S 保存

- **WHEN** 已登录用户在编辑页按下 `Ctrl+S`(Mac 下 `Cmd+S`)
- **THEN** 浏览器默认保存网页行为被阻止,系统触发保存逻辑;保存成功显示"已保存",失败显示"保存失败"

#### Scenario: 未登录用户按 Ctrl+S

- **WHEN** 未登录用户(游客模式)按下 `Ctrl+S`
- **THEN** 浏览器默认保存网页行为被阻止,系统不触发保存(游客模式已自动保存到 localStorage),可显示一次性 toast 提示"已自动保存到本地"

#### Scenario: Delete 删除选中图片

- **WHEN** 用户选中了一张或多张图片后按下 `Delete` 或 `Backspace`
- **THEN** 系统删除所有选中的图片,清空选中态,该操作作为一条 `images-remove` 历史记录入栈

#### Scenario: 无选中时 Delete 无效果

- **WHEN** 用户未选中任何图片,且焦点不在可编辑元素内,按下 `Delete`
- **THEN** 系统不产生任何效果,不删除任何图片

#### Scenario: Esc 取消选中

- **WHEN** 用户选中了若干图片,按下 `Esc`
- **THEN** 所有图片的选中态被清空,无 `TierState` 变更

### Requirement: 历史栈生命周期

历史栈 SHALL 仅存在于内存中,在排行榜编辑页挂载时初始化为空。页面刷新、关闭、路由切换离开编辑页时,历史栈 SHALL 丢失;下次进入编辑页时历史栈重新为空。

#### Scenario: 刷新页面后历史栈重置

- **WHEN** 用户做了若干编辑动作后刷新页面
- **THEN** 历史栈清空,`Undo` / `Redo` 按钮回到灰禁态;已保存到云端 / localStorage 的最新状态不受影响

#### Scenario: 切换到其他页面后返回

- **WHEN** 用户从编辑页导航到排行榜列表页,再返回同一排行榜编辑页
- **THEN** 历史栈为空,无法撤销离开前做的操作

#### Scenario: 切换排行榜

- **WHEN** 用户从排行榜 A 切换到排行榜 B 编辑
- **THEN** 排行榜 A 的历史栈清空,排行榜 B 的历史栈重新为空
