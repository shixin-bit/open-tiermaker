## 1. Undo/Redo 历史栈基础设施

- [x] 1.1 在 `packages/shared/src/types.ts` 中新增 `EditAction` 类型与 `ActionType` 联合(`'drag' | 'tier-label' | 'tier-color' | 'image-add' | 'image-remove' | 'images-remove' | 'reset'`),供前后端共享。验证:`pnpm --filter shared run build` 通过,`@open-tiermaker/shared` 导出 `EditAction`
- [x] 1.2 新建 `packages/web/src/hooks/useUndoRedo.ts`:泛型 `useUndoRedo<T>(initial: T)`,内部用 `useReducer` 实现 past / present / future 三段式;暴露 `{ state, set(partial, actionType), undo, redo, canUndo, canRedo, reset(newInitial) }`;`set` 在 300ms 内同 `actionType` 合并(仅替换 present,不推 past),不同 `actionType` 或超过窗口则推入新历史记录;`past` 数组上限 100,超出丢弃最旧。验证:写 `useUndoRedo.test.ts` 覆盖 push / undo / redo / 边界(空栈 undo 不报错)/ 同 type 300ms 内合并 / 不同 type 不合并 / 栈上限 100 截断 / reset 后栈清空
- [x] 1.3 重构 `useBoardState` hook:将 `state: TierState` 从 `useState` 迁移到 `useUndoRedo<TierState>(DEFAULT_STATE)`,`setState` 改为 `(partial, actionType) => set(partial, actionType)` 的封装,**保持 hook 返回签名向后兼容**(setState 签名扩展为接受可选 actionType 参数,默认 `'drag'`);额外暴露 `canUndo` / `canRedo` / `undo` / `redo`。`title` / `description` 保留独立 `useState`(不入历史栈,本期决定)。验证:运行现有 `EditBoardPage` 调用方代码,无 TypeScript 编译错误;`pnpm --filter web test` 现有用例全绿

## 2. 编辑页接入 Undo/Redo + 工具栏按钮

- [x] 2.1 在 `EditBoardPage.tsx` Header 工具栏紧邻"保存"按钮左侧,新增 Undo / Redo 两个按钮(用 `Button` 组件 variant=ghost size=sm,图标用 ↶ / ↷),`disabled` 绑定 `!canUndo` / `!canRedo`,`onClick` 调 `undo()` / `redo()`。验证:浏览器实测——拖拽后点 Undo 能回退;再点 Redo 能恢复;空栈时按钮灰禁不可点
- [x] 2.2 在 `addImage` / `removeImage` / `moveImage` / `updateTierLabel` / `updateTierColor` 五大编辑动作中传入正确的 `actionType`(分别 `'image-add'` / `'image-remove'` / `'drag'` / `'tier-label'` / `'tier-color'`);`handleReset` 用 `'reset'`。验证:连续拖拽 5 次后 Undo 5 次能回到原始状态;连续改名 3 次合并为 1 条历史,1 次 Undo 回退到改名前

## 3. 键盘快捷键

- [x] 3.1 新建 `packages/web/src/hooks/useEditKeyboardShortcuts.ts`:接收 `{ undo, redo, save, deleteSelected, clearSelection, isCloud, isDragging }` 参数;内部 `useEffect` 注册 `window.addEventListener('keydown', handler)`;**判断顺序**:(1) 先判 `isDragging`——为 true 时仅 `Ctrl+S`/`Cmd+S` 调 `e.preventDefault()` 阻止浏览器保存网页但不触发 save,其他快捷键直接 return(避免破坏 dnd-kit 内部状态和 DragOverlay);(2) 判断 `document.activeElement` 是否为 `input` / `textarea` / `[contenteditable]`,是则仅处理 `Ctrl+S`/`Cmd+S` 阻止默认 + 触发 save,其他快捷键 return;(3) 否则按规则触发:`Ctrl+Z`/`Cmd+Z` → undo,`Ctrl+Shift+Z`/`Cmd+Shift+Z`/`Ctrl+Y` → redo,`Ctrl+S`/`Cmd+S` → `e.preventDefault()` + save,`Delete`/`Backspace` → deleteSelected,`Esc` → clearSelection。验证:写 `useEditKeyboardShortcuts.test.tsx`,用 `renderHook` + `fireEvent.keyDown` 覆盖所有快捷键触发、`isDragging=true` 时全部 noop(除 Ctrl+S 阻止默认)、输入框聚焦时跳过、Ctrl+S 阻止默认
- [x] 3.2 在 `EditBoardPage.tsx` 顶层调用 `useEditKeyboardShortcuts({ undo, redo, save: handleSave, deleteSelected: handleDeleteSelected, clearSelection: () => setSelectedIds(new Set()), isCloud, isDragging: activeId !== null })`。验证:浏览器实测——选中图片后开始拖拽,拖拽途中按 Ctrl+Z/Delete/Esc 均不响应,松手后快捷键恢复;按 Ctrl+S 在拖拽中不触发保存但阻止浏览器默认

## 4. 图片选中态 + 多选

- [x] 4.1 在 `EditBoardPage.tsx` 新增 `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())`;新增 `handleImageClick(imageId, shiftKey)` 方法,shiftKey 为 true 则追加到选中集合,否则单选;新增 `handleDeleteSelected()` 一次性删除选中集合中的所有图片(改造 `removeImage` 为 `removeImages(ids: string[])` 单次 dispatch,只入一条 `images-remove` 历史);在 `TierBoard` 和 `ImagePool` 外层加 `onClick` 捕获冒泡,点空白时 `setSelectedIds(new Set())`;拖拽进行中(`activeId` 非空)时禁用选中逻辑。验证:浏览器实测——单击选中、Shift+点击多选、点空白取消、拖拽中点击不触发选中
- [x] 4.2 改造 `ImageCard.tsx`:新增 `selected?: boolean` prop,选中时 className 加 `ring-2 ring-primary ring-offset-2`;`onClick` 调用父组件传入的 `onSelect(id, shiftKey)` 回调;保留现有 hover 删除按钮(选中态下删除按钮仍可正常显示)。验证:写 `ImageCard.test.tsx` 覆盖 `selected=true` 时有 ring 描边、点击触发 onSelect、Shift+点击触发累积选中、hover 时删除按钮可见
- [x] 4.3 `EditBoardPage.tsx` 传 `selected` 与 `onSelect` 给 `TierBoard` / `ImagePool` 内的 `ImageCard`,透传 props。验证:在等级行和图片池中的图片都能正常进入选中态;选中态下按 Delete 批量删除

## 5. 暗色主题

- [x] 5.1 新建 `packages/web/src/hooks/useTheme.ts`:返回 `{ theme, setTheme }`,`theme: 'light' | 'dark' | 'system'`;初始化从 `localStorage.getItem('open-tiermaker-theme')` 读,无值或非法值回退 `'system'`;`system` 模式下 `matchMedia('(prefers-color-scheme: dark)')` 监听变化实时更新 `<html>` class;`setTheme(t)` 写入 localStorage 并同步 `<html>` class;为避免主题闪烁,在 `main.tsx` 顶层(ReactDOM render 之前)调一次同步函数(同步设置 `<html>` class)。验证:写 `useTheme.test.ts` 覆盖初始化从 localStorage、setTheme 持久化、system 模式 matchMedia 监听、非法值回退 system、`<html>` class 同步
- [x] 5.2 新建 `packages/web/src/components/ThemeToggle.tsx`:三态切换器(浅色 ☀️ / 深色 🌙 / 跟随系统 💻),用 `Button` 组件 variant=ghost size=sm 拼接;当前选中态高亮(`variant="secondary"`);点击切换调用 `setTheme`。把 `ThemeToggle` 加到所有页面的 Header 右上角(HomePage / LoginPage / RegisterPage / OAuthCallbackPage / BoardListPage / NewBoardPage / EditBoardPage / SharedBoardPage)。验证:写 `ThemeToggle.test.tsx` 覆盖三态渲染、当前态高亮、点击切换;浏览器实测——切换后刷新页面保持主题
- [x] 5.3 在 `tailwind.config.ts`(或 `src/index.css` 中的 `@custom-variant`)配置 Tailwind 4 `darkMode: 'class'` 策略,确认 `dark:` 变体生效。全局排查硬编码色:用 grep 搜索 `bg-white` / `text-black` / `text-gray-*` 等浅色专有色,改为语义类(`bg-card` / `text-foreground` / `text-muted-foreground` 等)或加 `dark:` 变体。验证:`pnpm --filter web run build` 通过;浏览器实测——切到深色后所有页面(编辑页含 AuthModal、SharePanel、拖拽预览、占位符)均无残留浅色块

## 6. 拖拽视觉反馈强化

- [x] 6.1 改造 `EditBoardPage.tsx` 的 `DragOverlay`:预览容器尺寸从 `w-24 h-24` 改为 `w-28 h-28`,内部图片保持 `object-cover`;`TierRow.tsx` 与 `ImagePool.tsx` 中目标容器高亮样式从单纯边框改为 `border-primary border-2 bg-primary/5` 组合;占位符位置(`tier.imageIds` / `pool` 数组中插入点)渲染一个 `ring-2 ring-primary/50 w-24 h-24 rounded-md transition-all duration-150` 的占位框。验证:浏览器实测——拖拽时预览自适应、目标容器高亮明显、占位符出现/消失有平滑动画

## 7. 测试 + 构建验证

- [x] 7.1 运行 `pnpm --filter web test` 覆盖所有新增公共 hook 和组件:`useUndoRedo` / `useTheme` / `useEditKeyboardShortcuts` / `ThemeToggle` / `ImageCard` 选中态。覆盖率 ≥ 70%。运行 `pnpm --filter web run build` 验证 TypeScript 编译和 Vite 构建无错误。运行 `pnpm --filter server run build` 验证后端无回归(本期不动后端,确认即可)。验证:测试全绿、两个 build exit code 0
- [x] 7.2 扩展 Playwright E2E 测试,新增 undo→redo 流程用例:进入编辑页 → 上传一张图片 → 拖拽到 S 等级行 → 按 Ctrl+Z 验证图片回到图片池 → 按 Ctrl+Shift+Z 验证图片重新出现在 S 等级行 → 切换主题为深色 → 刷新页面验证主题持久化。运行 `pnpm --filter web test:e2e` 全部通过。验证:E2E 全绿,覆盖本期核心交互
