## 1. Monorepo 基础设施搭建

- [x] 1.1 根目录创建 `pnpm-workspace.yaml`，声明 `packages/*`；将根 `package.json` 中前端相关依赖和脚本迁移到新建的 `packages/web/package.json`；根 `package.json` 保留工具链配置（eslint、prettier、husky、lint-staged、commitlint、typescript 配置）。验证：`pnpm install` 成功，`pnpm --filter web run dev` 能正常启动前端
- [x] 1.2 创建 `packages/shared` 子包，新建 `package.json`（name: `@open-tiermaker/shared`）、`tsconfig.json`、`src/index.ts`。将现有 `src/lib/types.ts` 中的 `Tier`、`ImageItem`、`TierState`、`DEFAULT_TIERS`、`DEFAULT_STATE` 迁移到 `packages/shared/src/types.ts` 并导出。验证：web 子包能正常从 `@open-tiermaker/shared` 导入类型
- [x] 1.3 创建 `packages/server` 子包，执行 `npm i -g @nestjs/cli && nest new .` 初始化 NestJS 项目，安装依赖：`@nestjs/jwt`、`@nestjs/passport`、`passport`、`passport-local`、`passport-github2`、`passport-google-oauth20`、`@prisma/client`、`prisma`、`nanoid`、`zod`、`@nestjs/config`、`ioredis`、`bcrypt`、`@types/bcrypt`。验证：`pnpm --filter server run start:dev` 能启动 NestJS（临时返回 Hello World 即可）

## 2. 后端数据库层

- [x] 2.1 配置 Prisma：`packages/server/prisma/schema.prisma` 定义 `User`、`Account`、`Board`、`BoardItem` 四张表（参考 design.md D8）。运行 `npx prisma migrate dev` 连接本地 Postgres 并生成迁移。验证：`prisma migrate dev` 成功，`prisma studio` 能正常访问数据库
- [x] 2.2 创建 `PrismaModule` 和 `PrismaService`（封装 `PrismaClient` 实例，实现单例 + 优雅停机）。在 `AppModule` 中注册 `PrismaModule`。验证：写一个 `health` controller 调用 `prisma.$queryRaw` 能成功返回
- [x] 2.3 编写 `.env.example` 模板文件，列出 `DATABASE_URL`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`JWT_ACCESS_EXPIRES_IN`、`JWT_REFRESH_EXPIRES_IN`、`REDIS_URL`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`FRONTEND_URL`。验证：`.env.example` 中的变量与 design.md 中 OAuth/JWT 配置项一致

## 3. 后端鉴权模块

- [x] 3.1 实现 JWT 双 token 服务：`AuthService` 提供 `generateAccessToken(userId)`、`generateRefreshToken(userId)`、`verifyAccessToken`、`verifyRefreshToken` 方法；refresh token 存入 Redis（key: `refresh:{tokenId}`, value: `{userId, expiresAt}`）。实现 `JwtAuthGuard` 和 `JwtRefreshAuthGuard`。验证：单元测试覆盖签发、验签、过期
- [x] 3.2 实现 LocalStrategy（邮箱密码注册登录）：`AuthController` 暴露 `POST /auth/register` 和 `POST /auth/login`，密码用 bcrypt 哈希，响应 body 返回 `{ accessToken, user }`，同时通过 `Set-Cookie` 将 refresh token 写入 HttpOnly Cookie（`SameSite=Lax; HttpOnly; Path=/api/auth`）。`POST /auth/logout` 从 `req.cookies` 读 refresh token 加入 Redis 黑名单并 `clearCookie`。`POST /auth/refresh` 从 `req.cookies` 读 refresh token 实现轮换（换新 token，旧 token 标记已用防重放），新 refresh token 通过 `Set-Cookie` 返回。`GET /auth/session` 根据 access token 返回当前用户信息。验证：用 curl/Postman 走通注册→登录→刷新→登出完整链路
- [x] 3.3 实现 GitHub OAuth：`GET /auth/github` 重定向、`GET /auth/github/callback` 由 Passport GitHubStrategy 处理，成功后对 `Account` 表 upsert 关联，签发 refresh token 存入 Redis 后通过 `Set-Cookie` 写入 HttpOnly Cookie，302 跳转到 `${FRONTEND_URL}/auth/callback`（不再通过 URL 传 token）。验证：配置好 GitHub OAuth App 后能走通授权流程
- [x] 3.4 实现 Google OAuth：与 GitHub OAuth 流程对称，Passport GoogleStrategy，回调 Set-Cookie 后 302 跳转到前端。验证：配置好 Google OAuth Client 后能走通授权流程
- [x] 3.5 配置 CORS 中间件，允许前端域名、`credentials: true`（Refresh Token 走 HttpOnly Cookie 需要携带）、允许 `Authorization`、`Content-Type`、`Cookie` header。后端启用 `cookie-parser` 中间件。验证：跨域 fetch 带 `credentials: 'include'` 能成功携带 cookie

## 4. 后端排行榜模块

- [x] 4.1 实现 `BoardController` 和 CRUD 路由：`GET /boards`（列表，按 updatedAt 倒序）、`POST /boards`（创建空排行榜，默认 tierConfig 为 S/A/B/C/D）、`GET /boards/:id`（校验所有权）、`PUT /boards/:id`（更新 meta）、`DELETE /boards/:id`。验证：登录用户能用 curl/Postman 完成完整 CRUD
- [x] 4.2 实现 `PUT /boards/:id/content` 全量更新接口：接收完整 `TierState`（tiers + pool + images），服务端做内容哈希对比（hash 相同不做更新），替换 `Board.tierConfig` 和对应的 `BoardItem` 记录。图片有 id 的保留，新的创建。验证：提交修改后 GET 返回最新内容
- [x] 4.3 实现图片上传：`POST /boards/:id/images` 接收 multipart/form-data，校验 MIME type（PNG/JPG/JPEG/GIF/WEBP）和大小（登录模式下 10MB 上限），存入 `BoardItem.imageData`（bytea）。`GET /boards/:id/images/:imgId` 返回图片二进制（**无需鉴权**，imgId 为 cuid 难以猜测，前端 `<img src>` 直接加载）。`DELETE /boards/:id/images/:imgId` 移除图片（需鉴权）。验证：上传图片后前端能通过图片 URL 直接渲染

## 5. 后端分享模块

- [x] 5.1 实现 `POST /boards/:id/share`：将可见性切换为 unlisted/public，生成 nanoid(8) shareId 并更新到 Board。`PUT /boards/:id` 中的 visibility 字段也支持设为 private（清除 shareId）。验证：切换可见性后数据库中 shareId/visibility 字段正确
- [x] 5.2 实现 `GET /share/:shareId` 匿名只读接口：校验 visibility 非 private、可选校验 sharePasswordHash（用 bcrypt 比对，密码通过 query param 或 header 传入）。返回排行榜完整内容但标记只读。验证：未登录用 curl 带正确 shareId 能取回内容，错误 shareId 返回 404
- [x] 5.3 更新 BoardItem DTO，图片二进制数据通过 `GET /boards/:id/images/:imgId` 和 `GET /share/:shareId/images/:imgId` 单独返回（返回 application/octet-stream），避免 board content JSON 过大。验证：前端能通过 image URL 渲染图片

## 6. 前端基础设施 + 路由

- [x] 6.1 安装 `react-router-dom`，在 `main.tsx` 中用 `<BrowserRouter>` 包裹 `<App>`。创建路由配置（参考 design.md D6）：`/`、`/login`、`/register`、`/auth/callback`、`/boards`、`/boards/new`、`/boards/:id`、`/share/:shareId`。验证：浏览器访问各路由地址能正确渲染对应组件
- [x] 6.2 创建 API client 层：`packages/web/src/lib/api/client.ts` 封装 fetch，统一处理 baseURL（Vite dev 时 proxy 到后端，生产时指向 Cloudflare Workers）、所有请求带 `credentials: 'include'`（携带 cookie）、自动从内存变量读 access token 注入 `Authorization: Bearer` header、401 自动调 `POST /api/auth/refresh`（带 cookie，无 body）重试一次，refresh 失败时 emit `auth:required` 事件。验证：单元测试覆盖 401 刷新重试逻辑、credentials: 'include'、cookie-based refresh
- [x] 6.3 创建 `useAuth()` 以 **Context Provider 模式**实现（`AuthProvider` 包裹 App 根组件），所有组件共享同一份认证状态。从 `GET /api/auth/session` 获取当前用户信息，暴露 `user`、`isAuthenticated`、`loading`、`login(email, password)`、`register(email, password, username)`、`logout()`。Access token 存**内存变量**（`lib/tokens.ts`，不写 localStorage），refresh token 由后端写入 HttpOnly Cookie，前端不存储。页面加载时自动调 `/api/auth/refresh`（带 cookie）恢复会话。验证：登录后刷新页面能自动恢复登录状态，登录后所有组件立即感知状态变化
- [x] 6.4 重构 `useTierState()` 为双引擎模式：新增 `StorageEngine` 接口，实现 `LocalStorageEngine`（复用现有 `storage.ts` 逻辑）和 `CloudApiEngine`（调 API）。`useBoardState(boardId)` Hook 根据 `useAuth().isAuthenticated` 选择引擎。验证：登录/未登录切换时数据从 localStorage 和云端各自独立读写

## 7. 前端登录 / 注册 / OAuth 回调页

- [x] 7.1 创建 `LoginPage`：邮箱 + 密码表单，GitHub 登录按钮（`window.location.href = '/api/auth/github'`），Google 登录按钮。错误提示 toast。验证：能走通邮箱密码登录
- [x] 7.2 创建 `RegisterPage`：邮箱 + 密码 + 用户名表单，注册成功后自动登录并跳转首页。验证：新用户注册后自动进入已登录状态
- [x] 7.3 创建 `OAuthCallbackPage`（路由 `/auth/callback`）：页面加载时不再从 URL 读 refresh 参数（后端已通过 Set-Cookie 写入 HttpOnly Cookie），直接调 `POST /api/auth/refresh`（fetch 自动带 cookie）换 access token 存入内存，跳转首页。验证：GitHub/Google 授权后能正确回到前端并保持登录
- [x] 7.4 登出功能：header 区域新增"登出"按钮（仅已登录时显示），调 `POST /api/auth/logout`（带 cookie，不传 body），后端清除 cookie 并黑名单化 refresh token，前端清除内存中的 access token，跳转首页。验证：登出后 `/api/auth/session` 返回 user: null

## 8. 前端排行榜编辑 + 列表 + 新建页

- [x] 8.1 创建 `BoardListPage`：登录用户展示自己所有排行榜概要列表（标题、描述、更新时间），空状态展示引导创建卡片，右上角有"新建排行榜"按钮。验证：新建一个排行榜后列表能显示
- [x] 8.2 创建 `NewBoardPage`：简单表单（标题必填、描述可选），提交调 `POST /api/boards`，跳转到 `/boards/:id` 编辑页。验证：创建后能正确跳转到编辑页
- [x] 8.3 重构 `App.tsx` 现有排行榜编辑功能到 `EditBoardPage`：支持路由参数 `:id` 加载对应排行榜内容，新增"保存"按钮调 `PUT /api/boards/:id/content`，保存后显示"已保存"状态。保留游客模式（无 boardId 时存 localStorage）。验证：登录用户修改后点击保存，刷新页面修改仍在
- [x] 8.4 排行榜删除：在编辑页或列表页提供删除按钮，二次确认后调 `DELETE /api/boards/:id`，返回列表页。验证：删除后列表不再显示该条目

## 9. 前端图片上传双模式

- [x] 9.1 重构 `ImageUploader.tsx`：登录用户选择文件后调 `POST /api/boards/:id/images`（multipart/form-data），拿到返回的图片 ID 后创建 `BoardItem` 记录。游客模式保持现有的 base64 存 localStorage 逻辑。验证：登录和游客模式都能上传图片并正确渲染
- [x] 9.2 重构图片渲染：`AuthImage.tsx` 组件简化——不再用 fetch + Authorization header 加载图片，直接用 `<img src>` 加载 API URL（图片接口无需鉴权）。游客模式继续用 base64 data URL 直接渲染。处理 data URL / 缓存图片 `onLoad` 不触发的边界（`img.complete + naturalWidth` 检查）。验证：已上传图片刷新页面后仍能显示，游客上传图片正常显示

## 10. 前端渐进式登录提示

- [x] 10.1 首页顶部 banner：未登录且 localStorage 为空时显示"登录开启云端保存和分享能力 →"，点击跳转登录页，可关闭。验证：首次访问看到 banner，关闭后不再显示
- [x] 10.2 导出图片按钮提示：未登录时点击导出显示一次性 toast（用 sessionStorage 防重复）。验证：未登录点导出看到提示，登录后消失
- [x] 10.3 localStorage 空间警告：未登录且 localStorage 超过 4MB 时在编辑页显示进度条警告 toast。验证：人为塞入大量数据后能触发警告
- [x] 10.4 登录后数据迁移：`migrateLocalToCloud()` 在 `LoginPage` / `RegisterPage` / `OAuthCallbackPage` 登录成功后调用，遍历 localStorage 中所有排行榜 → 逐个 `POST /api/boards` + `PUT /boards/:id/content` → 返回 `{ localId: cloudId }` 映射 → 清空 localStorage 排行榜数据。`EditBoardPage` 检测 `isAuthenticated` 从 false→true 时，先强制保存当前状态到 localStorage，再调 `migrateLocalToCloud()`，根据映射导航到 `/boards/{cloudId}`（云端编辑页，有保存按钮和分享面板）。验证：游客模式做了几个排行榜后登录，登录后云端能看到这些排行榜

## 11. 前端分享功能

- [x] 11.1 排行榜设置面板：编辑页侧边栏新增"分享"区域，包含可见性下拉（private / unlisted / public）、可选密码输入框、当前分享链接 + "重置链接"按钮。验证：切换可见性后端数据库正确更新
- [x] 11.2 未登录用户点击分享：`AuthModal` 组件为**登录表单弹窗**（含邮箱、密码输入框和提交按钮，非仅提示跳转），通过 `emitAuthRequired(force=true)` 强制弹出（忽略 dismissed 状态），用户在弹窗内直接完成登录；API 401 触发的 `emitAuthRequired()` 为非强制模式，用户关闭后不再重复弹出。验证：游客点击分享→弹登录表单→登录成功后分享功能可用
- [x] 11.3 创建 `SharedBoardPage`（路由 `/share/:shareId`）：从 URL 参数取 shareId → `GET /api/share/:shareId` 拿到内容 → 渲染只读排行榜（不可拖拽、不可编辑标签、无图片池、所有编辑按钮隐藏）。密码保护场景先弹密码输入页。验证：未登录用有效 shareId 能看到只读排行榜，无效 shareId 看到 404 提示

## 12. 构建验证 + E2E

- [x] 12.1 运行 `pnpm --filter web run build` 验证前端 TypeScript 编译和 Vite 构建无错误。运行 `pnpm --filter server run build` 验证后端 NestJS 编译无错误。修复所有类型错误和编译警告。验证：两个 build 都 exit code 0
- [x] 12.2 扩展 Playwright E2E 测试覆盖核心流程：注册 → 登录 → 创建排行榜 → 拖拽排序 → 保存 → 刷新验证持久化 → 生成分享链接 → 退出后匿名访问分享页。验证：`pnpm test:e2e` 全部通过
