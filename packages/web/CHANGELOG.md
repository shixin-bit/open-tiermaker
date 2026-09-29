# @open-tiermaker/web

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
