## Context

参考 proposal.md 中的 Why。当前项目已完成两期建设:

- **第一期(build-image-tier-maker)**:前端核心编辑器——等级行 S/A/B/C/D、自定义标签名/颜色、本地上传 + URL 添加图片、删除、拖拽 + 移动端触摸、PNG 导出
- **第二期(add-backend-foundation)**:monorepo 化、NestJS 后端、JWT 双 Token 鉴权、Postgres bytea 图片存储、private/unlisted/public 三种可见性、渐进式登录、数据迁移

编辑器现状(本期改动起点):

- `useBoardState` hook 中 `state: TierState` 直接用 `useState` 管理,所有编辑动作(addImage / removeImage / moveImage / updateTierLabel / updateTierColor)直接 `setState(prev => ...)`,**无历史栈、无撤销重做**
- `EditBoardPage.tsx` 中通过 `DndContext` 处理拖拽,图片无"选中态"概念,只能 hover 显示删除按钮
- 全局无 `keydown` 监听(仅 `UrlImageInput` 和 `TierLabel` 内部组件用过)
- Tailwind 4 + `@tailwindcss/vite`,类名已大量使用 `bg-card` / `bg-background` / `text-muted-foreground` / `border-border` 等语义色,但 `dark:` 变体未启用,色值固定浅色
- 已有 `useAuth()`(Context Provider 模式)、`useLocalStorageSize()` 等 hook,可作为新 hook 的参考范式

本期**纯前端改动**,不动后端 API、不动数据库 schema、不动数据迁移流程。

## Goals / Non-Goals

**Goals:**

- 引入 Undo / Redo 历史栈,覆盖所有 `TierState` 编辑动作(增删图片、拖拽排序、tier 标签/颜色修改)
- 实现键盘快捷键核心交互:`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+S` / `Delete` / `Esc`
- 增加图片选中态与多选能力,支持 `Delete` 批量删除选中图片
- 实现暗色主题切换器(浅色 / 深色 / 跟随系统),localStorage 持久化
- 强化拖拽视觉反馈(预览自适应、占位符动画、跨容器高亮)
- 配套单元测试覆盖所有新增公共 hook 和组件,`pnpm run build` 全绿,E2E 补 undo→redo 流程

**Non-Goals:**

- **多选拖拽整组移动**——与 dnd-kit 单源拖拽逻辑冲突,工程量翻倍,留待下期
- **网格对齐 / 自动布局**——锦上添花,优先级低
- **i18n / PWA**——与本期主线弱相关
- **排行榜历史版本快照**——本期 Undo/Redo 仅在内存中,不持久化历史;持久化版本快照留待后续
- **协作编辑 / 实时同步**——本期 Undo/Redo 仅本地,不涉及 CRDT
- **后端 API 改动**——本期纯前端
- **分享 / 社区浏览 / Fork**——本期不动

## Decisions

### D1: Undo/Redo 用 useReducer 三段式(past / present / future)

放弃"每次 setState 都 push 一个 snapshot 到数组"的简单做法,理由:连续拖拽中会触发多次 `setState`,栈会瞬间膨胀数百条,用户按 Ctrl+Z 要按几十次才能回退一次有效操作。

采用经典三段式:

```ts
interface HistoryState<T> {
  past: T[]; // 历史栈,倒序排列(末尾为最近)
  present: T; // 当前状态
  future: T[]; // 重做栈
}
```

- 每次 `dispatch({ type: 'SET', payload })` 将当前 `present` 推入 `past`,清空 `future`
- `dispatch({ type: 'UNDO' })`: `past` 末尾出栈 → 新 `present`;旧 `present` 推入 `future` 头部
- `dispatch({ type: 'REDO' })` 对称
- 栈大小限制: `past.length > 100` 时丢弃最旧条目
- **连续合并**: 相同 `actionType` 在 300ms 内的连续 SET 操作只 push 第一次,后续仅替换 `present`,不增加 past 条目;`actionType` 由调用方在 payload 中传入(如 `'drag'`、`'tier-label'`、`'image-add'`)

**为什么不引入 immer / zundo 等库**: 状态结构简单(`TierState`),手写 reducer 200 行内可搞定,且依赖库版本兼容风险更小。

### D2: useBoardState 重构边界——仅 state 部分走 reducer,其他保持现状

`useBoardState` 当前返回多个独立 useState:`state` / `title` / `description` / `visibility` / `shareId` / `sharePasswordSet` / `isSaving` / `loading` / `loaded`。

**仅 `state: TierState` 部分迁移到 useReducer**;`title` / `description` 走单独的轻量历史(或直接复用同一 reducer,取决于实现复杂度,实现时定);`visibility` / `shareId` 等分享元数据**不入历史栈**(撤销可见性切换不属于用户期望)。

理由: 标题改名是用户期望能撤销的;但"我把公开切回私有"这种操作撤销会引发混乱(可能涉及后端副作用)。

暴露给 `EditBoardPage` 的接口保持兼容:

```ts
const {
  state,
  setState, // setState 现在是 dispatch 的封装,签名不变
  canUndo,
  canRedo,
  undo,
  redo, // 新增
  // ...其他不变
} = useBoardState(boardId, isAuthenticated);
```

### D3: 键盘快捷键——单一 useEffect 全局监听,输入框聚焦时跳过,拖拽中完全 no-op

`EditBoardPage` 顶层加一个 `useEffect` 注册 `window.addEventListener('keydown', handler)`:

- 判断 `document.activeElement` 是否为 `input` / `textarea` / `[contenteditable]`,是则**只保留 Ctrl+S 阻止默认**(防止浏览器保存网页干扰),其他快捷键全部 return
- **拖拽进行中(`isDragging` 为 true)时优先级最高**:在所有其他判断之前先判 `isDragging`,为 true 时仅处理 `Ctrl+S` 的 `e.preventDefault()`(阻止浏览器保存网页,但不触发 save 逻辑),其余快捷键全部 return。理由:拖拽中间态不是用户期望的最终编辑结果;撤销/重做会破坏 dnd-kit 内部状态;Delete 会删除正在被拖拽的 active 图片导致 DragOverlay 失效;Esc 归 dnd-kit 自身的 `onDragCancel` 处理
- 非拖拽、非输入框聚焦时:
  - `Ctrl+Z` / `Cmd+Z` → `undo()`
  - `Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Ctrl+Y` → `redo()`
  - `Ctrl+S` / `Cmd+S` → `e.preventDefault()` + `handleSave()`(已登录时;未登录时 noop)
  - `Delete` / `Backspace` → 删除当前 `selectedIds`
  - `Esc` → 清空 `selectedIds`

**抽到独立 hook `useEditKeyboardShortcuts({ undo, redo, save, deleteSelected, clearSelection, isCloud, isDragging })`**,便于单元测试。`isDragging` 由 EditBoardPage 通过 `activeId !== null` 计算传入。

**拖拽中的选中态处理**:选中集合保留不变(本期单图拖拽不删除被拖图片,只是改变其所属容器),拖拽结束后用户可继续按 Delete 批量删除。dnd-kit 的 `onDragCancel`(Esc 触发)和 `onDragEnd`(松手触发)都会将 `activeId` 置空,`isDragging` 自动变回 false,快捷键恢复响应。

### D4: 图片选中态——独立 useState,不入历史栈

`EditBoardPage` 增加 `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())`:

- 单击图片(`onImageClick` 事件) → `setSelectedIds(new Set([id]))`
- `Shift+点击` → `setSelectedIds(prev => new Set(prev).add(id))`
- 点击空白处 / 按 Esc → `setSelectedIds(new Set())`
- 选中态 UI:`ImageCard` 新增 `selected?: boolean` prop,选中时加 `ring-2 ring-primary ring-offset-2`
- 批量删除:`removeImage` 改造为支持 `removeImages(ids: string[])`,一次 `dispatch` 删多个(只产生一条历史记录)

**与拖拽的冲突处理**:

- `dnd-kit` 默认 `MouseSensor` 激活阈值 5px,小于这个距离的点击不会触发拖拽,可作为"选中"信号
- 拖拽进行中(`activeId` 非空)时禁用选中态
- 选中态下仍可拖拽单张图片,此时选中态不影响拖拽逻辑

### D5: 暗色主题——Tailwind 4 `class` 策略 + `useTheme` hook + `ThemeToggle` 组件

Tailwind 4 默认支持 `dark:` 变体,但需要启用 `class` 策略(基于 `<html class="dark">`)。

实现:

- `tailwind.config.ts`: 配置 `darkMode: 'class'`(Tailwind 4 中通过 `@custom-variant dark (&:where(.dark, .dark *))` 或在 CSS 中声明)
- `useTheme()` hook: 返回 `{ theme, setTheme }`,`theme: 'light' | 'dark' | 'system'`
  - 初始化时从 localStorage 读 `open-tiermaker-theme`,无则 `system`
  - `system` 模式下监听 `matchMedia('(prefers-color-scheme: dark)')` 变化
  - `setTheme(t)` 写入 localStorage 并更新 `<html class="dark">`
- `ThemeToggle` 组件: 三态切换按钮(图标: ☀️ / 🌙 / 💻),放在 Header 右上角,所有页面共享
- `useEffect` 在 App 顶层调用一次,初始化时同步 `<html>` class,避免主题闪烁
- 路由层不放守卫,所有页面共享主题

**为什么不引入 next-themes 等 lib**: 项目无 SSR,主题切换逻辑 50 行可搞定;不引入额外依赖。

### D6: 拖拽视觉反馈强化细节

- **预览自适应**:`DragOverlay` 内的图片用 `aspect-square` 容器 + `object-cover`,根据原图宽高比自适应,不再强制 `w-24 h-24`
- **占位符动画**:在 `TierRow` / `ImagePool` 中渲染拖拽悬停位置的占位符框时,加 `transition-all duration-150` + `ring-2 ring-primary/50`,提供平滑出现/消失动画
- **跨容器高亮**:目标容器加 `bg-primary/5 border-primary` 组合(原本只有边框),提升视觉对比

**不引入新依赖**,纯 CSS + Tailwind 调整。

### D7: 测试覆盖与红线

按 AGENTS.md 红线,本期新增公共 hook / 组件必须同步测试:

| 新增                       | 类型       | 必测场景                                                                                   |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `useUndoRedo`              | hook 单元  | push / undo / redo / 边界(空栈)/ 合并(300ms 内同 type)/ 不同 type 不合并 / 栈上限 100 截断 |
| `useTheme`                 | hook 单元  | 初始化从 localStorage / setTheme 持久化 / system 模式监听 matchMedia / `<html>` class 同步 |
| `useEditKeyboardShortcuts` | hook 单元  | Ctrl+Z 触发 undo / 输入框聚焦时跳过 / Ctrl+S 阻止默认 / Delete 删除选中 / Esc 清空选中     |
| `ThemeToggle`              | 组件       | 三态切换渲染 / 点击切换 / 当前态高亮                                                       |
| `ImageCard` 选中态         | 组件       | selected=true 时 ring 描边 / onClick 触发 / Shift+点击累积                                 |
| E2E 流程                   | Playwright | 拖拽 → Ctrl+Z 回退 → Ctrl+Shift+Z 重做 / 主题切换持久化                                    |

**禁止**: 用 `any` 跳过类型;手动 `it.skip`;为通过测试在生产代码加 `if (process.env.NODE_ENV === 'test')` 分支。

## Risks / Trade-offs

- **[风险] useBoardState 重构可能破坏现有 EditBoardPage 行为** → 通过单元测试覆盖 addImage / removeImage / moveImage / updateTierLabel / updateTierColor 五大动作,E2E 跑通"创建→编辑→保存→刷新→恢复"主流程;重构期间保持 hook 返回签名向后兼容
- **[风险] 历史栈合并策略可能误合并用户期望分开的操作** → 仅对 `actionType` 完全相同且 300ms 内连续操作合并;不同 actionType(如先拖拽后改名)不合并;`'image-add'` 不合并(每次添加视为独立动作);用户可手动按 `Esc` 强制中断合并窗口
- **[取舍] 历史栈只在内存中,刷新即丢失** → 本期接受;用户期望 Ctrl+Z 撤销刚刚的操作,不期望撤销一小时前的;持久化快照留待后续
- **[取舍] 多选不支持拖拽整组移动** → 与 dnd-kit 单源拖拽冲突,实现复杂度高;本期仅支持多选 + 批量删除,够用;Fork / 模板等场景需要时再做
- **[风险] 暗色主题可能在某些组件遗留 `bg-white` / `text-black` 等硬编码色** → 通过 grep 全局排查硬编码色,统一改为语义类;E2E 截图对比浅深两态
- **[风险] Tailwind 4 dark mode 配置与现有 `@tailwindcss/vite` 集成可能有坑** → 优先参考 Tailwind 4 官方文档;若 `darkMode: 'class'` 配置不生效,改用 CSS 层面的 `@custom-variant dark` 声明
- **[取舍] 标题改名是否进历史栈** → 实现 D2 时决定: 若复杂度过高,标题独立维护轻量历史(栈上限 20),与 state 历史栈分离
