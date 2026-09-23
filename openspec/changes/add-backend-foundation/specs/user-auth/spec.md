## Purpose

为 Open TierMaker 提供用户身份系统和渐进式登录体验，让未登录访客也能完整体验应用，同时通过非阻塞提示引导用户开启云端能力。

## ADDED Requirements

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

系统 SHALL 使用 HTTP-only Cookie 管理登录会话。前端 SHALL 能查询当前登录状态，并支持主动登出。

#### Scenario: 页面加载时恢复会话

- **WHEN** 用户刷新或重新打开页面
- **THEN** 前端通过 `GET /api/auth/session` 检测到有效会话并自动保持登录状态

#### Scenario: 主动登出

- **WHEN** 已登录用户点击登出按钮
- **THEN** 系统清除会话 Cookie，用户立即变为未登录状态

### Requirement: 渐进式登录提示

系统 SHALL 在不阻塞用户操作的前提下，在关键时机引导用户登录开启云端能力。

#### Scenario: 首次访问的引导提示

- **WHEN** 用户首次进入页面（localStorage 为空且未登录）
- **THEN** 页面顶部展示一个可关闭的 banner，提示登录可开启云端保存和分享能力

#### Scenario: 触发分享功能时强制登录

- **WHEN** 未登录用户点击"生成分享链接"
- **THEN** 系统弹出登录 Modal，用户完成登录后自动继续分享流程

#### Scenario: localStorage 即将耗尽时的警告

- **WHEN** 游客模式下 localStorage 使用量接近浏览器上限
- **THEN** 系统展示一个带存储进度条的警告 toast，提示登录可解锁无限空间

### Requirement: 登录后数据自动迁移

用户从游客模式切换到登录模式时，系统 SHALL 将 localStorage 中已有的排行榜数据一次性迁移到云端。

#### Scenario: 迁移成功

- **WHEN** 登录成功后 localStorage 中存在排行榜数据
- **THEN** 系统自动将所有本地排行榜上传到云端，迁移完成后清空 localStorage 中的排行榜数据

#### Scenario: 迁移冲突时保留云端副本

- **WHEN** 本地排行榜与云端已有排行榜内容哈希相同
- **THEN** 系统跳过该条，不创建重复数据
