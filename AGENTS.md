# Agent 编码规范

---

## 第一部分：项目通用规则

### 构建与验证（每次变更后必跑）

```bash
# 全量 build
pnpm run build

# 单个包
pnpm --filter web run build
pnpm --filter server run build
```

`tsc` 必须零错误。常见问题：

- 未使用的变量或参数 → 用 `_` 前缀或删除
- 类型不匹配 → 修正类型或添加正确的类型断言
- 缺少导入 → 补充 import 语句

### 代码风格

- 不允许 `any` 类型滥用，能用 `unknown` 或联合类型的地方不用 `any`
- 不允许跳过测试或删除测试来让构建通过
- 测试文件与源码分开，前端单元测试放 `src/__tests__/`，E2E 放 `e2e/`
- 文件编码统一 UTF-8 无 BOM（PowerShell 写文件用 `New-Object System.Text.UTF8Encoding $false`）

### Monorepo 约定

- 前后端共享的类型定义放在 `packages/shared/src/`，通过 `@open-tiermaker/shared` 导入
- 根 `package.json` 只保留工具链配置和 workspace 脚本，不放业务依赖
- 子包间依赖用 `workspace:*` 声明（如 `"@open-tiermaker/shared": "workspace:*"`）
- `pnpm install` 必须在根目录执行，不要进入子包单独装

### 文档语言

- 所有 Markdown 文档（spec、design、proposal、tasks、README 等）内容尽量使用中文，专业术语（API、OAuth、ORM、CRDT、monorepo 等）可保留英文

---

## 第二部分：前端专属约束

### 技术栈

- **框架**: React 19（函数式组件 + Hooks）
- **构建**: Vite 8
- **样式**: Tailwind CSS 4（配合 `@tailwindcss/vite` 插件）
- **拖拽**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- **路由**: react-router-dom（渐进式登录，无路由守卫）
- **测试**: Vitest + Testing Library（单元），Playwright（E2E）
- **类型**: TypeScript strict mode

### React 最佳实践

- 组件写函数式组件 + `export default` 或具名导出，不要用 class component
- Hooks 写在 `src/hooks/` 目录，命名 `use*`
- 组件按功能目录组织（如 `components/TierRow.tsx`、`components/ImageUploader.tsx`）
- Props 类型在组件文件顶部用 `interface` 定义，命名 `XxxProps`
- 避免不必要的 `useEffect` 触发，依赖数组必须完整
- 状态优先放组件内（`useState`），跨组件共享用 Context 或 localStorage，不要滥用全局状态库

### 路由约束

- 登录/注册/首页可以是独立页面，也可以是首页内嵌的 Modal——保持导航一致
- 渐进式登录：**不使用路由守卫**，未登录用户也能访问所有页面，只是行为不同
- 未登录访问需要登录功能时（保存数据、分享），弹窗提示登录
- 路由结构（参考 design.md D6）：
  - `/` 首页、`/login`、`/register`、`/auth/callback`（OAuth 回调）
  - `/boards`、`/boards/new`、`/boards/:id`（需登录才有云端数据）
  - `/share/:shareId`（只读分享，无需登录）

### 样式约束

- Tailwind 类名写在 className 里，不要搞额外的 CSS-in-JS 库
- 颜色变量用 Tailwind 内置（`bg-red-500`），需要自定义的在 `tailwind.config.ts` 里加
- 全局样式放 `src/index.css`，Tailwind 的 `@import "tailwindcss";` 必须存在

### API 客户端

- fetch 封装在 `src/lib/api/client.ts`，有 access token 时自动附 `Authorization: Bearer` header
- access token 只存内存（`src/lib/tokens.ts` 的模块变量），**不写 localStorage**；整页刷新后内存丢失，靠 HttpOnly Cookie 静默刷新恢复
- refresh token 由后端通过 HttpOnly Cookie（名 `refreshToken`，`path=/api/auth`）下发，前端 JS 不读取、不存储
- 401 时自动带 cookie 调一次 `POST /api/auth/refresh` 换取新 access token 并重试原请求；刷新失败则清除登录态并触发登录 Modal
- 所有请求使用 `credentials: 'include'`

### 存储引擎（渐进式登录）

```
StorageEngine（接口）
├── LocalStorageEngine  ← 未登录，复用 storage.ts
└── CloudApiEngine     ← 已登录，调 API
```

- `useAuth().isAuthenticated` 决定用哪个引擎
- 登录后自动执行 `migrateLocalToCloud()` 把 localStorage 数据提交到云端

### 前端测试要求（严格）

**每次新增公共组件或公共方法，必须同步编写单元测试——测试全部通过后才能保留代码，否则重写。**

#### 测试框架与命令

```bash
# 单元测试（jsdom 环境，Vitest + @testing-library/react）
pnpm --filter web test

# 运行单个测试文件
pnpm --filter web test -- src/__tests__/AuthBanner.test.tsx

# watch 模式（开发时持续跑）
pnpm --filter web test:watch

# 带覆盖率报告（排查漏测）
pnpm --filter web test -- --coverage

# E2E 测试（Playwright，已 mock 全部 API）
pnpm --filter web test:e2e
```

#### 必须测试的内容（新增即覆盖）

| 新增类型                     | 测试类型                          | 必须覆盖的场景                                                                                     |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| 公共组件（放 `components/`） | 组件测试（Testing Library）       | 渲染输出、props 变更、用户交互（点击/输入/拖拽）、条件分支、边界条件（空数据、超长文本、禁用状态） |
| 公共 Hook（放 `hooks/`）     | Hook 测试（renderHook + act）     | 初始值、状态更新、副作用触发时机、依赖变化、异步行为（loading/success/error）、cleanup             |
| 公共工具函数（放 `lib/`）    | 纯函数单元测试                    | 每个 if/else 分支、边界输入、非法输入的容错、返回值结构校验                                        |
| API Client 方法              | HTTP mock（vi.mock + fetch mock） | 请求构造、header 注入、401 自动刷新重试、错误映射为 ApiError                                       |

#### 测试文件组织

```
src/
├── components/
│   └── AuthBanner.tsx
└── __tests__/
    ├── AuthBanner.test.tsx           ← 组件测试 co-located
    ├── useAuth.test.ts               ← Hook 测试（文件名匹配）
    └── api-client.test.ts            ← 工具/模块测试
```

**命名约定：** 测试文件与源码同目录（`src/__tests__/` 作为汇总目录也可），文件名 `{ModuleName}.test.{ts|tsx}`。

#### 测试编写约束（硬性规则）

- **必须同时覆盖 happy path 和错误路径**——不能只测正常输入，不测异常分支
- 组件测试使用 **语义化查询**（`screen.getByRole`、`screen.getByLabelText`、`screen.getByText`），禁止用 `container.querySelector` 写脆弱的 CSS 选择器（E2E 里可以用 class 选择器）
- **禁止 mock 被测对象自身**（如测 `useAuth` 时不能 `vi.mock('./useAuth')`），但可以 mock 它依赖的 API、localStorage、第三方库
- 测试之间必须隔离：`beforeEach` 里清理 localStorage / sessionStorage / 恢复 mock
- 异步测试必须显式等完成：`await waitFor(...)` 或 `await act(async () => ...)`，不能靠 `setTimeout` 猜测时机
- `console.log` / `console.error` 在测试里要 mock 掉，避免测试输出污染；如果断言的是错误日志，用 `expect(console.error).toHaveBeenCalledWith(...)`
- 测试用例命名要描述行为而非实现：`it('点击关闭按钮后写入 localStorage 并隐藏 banner')` 比 `it('tests handleDismiss')` 好

#### 红线（违反即打回）

- ❌ 提交新增公共组件/方法但没有对应测试文件
- ❌ 测试覆盖率低于 70% 的模块不允许合并
- ❌ 只测 happy path 不测错误分支
- ❌ 为了让测试通过而在生产代码里加 `if (process.env.NODE_ENV === 'test')` 分支
- ❌ 用 `any` 类型跳过 TypeScript 检查让测试编译通过
- ❌ 手动删除测试文件或跳过测试（`it.skip` / `test.skip`）来让构建通过

**提交前必须跑 `pnpm --filter web test` 全绿，外加一次 `pnpm run build` 确认类型和构建都没问题。**

---

## 第三部分：后端专属约束

### 技术栈

- **框架**: NestJS 11（模块化 + 依赖注入）
- **ORM**: Prisma 6（schema-first 迁移）
- **数据库**: PostgreSQL
- **缓存/会话**: Redis（ioredis）
- **鉴权**: JWT 双 token（passport-jwt + bcrypt）
- **OAuth**: GitHub (passport-github2) + Google (passport-google-oauth20)
- **验证**: class-validator + class-transformer（全局 ValidationPipe）
- **测试**: Vitest（与前端统一，兼容 Jest API，describe/it/expect/vi.mock 等）

### 模块组织

```
src/
├── app.module.ts          ← 只做全局模块注册，不放业务逻辑
├── main.ts                ← 只做启动配置（CORS、ValidationPipe、端口）
├── prisma/                ← 全局 PrismaService（extends PrismaClient）
├── redis/                 ← 全局 RedisService
├── auth/                  ← AuthModule（注册登录 JWT）
├── oauth/                 ← OAuthModule（GitHub/Google）
├── board/                 ← BoardModule（排行榜 CRUD）
└── share/                 ← ShareModule（匿名只读分享）
```

- 每个业务模块包含：`*.module.ts`、`*.controller.ts`、`*.service.ts`、`strategies/`、`guards/`、`dto/`（按需）
- Controller 只做参数接收和响应返回，业务逻辑全放 Service
- DTO 类放 `dto/` 目录，用 class-validator 装饰器做校验
- Guards 放在 `auth/guards/`，业务模块用 `@UseGuards(JwtAuthGuard)` 保护路由
- **所有业务 Module 必须导入 `PrismaModule`（已设为全局 @Global，自动可用）和 `RedisModule`（同样全局）**

### Prisma 约束

- schema 放 `prisma/schema.prisma`，每次改 schema 后跑 `pnpm --filter server prisma migrate dev`
- 生成 Client：`pnpm --filter server prisma generate`
- 查 PrismaService 实例：通过依赖注入 `constructor(private readonly prisma: PrismaService)`
- **不在 controller 里直接用 `new PrismaClient()`**，必须走注入

### JWT / 鉴权约束

- **双 token 方案**：access token 无状态（验签），refresh token 存 Redis 做轮换和黑名单
- refresh token 通过 HttpOnly Cookie（`refreshToken`，`path=/api/auth`，`sameSite=lax`，生产环境 `secure`）下发；access token 仅在响应体返回、前端只保存在内存中
- Access token payload 只放 `{ userId, tokenId }`，不要塞多余字段
- Refresh token 每次刷新后**旧 token 立即从 Redis 删除**（防重放）
- 登出时把 refresh token 加到 Redis 黑名单（TTL = refresh token 剩余有效期）
- 密码修改后踢下线 = 把该用户所有 refresh token 相关的 Redis key 删除
- JWT 密钥、过期时间从 `.env` 读，不要硬编码
- `.env.example` 列出所有必需的环境变量，`DATABASE_URL`、`JWT_*`、`REDIS_URL`、OAuth 配置一个不能少

### CORS 约束

- 跨域请求（Cloudflare Workers → Render），后端 `enableCors({ origin: FRONTEND_URL, credentials: true })`
- 必须允许 credentials（refresh token 走 HttpOnly Cookie，前端请求固定带 `credentials: 'include'`）
- 允许的 headers 至少包含 `Content-Type` 和 `Authorization`

### 错误处理

- 用 NestJS 内置的 HttpException 体系（`NotFoundException`、`UnauthorizedException`、`ForbiddenException`、`BadRequestException`、`ConflictException`）
- Service 里 catch 异常后 throw 对应的 HttpException，Controller 不自己 try-catch（让 NestJS 全局过滤器处理）
- OAuth 回调里找不到 GitHub/Google email 要 throw 有意义的错误，不要静默失败

### 图片处理

- 上传限制：10MB，MIME type 白名单（`image/png`、`image/jpeg`、`image/gif`、`image/webp`）
- 第一阶段存在 Postgres bytea 列（`BoardItem.imageData`），**后续接对象存储时 API 层不动**
- 返回图片时用 `res.setHeader('Content-Type', ...); res.send(buffer)`，不要 base64 编码进 JSON

### 后端测试要求（严格）

**每个业务模块完成后必须编写 Vitest 测试**，测试文件放 `packages/server/src/{module}/` 下，命名 `*.spec.ts`。覆盖率要求：

| 模块            | 测试类型 | 要求                                                                |
| --------------- | -------- | ------------------------------------------------------------------- |
| AuthService     | 单元测试 | 覆盖注册、登录、刷新、登出、密码校验、Oauth 用户创建                |
| BoardService    | 单元测试 | 覆盖 CRUD、权限校验（非所有者不可操作）、content 全量更新、图片上传 |
| ShareService    | 单元测试 | 覆盖匿名访问、密码保护、错误 shareId                                |
| AuthController  | 集成测试 | 走完整 HTTP 请求链路，验证 JWT 在 header 里能正常工作               |
| BoardController | 集成测试 | 覆盖权限守卫、401 未授权响应、multipart 文件上传                    |
| ShareController | 集成测试 | 覆盖匿名 GET、密码错误 401、无效 shareId 404                        |

**测试配置说明：**

```bash
# 单元测试（不需要数据库）
pnpm --filter server test

# 运行单个测试文件
pnpm --filter server test -- auth.service.spec.ts

# watch 模式
pnpm --filter server test -- --watch
```

**测试编写约束：**

- 单元测试里 PrismaService 和 RedisService 用 `vi.mock()` mock 掉，不连真实数据库和 Redis
- 集成测试用 NestJS `Test.createTestingModule()` 启动完整的应用上下文，覆盖真实路由 + JWT 守卫
- 每个测试文件至少包含 happy path + 错误路径（参数非法、权限不足、资源不存在）
- 测试用例描述清晰：`describe('[Module]', () => { it('should ...', () => {}) })`
- 依赖注入在测试文件顶部手动 mock：
  ```typescript
  import { vi } from "vitest";
  vi.mock("../prisma/prisma.service");
  vi.mock("../redis/redis.service");
  ```
- 所有测试必须独立运行，不能有执行顺序依赖

**不允许跳过测试**——提交前 `pnpm --filter server test` 必须全绿。

### 禁止事项

- ❌ 在 Controller 里直接写 Prisma 查询（放 Service）
- ❌ 在路由参数里做业务校验（放 class-validator DTO）
- ❌ 硬编码配置值（全从 `.env` 读）
- ❌ 把整个 TierState JSON 塞进一个数据库列（拆成 Board + BoardItem）
- ❌ 用 `passport.session()` 或 express-session（我们是 JWT，不是 session）
- ❌ OAuth 回调里让前端 JS 拿到任何 token（后端回调直接 Set-Cookie 写 refresh token 并重定向到 `/auth/callback`，前端靠 cookie 静默刷新换取内存 access token）
- ❌ 在生产代码里留 console.log（用 NestJS Logger）
