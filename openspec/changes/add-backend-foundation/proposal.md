## Why

Open TierMaker 目前是一个纯前端应用，数据全部存储在浏览器 localStorage 中，容量有限（约 5MB）且无法跨设备访问。没有用户概念、没有云端持久化、没有分享能力——用户辛辛苦苦做好的排行榜换台电脑就没了，也无法分享给他人。加入后端模块，建立鉴权、存储、分享的完整基础设施，是项目从"玩具"走向"可用产品"的关键一步，同时为后续对象存储、社区浏览、实时协作等功能打好可扩展的架构基础。

## What Changes

- 引入 **monorepo 结构**（pnpm workspace），新增 `packages/server`（NestJS 后端）和 `packages/shared`（前后端共享类型）
- 新增 **用户系统**：邮箱密码注册登录 + GitHub OAuth + Google OAuth
- 新增 **排行榜云端持久化**：登录用户的排行榜数据存入 Postgres，支持多设备同步
- 新增 **排行榜分享**：生成短链接，支持 private / public / unlisted 三种可见性，可选密码保护
- 前端引入 **React Router**，支持多页面导航（首页、登录、排行榜列表、编辑页、分享页）
- 采用 **渐进式登录** 模式：未登录用户以游客身份正常使用所有功能，数据存 localStorage；在恰当场合非阻塞提示登录；登录后 localStorage 数据自动迁移到云端
- 保留 `localStorage` 作为游客模式的持久化方案，新增 API 层对接后端
- 本地图片上传：游客模式继续存 base64 到 localStorage，登录后上传到后端存 Postgres bytea

## Capabilities

### New Capabilities

- `user-auth`: 用户身份系统——注册、登录、会话管理、GitHub OAuth、Google OAuth、渐进式登录引导
- `cloud-storage`: 排行榜云端持久化——关联用户的排行榜 CRUD、多设备同步、图片二进制存储、登录后数据自动迁移
- `board-sharing`: 排行榜分享——短链接生成、匿名只读访问、可见性控制（private / public / unlisted）、密码保护

### Modified Capabilities

- `tier-board`: 持久化机制从单一 localStorage 升级为双模式（游客存 localStorage / 登录存云端）
- `image-library`: 图片存储根据登录状态双模式——游客存 base64 localStorage / 登录存服务端 bytea

## Impact

- **项目结构**：从单包变为 monorepo（`pnpm-workspace.yaml`，根目录 `package.json` 调整）
- **新增依赖**：NestJS、Prisma、PostgreSQL 驱动、Passport（OAuth）、nanoid（分享 ID）、Zod（验证）、React Router
- **前端改动**：新增 API client 层、React Router、登录注册 UI、渐进式登录提示组件、数据同步策略
- **开发要求**：本地需运行 PostgreSQL；开发时分两个终端分别启动前端（Vite）和后端（NestJS）
- **环境变量**：新增 `.env` / `.env.example`，包含数据库连接串、OAuth Client ID/Secret、Session Secret 等
