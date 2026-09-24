## Purpose

为 Open TierMaker 提供用户身份系统和渐进式登录体验，让未登录访客也能完整体验应用，同时通过非阻塞提示引导用户开启云端能力。

## Requirements

### Requirement: 邮箱密码注册

系统 SHALL 允许用户通过邮箱、密码、用户名进行注册。邮箱格式和密码强度 SHALL 做基础校验；邮箱已被注册时 SHALL 返回明确的错误提示。

#### Scenario: 新用户成功注册

- **WHEN** 用户在注册页填写了有效的邮箱、密码和用户名并点击注册
- **THEN** 系统创建新账户、自动登录并跳转到首页

#### Scenario: 邮箱已被占用

- **WHEN** 用户填写的邮箱已存在并提交注册
- **THEN** 系统返回错误提示"该邮箱已被注册"且不创建账户

### Requirement: 邮箱密码登录

系统 SHALL 允许已注册用户通过邮箱和密码登录。登录成功后建立会话，失败时返回明确错误提示。

#### Scenario: 登录成功

- **WHEN** 用户在登录页输入正确的邮箱和密码并提交
- **THEN** 系统建立登录会话并跳转到首页

#### Scenario: 密码错误

- **WHEN** 用户输入的密码与账户不匹配
- **THEN** 系统返回"邮箱或密码错误"且不透露哪一项有误

### Requirement: GitHub OAuth 登录

系统 SHALL 提供 GitHub 一键登录入口。用户授权后，如首次使用则自动创建账户；如已绑定则直接登录。

#### Scenario: 首次通过 GitHub 登录

- **WHEN** 用户点击 GitHub 登录并完成授权
- **THEN** 系统从 GitHub 获取用户信息，创建新账户并建立登录会话

#### Scenario: 已绑定的 GitHub 用户登录

- **WHEN** 已绑定 GitHub 的用户再次点击 GitHub 登录
- **THEN** 系统识别已有账户并直接建立登录会话

### Requirement: Google OAuth 登录

系统 SHALL 提供 Google 一键登录入口，行为与 GitHub OAuth 一致。

#### Scenario: Google 授权成功

- **WHEN** 用户点击 Google 登录并完成授权
- **THEN** 系统从 Google 获取用户信息，匹配或创建账户并登录

### Requirement: 登录会话管理

系统 SHALL 使用双 Token 机制管理登录会话：Access Token 存于前端内存变量中，随 `Authorization: Bearer` header 发送；Refresh Token 存于 HttpOnly Cookie 中，前端 JavaScript 不可读。前端 SHALL 能查询当前登录状态，并支持主动登出。

#### Scenario: 登录/注册成功后写入 Token

- **WHEN** 用户通过邮箱密码或 OAuth 成功登录
- **THEN** 后端将 refresh token 写入 HttpOnly Cookie（`SameSite=Lax; HttpOnly; Path=/api/auth`），响应 body 返回 access token 和 user 信息；前端将 access token 存入内存变量

#### Scenario: 页面加载时恢复会话

- **WHEN** 用户刷新或重新打开页面（内存中的 access token 已丢失）
- **THEN** 前端自动调用 `POST /api/auth/refresh`（fetch 自动携带 cookie），后端从 cookie 读 refresh token 验证后返回新 access token；前端存入内存并标记为已登录

#### Scenario: Access Token 过期时静默刷新

- **WHEN** API 请求返回 401 且内存中无有效 access token
- **THEN** 前端自动调 `POST /api/auth/refresh`（带 cookie）换取新 access token，重试原始请求；若 refresh 也失败则触发 `auth:required` 事件

#### Scenario: 主动登出

- **WHEN** 已登录用户点击登出按钮
- **THEN** 前端调 `POST /api/auth/logout`（带 cookie，不传 body），后端从 cookie 读 refresh token 加入 Redis 黑名单并清除 cookie；前端清除内存中的 access token，用户立即变为未登录状态

### Requirement: 渐进式登录提示

系统 SHALL 在不阻塞用户操作的前提下，在关键时机引导用户登录开启云端能力。登录弹窗 SHALL 为包含邮箱密码输入的登录表单（而非仅提示跳转），用户可在弹窗内直接完成登录。

#### Scenario: 首次访问的引导提示

- **WHEN** 用户首次进入页面（localStorage 为空且未登录）
- **THEN** 页面顶部展示一个可关闭的 banner，提示登录可开启云端保存和分享能力

#### Scenario: 用户主动点击登录

- **WHEN** 未登录用户点击导航栏的"登录"按钮或分享面板中的"立即登录"
- **THEN** 系统弹出登录表单弹窗（含邮箱、密码输入框和提交按钮），用户填写后直接在弹窗内完成登录；登录成功后弹窗关闭，认证状态通过 Context 立即同步到所有组件（如分享面板自动更新为已认证 UI）

#### Scenario: API 401 触发的登录提示

- **WHEN** API 请求返回 401 且 refresh token 也失效
- **THEN** 系统通过 `emitAuthRequired()` 事件弹出登录表单弹窗；用户关闭弹窗后，`dismissed` 标记被设置，后续非强制的 `auth:required` 事件不会重复弹出，避免干扰用户操作

#### Scenario: 分享面板的强制登录

- **WHEN** 未登录用户在分享面板点击需要登录的操作（如"立即登录"）
- **THEN** 系统通过 `emitAuthRequired(force=true)` 强制弹出登录表单弹窗（忽略 `dismissed` 标记），用户完成登录后继续分享流程

#### Scenario: localStorage 即将耗尽时的警告

- **WHEN** 游客模式下 localStorage 使用量接近浏览器上限
- **THEN** 系统展示一个带存储进度条的警告 toast，提示登录可解锁无限空间

### Requirement: 登录后数据自动迁移

用户从游客模式切换到登录模式时，系统 SHALL 将 localStorage 中已有的排行榜数据一次性迁移到云端。迁移函数 `migrateLocalToCloud()` 返回 `{ localId: cloudId }` 映射，迁移成功后清空 localStorage 中的排行榜数据。

#### Scenario: 从登录页/注册页登录后迁移

- **WHEN** 用户在 LoginPage 或 RegisterPage 登录成功，且 localStorage 中存在排行榜数据
- **THEN** 系统自动调用 `migrateLocalToCloud()`，遍历所有本地排行榜逐个上传到云端（`POST /api/boards` + `PUT /boards/:id/content`），迁移完成后清空 localStorage 中的排行榜数据，导航到排行榜列表页

#### Scenario: 在编辑页登录后迁移并切换到云端模式

- **WHEN** 游客在 EditBoardPage 编辑本地排行榜时通过 AuthModal 登录成功
- **THEN** 系统先强制保存当前编辑状态到 localStorage（防抖 auto-save 可能未触发），再调用 `migrateLocalToCloud()` 上传所有本地排行榜，根据返回的 `{ localId: cloudId }` 映射导航到 `/boards/{cloudId}`（云端编辑页，有保存按钮和分享面板）

#### Scenario: OAuth 回调后迁移

- **WHEN** 用户通过 GitHub/Google OAuth 登录成功（后端已通过 Set-Cookie 写入 HttpOnly Cookie）
- **THEN** `OAuthCallbackPage` 等待 `useAuth` 自动刷新获取 access token 后，调用 `migrateLocalToCloud()` 迁移本地数据，导航到排行榜列表页

#### Scenario: 迁移失败时保留本地数据

- **WHEN** 某个本地排行榜上传失败（网络错误或服务端异常）
- **THEN** 系统跳过该排行榜继续迁移其他排行榜，不中断整个迁移流程；已成功迁移的排行榜会被清空，失败的保留在 localStorage
