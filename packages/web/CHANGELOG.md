# @open-tiermaker/web

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

### Patch Changes

- Updated dependencies
  - @open-tiermaker/shared@0.2.0

## 0.1.0

### Minor Changes

- 新增用户系统与登录 UI：登录/注册弹窗表单（可直接在弹窗内完成登录），支持 GitHub OAuth 与 Google OAuth 登录
- 新增 React Router 多页面路由（首页、登录/注册、OAuth 回调、排行榜列表、编辑页、只读分享页）；采用渐进式登录，不设路由守卫，未登录用户可正常使用全部功能，需要登录的操作以弹窗非阻塞提示
- 新增 StorageEngine 双模式存储：游客数据存 localStorage，登录后切换 CloudApiEngine 调云端 API；登录成功后自动将本地排行榜迁移到云端并清空本地数据
- 新增 API client 层：自动附加 Authorization header，access token 仅存内存不写 localStorage；401 时自动携带 HttpOnly Cookie 调用刷新接口换取新 token 并重试原请求，刷新失败则清除登录态并弹出登录框
- 新增排行榜分享功能：编辑页可生成分享短链接，支持私有/不公开/公开三种可见性与可选密码保护；分享页支持匿名只读访问
- 图片库双模式：游客以 base64 存 localStorage，登录后图片上传至服务端存储；图片加载组件按登录状态自动携带凭证
- 登录状态改用 Context（AuthProvider）全局共享，认证状态变化即时同步到编辑页、分享设置面板等组件
- 引入 @open-tiermaker/shared 共享类型（TierState、Tier、ImageItem 等）替代包内重复定义

### Patch Changes

- Updated dependencies
  - @open-tiermaker/shared@0.1.0
