import { vi } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";

export function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    board: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    boardItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async <T>(fn: (tx: unknown) => Promise<T>) => {
      const tx = {
        boardItem: { deleteMany: vi.fn(), createMany: vi.fn() },
        board: { update: vi.fn() },
      };
      return fn(tx);
    }),
  };
}

export function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
}

export function createMockJwt() {
  return {
    sign: vi.fn(),
    verify: vi.fn(),
  };
}

export function createMockConfig() {
  return {
    get: vi.fn((key: string, defaultValue?: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_SECRET: "test_access_secret",
        JWT_REFRESH_SECRET: "test_refresh_secret",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
        FRONTEND_URL: "http://localhost:3000",
        REDIS_URL: "redis://localhost:6379",
        DATABASE_URL: "postgresql://localhost:5432/test",
      };
      return map[key] ?? defaultValue ?? "";
    }),
  };
}

export async function createTestApp(
  module: TestingModule,
): Promise<NestExpressApplication> {
  const app = module.createNestApplication<NestExpressApplication>();
  await app.init();
  return app;
}

export async function closeTestApp(app: NestExpressApplication): Promise<void> {
  await app.close();
}

export const mockUser = {
  id: "user_123",
  email: "test@example.com",
  username: "testuser",
  avatarUrl: "https://example.com/avatar.png",
  passwordHash: "hashed_password",
  createdAt: new Date("2025-01-01"),
};
