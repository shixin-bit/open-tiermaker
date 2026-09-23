## Context

参考 proposal.md 中的 Why。当前项目是单包 Vite + React 应用，数据完全依赖 `src/lib/storage.ts` 写入 localStorage。没有路由、没有后端、没有用户模型。

**部署拓扑关键约束：**

```
浏览器
  │
  ▼
Cloudflare Workers（前端静态资源 + API 代理/缓存层）
  │
  ▼
Render（NestJS 后端 + Postgres）
```

前端和后端**非同源**，跨域请求通过 CORS 处理。这个约束直接影响鉴权方案的选择（见 D4）。

## Goals / Non-Goals

**Goals:**

- 搭建 monorepo 结构：`packages/web`（前端）、`packages/server`（NestJS）、`packages/shared`（共享类型）
- 实现用户鉴权：邮箱密码注册登录、GitHub OAuth、Google OAuth、JWT 双 token（access + refresh）
- 实现排行榜 CRUD 与图片二进制存储（Postgres bytea）
- 实现短链接分享，支持 private / public / unlisted 三种可见性及可选密码保护
- 实现渐进式登录：所有功能无需登录即可使用（localStorage 兜底）；在关键节点做非阻塞登录提示；登录后自动将 localStorage 数据迁移到云端
- 所有 API 路由按模块组织，为后续扩展（对象存储、实时协作、投票）预留空间
- API 设计兼容未来移动端接入

**Non-Goals:**

- 对象存储（Cloudflare R2 / OSS）——下一阶段变更
- 多人实时协作（Yjs / WebSocket）——下一阶段
- 社区浏览（公开排行榜列表、投票、评论、点赞）——下一阶段
- 排行榜历史版本 / 快照——下一阶段
- 邮箱验证 / 密码找回邮件——下一阶段（账号恢复靠 OAuth 重新登录即可）

## Decisions

### D1: Monorepo + pnpm workspace

根 `package.json` 中的前端开发依赖迁入 `packages/web/package.json`。新建 `packages/server/`，内含 NestJS 依赖。新建 `packages/shared/`，导出前后端共享的 TypeScript 类型（`TierState`、`Tier`、`ImageItem`、DTO 等）。根 `package.json` 保留工具链配置（lint-staged、commitlint、husky、eslint、prettier、typescript）。根目录新增 `pnpm-workspace.yaml` 声明三个子包。

备选：两个独立仓库。放弃原因：共享类型需要发布到内部 registry 或手动复制，拖慢跨端功能开发效率。

### D2: 后端框架 —— NestJS

用户明确选择了 NestJS。其模块化体系、依赖注入、生态成熟（nestjs-prisma、Passport 各 strategy、class-validator），实现鉴权、CRUD 以及未来扩展（Realtime Gateway、Admin 面板）都很顺手。

### D3: ORM —— Prisma

用户选择 Prisma。schema-first、迁移体系（`prisma migrate dev`）、生成式 TypeScript Client、Postgres 原生支持好（enum、JSON、bytea 二进制列）。本阶段图片以 bytea 存在 Postgres；后续接对象存储时只需改读写逻辑，API 层不动。

### D4: 鉴权 —— JWT 双 Token（access + refresh）

**因为前后端非同源，JWT 比 Session Cookie 更合适**，具体原因：

跨域场景下 Cookie 的麻烦：

- 跨域 fetch 默认不带 Cookie，必须显式 `credentials: 'include'`
- 后端必须配 `Access-Control-Allow-Credentials: true` + `SameSite=None; Secure`
- CSRF 风险在 SameSite=None 下重新暴露（浏览器对任何第三方请求仍会自动带 Cookie）
- Cloudflare Workers 无法操作 session 状态，session store 只能在 Render 上集中存

JWT 双 token 方案：

- **Access Token**：短时效（默认 15 分钟），放在 `Authorization: Bearer` header 里；过期后由前端静默刷新
- **Refresh Token**：长时效（默认 7 天），通过 `POST /api/auth/refresh` 换取新的 access token；**存在 Redis 中做轮换检测和黑名单**——登出、修改密码踢下线、refresh token 重放检测都靠这个
- JWT 的 payload 存 `{ userId, tokenId }`，`tokenId` 对应 Redis 中的记录，服务端通过查 Redis 判断 refresh token 是否仍有效
- 前端将 access token 和 refresh token 都存在 **localStorage**（跨域下 HttpOnly Cookie 与 session 方案的 CSRF 等价风险无法同时消弭，接受 XSS 面作为取舍，后续可升级为 httpOnly Cookie 存储）

OAuth 流程：GitHub/Google 回调成功后，后端签发 refresh token 存入 Redis，然后返回一个带 token 的前端跳转链接（如 `https://app.example.com/auth/callback?refresh=xxx`），前端拿到后存 localStorage 并调 `/api/auth/refresh` 换 access token。

备选：Session Cookie。放弃原因：跨域下 Cookie 传递配置繁琐 + SameSite=None 导致 CSRF 风险复燃 + Workers 无法参与 session 管理 + JWT 天然兼容未来移动端接入。

### D5: 渐进式登录 + 双存储引擎

前端抽象两个"数据引擎"：

```
StorageEngine (接口)
├── LocalStorageEngine   ← 复用现有 storage.ts 逻辑，base64 图片
└── CloudApiEngine       ← 用 fetch 调用 NestJS API，手动附 Authorization header
```

新增 `useAuth()` Hook，暴露 `{ user, loading, login, logout, register, isAuthenticated }`。现有的 `useBoardState()` Hook 内部根据 `isAuthenticated` 选择引擎：

```ts
const engine = isAuthenticated ? cloudEngine : localEngine;
const state = await engine.loadState();
```

登录成功后执行一次性迁移 `migrateLocalToCloud()`：加载 localStorage 中所有排行榜 → 逐个调用 `POST /api/boards` → 清空 localStorage → 切换为云端引擎。迁移按排行榜内容哈希去重，服务端已存在的排行榜会被跳过。

### D6: React Router 路由

```
/                      → 首页（HomePage）—— 功能介绍 + 引导登录
/login                 → 登录页（LoginPage）—— 邮箱密码 + GitHub + Google
/register              → 注册页（RegisterPage）
/auth/callback         → OAuth 回调中间页（前端拿 URL 参数里的 refresh token 存 localStorage）
/boards                → 我的排行榜列表（BoardListPage）
/boards/new            → 创建排行榜（NewBoardPage）
/boards/:id            → 编辑排行榜（EditBoardPage）
/share/:shareId        → 分享只读页（SharedBoardPage）—— 无需登录
```

**不使用路由守卫**——所有页面任何人都能访问。区别仅在于行为：未登录用户打开 `/boards` 看到的是本地存储的排行榜（通常为空）+ 登录提示 banner。

### D7: API 路由规划

```
# 鉴权
POST   /api/auth/register         { email, password, username }
POST   /api/auth/login            { email, password } → 返回 { accessToken, refreshToken }
POST   /api/auth/logout           { refreshToken } → 服务端黑名单化
POST   /api/auth/refresh          { refreshToken } → 返回新 accessToken（轮换 refresh token）
GET    /api/auth/session          → { user: { id, email, username, avatarUrl } | null }（需 access token）
GET    /api/auth/github           → 重定向到 GitHub OAuth
GET    /api/auth/github/callback  → 成功后 302 跳转到前端 /auth/callback?refresh=xxx
GET    /api/auth/google           → 重定向到 Google OAuth
GET    /api/auth/google/callback

# 排行榜（需 access token）
GET    /api/boards                → 当前用户的排行榜列表
POST   /api/boards                → 创建空排行榜
GET    /api/boards/:id             → 获取排行榜完整内容（所有者）
PUT    /api/boards/:id             → 更新元信息（标题、描述、可见性、密码）
DELETE /api/boards/:id
PUT    /api/boards/:id/content     → 全量更新 TierState（tiers + items）

# 图片（需 access token）
POST   /api/boards/:id/images      → 上传图片二进制 → { id }
DELETE /api/boards/:id/images/:imgId

# 分享
POST   /api/boards/:id/share       → 重新生成 shareId（需登录）
GET    /api/share/:shareId         → 匿名只读访问（校验可见性 + 可选密码）
```

### D8: 数据库 Schema（Prisma 概要）

- `User`：id、email（唯一）、username、avatarUrl、passwordHash、createdAt
- `Account`：关联 OAuth provider（github / google），userId + providerAccountId 唯一
- `Board`：id、userId（外键）、title、description、visibility（enum: private/public/unlisted）、shareId（唯一，nanoid 8 位）、sharePasswordHash（可选）、tierConfig（JSON，存 S/A/B/C/D 等 tier 配置）、createdAt、updatedAt
- `BoardItem`：id、boardId（外键）、tierKey（字符串，如 "S"）、position（排序）、title、imageData（bytea，本阶段存二进制）、createdAt

**不单独建 Tier 表**——tier 的键和配置存在 `Board.tierConfig` JSON 中，保持灵活。items 通过 `tierKey` 关联 tier。

### D9: 登录提示触发时机

| 触发场景                                   | 表现形式                                                     |
| ------------------------------------------ | ------------------------------------------------------------ |
| 首次访问（localStorage 为空且未登录）      | 首页顶部轻量 banner："登录开启云端保存和分享能力 →"          |
| 用户点击"导出图片"按钮                     | 一次性 toast："提示：登录后数据自动同步云端，换设备也能继续" |
| 用户点击"生成分享链接"                     | Modal 弹窗：分享是云端功能 → 提供登录 CTA                    |
| localStorage 使用量 ≥ 4MB（接近 5MB 上限） | 带存储进度条的 toast 警告                                    |

全部可关闭或忽略。**唯一阻塞用户操作的是分享功能**——因为分享本身必须走云端。

## Risks / Trade-offs

- **[风险] JWT 双 token 机制实现复杂度高于 session** → 换 token 拦截器、401 自动重试、refresh token 轮换逻辑都要自己写；NestJS 的 `@nestjs/jwt` + 自定义 Auth Guard 可搞定，但比 Passport session 工作量大
- **[风险] Refresh token 仍需要 Redis** → 为了黑名单、轮换检测、密码修改踢下线，refresh token 不能完全无状态；接受这个取舍（Redis 只是为 refresh token 服务，access token 仍是无状态验签）
- **[风险] Access token 存 localStorage 有 XSS 窃取风险** → 当前架构下前端是纯 Vite React，没有复杂服务端渲染，XSS 面主要靠 CSP 和输入转义控制；后续可升级为 httpOnly Cookie 存 access token 来加固
- **[风险] Prisma schema 在开发早期频繁变动** → 可接受；`prisma migrate dev` 支持反复调整，schema.prisma 中按模块分节注释保持清晰
- **[风险] Postgres bytea 存储图片会膨胀数据库** → 本阶段故意为之；下一阶段变更加对象存储并迁移，BoardItem 模型已预留 imageUrl 字段位置
- **[风险] 登录时 localStorage → 云端迁移的边界情况**（本地和云端有同名排行榜）→ 按内容哈希去重而非按名称，冲突则保留云端副本跳过
- **[取舍] 开发时两个终端**（前端 5173，后端本地 NestJS）→ 接受；Vite 配 proxy 把 `/api/*` 转发到后端，开发期免 CORS 头痛。生产环境 Cloudflare Workers 负责反向代理和 CORS
- **[取舍] OAuth 回调需要前端中转** → 后端 OAuth callback 302 到前端 `/auth/callback?refresh=xxx`，前端拿到后再调 `/api/auth/refresh` 换 access token；比同源 session 方案多一跳，但跨域下这是常规做法
