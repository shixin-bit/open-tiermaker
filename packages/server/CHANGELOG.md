# @open-tiermaker/server

## 0.1.1

### Patch Changes

- Updated dependencies
  - @open-tiermaker/shared@0.2.0

## 0.1.0

### Minor Changes

- 新增 NestJS 11 后端基础（monorepo 新增 packages/server）：业务模块包含 auth（邮箱密码注册登录）、oauth（GitHub/Google OAuth）、board（排行榜 CRUD）、share（匿名只读分享）
- 新增用户系统：bcrypt 密码加密，GitHub OAuth 与 Google OAuth 登录；OAuth 回调由后端直接 Set-Cookie 下发 refresh token 并重定向到前端回调页，前端 JS 不接触任何 token
- 采用 JWT 双 Token 鉴权：access token 无状态验签（payload 仅含 userId 与 tokenId），refresh token 存 Redis 做轮换与防重放（每次刷新立即删除旧 token），通过 HttpOnly Cookie（path=/api/auth）下发；登出将 refresh token 加入 Redis 黑名单
- 新增排行榜云端持久化：数据关联用户存入 Postgres（Prisma 6），支持多设备同步与全量 content 更新；图片以 bytea 列存储，上传限制 10MB 并校验 MIME 白名单（png/jpeg/gif/webp），图片访问走独立接口
- 新增排行榜分享：nanoid 生成短链接，支持 private / unlisted / public 三种可见性，可选密码保护，提供匿名只读访问接口
- 开启 CORS（credentials: true）支持前端跨域携带 Cookie，全局 ValidationPipe 校验请求参数
- 使用 Vitest 编写单元与集成测试：Service 层 mock Prisma/Redis，Controller 层走完整 HTTP 链路验证守卫与鉴权

### Patch Changes

- Updated dependencies
  - @open-tiermaker/shared@0.1.0
