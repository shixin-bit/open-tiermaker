## ADDED Requirements

### Requirement: 图片选中态

系统 SHALL 支持图片单选与多选状态。单击图片 SHALL 选中该图片(高亮描边);按住 `Shift` 单击 SHALL 将该图片累积加入当前选中集合;点击空白区域或按 `Esc` SHALL 清空选中态。

#### Scenario: 单击选中图片

- **WHEN** 用户单击图片池中的某张图片(非拖拽,移动距离小于传感器激活阈值)
- **THEN** 该图片被选中,显示 `ring-2 ring-primary ring-offset-2` 描边;之前选中的其他图片取消选中

#### Scenario: Shift+点击多选

- **WHEN** 用户已选中图片 A,然后按住 Shift 单击图片 B
- **THEN** 图片 A 与 B 同时被选中,均显示描边

#### Scenario: 点击空白取消选中

- **WHEN** 用户已选中若干图片,然后点击等级行 / 图片池的空白区域
- **THEN** 所有图片的选中态被清空

#### Scenario: 拖拽进行中禁用新选中

- **WHEN** 拖拽正在进行(`activeId` 非空,`isDragging` 为 true)
- **THEN** 点击图片不会触发选中态变更,避免拖拽与选中冲突;拖拽结束后恢复点击选中行为

#### Scenario: 拖拽进行中选中态保留

- **WHEN** 用户已选中图片 A 和 B,然后开始拖拽其中一张(A),拖拽途中
- **THEN** 选中集合保持为 {A, B} 不变;拖拽结束(`onDragEnd`)后,A 仍保留在选中集合中(本期单图拖拽不删除被拖图片,只是改变其所属容器);用户可在拖拽结束后继续按 Delete 批量删除 A、B

#### Scenario: 拖拽中按 Esc 由 dnd-kit 处理

- **WHEN** 用户在拖拽途中按下 `Esc`
- **THEN** dnd-kit 的 `onDragCancel` 触发,图片回到原位置,`activeId` 置空;系统**不**响应 Esc 清空选中集合(选中态保留,与 dnd-kit 的"取消拖拽"语义解耦)

#### Scenario: 选中态与删除按钮共存

- **WHEN** 用户选中了一张图片并悬停在该图片上
- **THEN** 删除按钮仍可正常显示和点击;点击删除按钮移除该图片并清空选中态

### Requirement: 多图批量删除

系统 SHALL 支持一次性删除多张选中图片。批量删除 SHALL 在历史栈中作为单条 `images-remove` 记录入栈,而非每张图片独立入栈。

#### Scenario: 选中三张后按 Delete 批量删除

- **WHEN** 用户已选中三张图片,按下 Delete 键
- **THEN** 三张图片同时从 TierState 中移除;选中态清空;历史栈新增一条 `images-remove` 记录

#### Scenario: 选中三张后点击删除按钮单图删除

- **WHEN** 用户已选中三张图片,然后悬停在选中集合中的某张图片上并点击其删除按钮
- **THEN** 仅该图片被删除,另外两张保持选中态;历史栈新增一条 `image-remove` 记录(单图删除)

## MODIFIED Requirements

### Requirement: 显式保存（登录模式）

登录状态下,排行榜的修改(tier 标签、颜色、图片拖拽排序等)SHALL 通过显式"保存"操作提交到云端。保存失败时 SHALL 保留本地修改并提示用户重试。保存操作 SHALL 同时支持点击工具栏"保存"按钮与按下 `Ctrl+S` / `Cmd+S` 快捷键触发。

#### Scenario: 登录用户点击保存

- **WHEN** 已登录用户完成一系列修改后点击"保存"按钮
- **THEN** 系统将完整 TierState 提交到云端,页面显示"已保存"状态

#### Scenario: 登录用户按 Ctrl+S 保存

- **WHEN** 已登录用户在编辑页按下 `Ctrl+S`(Mac 下 `Cmd+S`)
- **THEN** 浏览器默认保存网页行为被阻止,系统触发保存逻辑;保存成功显示"已保存",失败显示"保存失败"

#### Scenario: 保存时网络中断

- **WHEN** 已登录用户点击保存但网络不可用
- **THEN** 系统保留所有本地修改并显示"保存失败,可稍后重试"的提示;历史栈不受影响,用户仍可继续撤销/重做
