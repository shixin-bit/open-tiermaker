## Why

Open TierMaker 当前编辑器存在若干日常使用痛点:

1. **没有撤销/重做能力**——用户拖错位置、改错标签、误删图片,只能手动操作回退;游客模式下虽然有"重置"按钮,但会清空整个排行榜,粒度太粗,用户害怕试错。
2. **没有键盘快捷键**——所有操作都得找按钮点击,尤其 Ctrl+S 保存这种肌肉记忆完全不响应,影响熟练用户的效率。
3. **没有图片选中态**——只能 hover 显示删除按钮,无法多选批量操作;删除 10 张图得点 10 次删除图标。
4. **没有暗色主题**——夜间使用刺眼,Tailwind 类名已经用 `bg-card` / `bg-background` / `text-muted-foreground` 等语义类,但全局没有 dark mode 切换器,色值固定为浅色。
5. **拖拽视觉反馈细节弱**——预览尺寸固定、占位符无动画、跨容器高亮对比不强,拖到边缘位置时不容易判断松手后的落点。

本期在不动后端、不动分享/社区功能的前提下,集中精力打磨编辑体验,把"够用"提升到"顺手",为后续社区浏览等大需求腾出工程节奏。

## What Changes

- 新增 **Undo / Redo 历史栈**:`useBoardState` 中的 `state` 部分重构为 `useReducer` 三段式(past / present / future),连续同类型编辑(如拖拽中多次 setState)防抖 300ms 合并,避免历史栈膨胀;工具栏新增 Undo / Redo 按钮,显示 `canUndo` / `canRedo` 灰禁态
- 新增 **键盘快捷键**:全局 `keydown` 监听(输入框聚焦时跳过),支持 `Ctrl+Z` / `Ctrl+Shift+Z`(Mac 下 `Cmd+Z` / `Cmd+Shift+Z`)、`Ctrl+S`(阻止默认浏览器保存)、`Delete` / `Backspace` 删除当前选中图片、`Esc` 取消选中
- 新增 **图片选中态 + 多选**:单击图片选中(高亮描边);`Shift+点击` 累积多选;选中状态下 `Delete` 批量删除;本期**不做多选拖拽整组移动**(与 dnd-kit 单源拖拽冲突,留待下期)
- 新增 **暗色主题**:Tailwind 4 `class` 策略(`dark:` 前缀),Header 右上角加主题切换器(浅色 / 深色 / 跟随系统),选择写入 localStorage,首次加载从 localStorage 读,默认跟随系统(`prefers-color-scheme`)
- 修改 **拖拽视觉反馈**:拖拽预览自适应尺寸(根据图片实际宽高比);等级行内插入位置显示带过渡动画的占位符框;跨容器高亮改用更明显的边框 + 背景色组合
- 配套测试:Undo/Redo hook 单元测试(覆盖 push / undo / redo / 边界 / 合并)、快捷键集成测试、暗色主题切换测试;`pnpm run build` 全绿;E2E 补一条 undo → redo 流程

## Capabilities

### New Capabilities

- `editing-history`: 编辑历史管理——Undo / Redo 三段式状态栈、连续编辑合并、键盘快捷键(Ctrl+Z / Ctrl+Shift+Z / Ctrl+S / Delete / Esc)
- `theme`: 主题切换——浅色 / 深色 / 跟随系统三种模式,localStorage 持久化

### Modified Capabilities

- `tier-board`: 增加图片选中态(单击选中、Shift+点击多选)与批量删除,与 editing-history 联动
- `drag-drop`: 强化拖拽视觉反馈(预览自适应、占位符动画、跨容器高亮)

## Impact

- **前端改动**:`useBoardState` 重构为 reducer 模式;`EditBoardPage` 增加键盘监听和选中态管理;`ImageCard` 增加选中态 props;新增 `useUndoRedo` hook、`useTheme` hook、`ThemeToggle` 组件;`TierBoard` / `ImagePool` 调整拖拽视觉样式
- **后端改动**:无(本期纯前端)
- **共享类型改动**:`packages/shared` 增加编辑动作类型枚举(`EditAction` 类型,可选,用于历史合并判断);如有需要增加 `Theme` 联合类型
- **样式改动**:`tailwind.config.ts` / `src/index.css` 启用 `dark:` 变体(若 Tailwind 4 默认未启用);全局色变量保持现状,仅追加 dark 变体覆盖
- **测试改动**:`packages/web/src/__tests__/` 新增 `useUndoRedo.test.ts`、`useTheme.test.ts`、`ThemeToggle.test.tsx`、`keyboard-shortcuts.test.tsx`(可选,集成测试);E2E `e2e/` 增加 undo→redo 流程
- **不影响**:`user-auth`、`cloud-storage`、`board-sharing`、`image-library`、`export` 既有能力;游客/登录双模式行为不变;数据迁移流程不变
