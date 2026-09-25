# syntax=docker/dockerfile:1
# Open TierMaker 后端镜像（NestJS + Prisma）
# 构建上下文必须是 monorepo 根目录：docker build -t open-tiermaker-server .

# ---- 依赖安装（含编译 bcrypt 原生模块所需工具链）----
FROM node:22-bookworm-slim AS deps

# CloudBase 云端构建在国内网络，统一走 npmmirror 提升可靠性
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=https://registry.npmmirror.com
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

# 先复制清单，利用 Docker 层缓存
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json

# 只安装 server 及其工作区依赖（shared），排除 web
RUN pnpm install --filter @open-tiermaker/server... --frozen-lockfile

# ---- 构建 ----
FROM deps AS build

COPY packages/shared packages/shared
COPY packages/server packages/server

# 删除可能被复制进来的 tsc 增量缓存，避免容器内构建漏发 JS 文件
RUN rm -f packages/server/tsconfig.tsbuildinfo \
  && pnpm --filter @open-tiermaker/server exec prisma generate \
  && pnpm --filter @open-tiermaker/server run build

# ---- 运行 ----
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
# CloudBase Run 服务端口固定为 80；平台若注入 PORT 则以平台为准
ENV PORT=80
# Prisma 在国内网络拉取 query engine（运行时不需要，但保留镜像源配置无副作用）
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/prisma ./packages/server/prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/node_modules ./packages/server/node_modules

WORKDIR /app/packages/server

EXPOSE 80

# 启动前执行 Prisma 迁移（migrate deploy 幂等），再启动服务
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
