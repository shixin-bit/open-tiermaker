# @open-tiermaker/shared

## 0.2.0

### Minor Changes

- ## 编辑体验深化（enhance-editing-experience）

  ### 新增功能
  - **撤销/重做历史栈**：编辑页支持 `Ctrl+Z` / `Ctrl+Shift+Z`（或 `Ctrl+Y`）撤销重做所有 TierState 编辑动作；300ms 内同 actionType 编辑自动合并；past 栈上限 100；Header 工具栏新增 ↶ / ↷ 按钮
  - **暗色主题**：三态切换器（浅色 / 深色 / 跟随系统），持久化到 localStorage，跨页面与跨刷新保持一致；`main.tsx` 顶层 `syncThemeToHtml()` 避免 FOUC；Tailwind 4 `@custom-variant dark` + `.dark` CSS 变量覆盖；切换器已加到全部 8 个页面 Header
  - **图片多选与批量删除**：单击选中、Shift+点击累积选中、点空白取消；Delete 键一次性删除所有选中图片，单条 `images-remove` 历史入栈
  - **键盘快捷键**：`Ctrl+S` 保存、`Delete` 删除选中、`Esc` 取消选中；拖拽中所有快捷键 no-op（除 Ctrl+S 仍 preventDefault）；输入框聚焦时跳过（除 Ctrl+S）
  - **拖拽视觉反馈强化**：DragOverlay 预览 `w-28 h-28` + `object-cover`；目标容器高亮 `border-2 border-primary bg-primary/5`；拖拽源 `opacity-50 ring-2 ring-primary/50` + `transition-all duration-150`

  ### shared 包扩展
  - 导出 `ActionType` 联合类型（`'drag' | 'tier-label' | 'tier-color' | 'image-add' | 'image-remove' | 'images-remove' | 'reset'`）与 `EditAction` 接口，供前后端共享历史栈元数据

## 0.1.0

### Minor Changes

- 首次发版：提供前后端共享的类型与默认值——排行榜数据结构 TierState / Tier / ImageItem，以及 DEFAULT_TIERS、DEFAULT_STATE 默认配置，供 web 与 server 通过 workspace 依赖共同引用
