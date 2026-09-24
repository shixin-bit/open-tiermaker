import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictException, UnauthorizedException } from "@nestjs/common";

vi.mock("../prisma/prisma.service", () => ({
  PrismaService: vi.fn(),
}));
vi.mock("../redis/redis.service", () => ({
  RedisService: vi.fn(),
}));
vi.mock("@nestjs/jwt", () => ({
  JwtService: vi.fn(),
}));
vi.mock("@nestjs/config", () => ({
  ConfigService: vi.fn(),
}));
vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("hashed_password"),
  compare: vi.fn(),
}));
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mock_token_id"),
}));

import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";

const mockUser = {
  id: "user_123",
  email: "test@example.com",
  username: "testuser",
  avatarUrl: "https://example.com/avatar.png",
  passwordHash: "hashed_password",
  createdAt: new Date(),
};

function createService() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  const redis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };

  const jwt = {
    sign: vi.fn(),
    verify: vi.fn(),
  };

  const config = {
    get: vi.fn((key: string, defaultValue?: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_SECRET: "access_secret_key",
        JWT_REFRESH_SECRET: "refresh_secret_key",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
      };
      return map[key] ?? defaultValue ?? "";
    }),
  };

  vi.mocked(PrismaService).mockImplementation(() => prisma);
  vi.mocked(RedisService).mockImplementation(() => redis);
  vi.mocked(JwtService).mockImplementation(() => jwt);
  vi.mocked(ConfigService).mockImplementation(() => config);

  const service = new AuthService(
    prisma as unknown as InstanceType<typeof PrismaService>,
    jwt as unknown as InstanceType<typeof JwtService>,
    config as unknown as InstanceType<typeof ConfigService>,
    redis as unknown as InstanceType<typeof RedisService>,
  );
  return { service, prisma, redis, jwt, config };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("[AuthService] register", () => {
  it("should 注册新用户并返回 AuthResult", async () => {
    const { service, prisma, jwt } = createService();

    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce(mockUser);
    jwt.sign
      .mockResolvedValueOnce("access_token")
      .mockResolvedValueOnce("refresh_token");

    const result = await service.register(
      "test@example.com",
      "password123",
      "testuser",
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.accessToken).toBe("access_token");
    expect(result.refreshToken).toBe("refresh_token");
    expect(result.user.id).toBe("user_123");
    expect(result.user.email).toBe("test@example.com");
  });

  it("should 邮箱已存在时抛 ConflictException", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce(mockUser);

    await expect(
      service.register("test@example.com", "password123"),
    ).rejects.toThrow(ConflictException);
  });

  it("should username 不传时存 null", async () => {
    const { service, prisma, jwt } = createService();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({ ...mockUser, username: null });
    jwt.sign
      .mockResolvedValueOnce("access_token")
      .mockResolvedValueOnce("refresh_token");

    await service.register("test@example.com", "password123");

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: null }),
      }),
    );
  });
});

describe("[AuthService] validateLocal", () => {
  it("should 密码正确返回用户", async () => {
    const { service, prisma } = createService();
    vi.mocked(bcrypt.compare).mockImplementationOnce(() =>
      Promise.resolve(true),
    );
    prisma.user.findUnique.mockResolvedValueOnce(mockUser);

    const result = await service.validateLocal(
      "test@example.com",
      "password123",
    );
    expect(result).toEqual(mockUser);
  });

  it("should 用户不存在抛 UnauthorizedException", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.validateLocal("nobody@test.com", "pw"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should 用户无 passwordHash 时抛 UnauthorizedException", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      passwordHash: null,
    });

    await expect(service.validateLocal("oauth@test.com", "pw")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should 密码错误抛 UnauthorizedException", async () => {
    const { service, prisma } = createService();
    vi.mocked(bcrypt.compare).mockImplementationOnce(() =>
      Promise.resolve(false),
    );
    prisma.user.findUnique.mockResolvedValueOnce(mockUser);

    await expect(
      service.validateLocal("test@example.com", "wrong"),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe("[AuthService] refresh", () => {
  it("should 成功刷新：删除旧 token 并生成新 token", async () => {
    const { service, prisma, redis, jwt } = createService();

    jwt.verify.mockReturnValueOnce({
      userId: "user_123",
      tokenId: "old_token_id",
    });
    redis.get.mockResolvedValueOnce("user_123");
    prisma.user.findUnique.mockResolvedValueOnce(mockUser);
    jwt.sign
      .mockResolvedValueOnce("new_access")
      .mockResolvedValueOnce("new_refresh");

    const result = await service.refresh("old_refresh_token");

    expect(jwt.verify).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith("refresh:old_token_id");
    expect(result.accessToken).toBe("new_access");
    expect(result.refreshToken).toBe("new_refresh");
  });

  it("should Redis 里没有 tokenId 时抛 Unauthorized", async () => {
    const { service, redis, jwt } = createService();
    jwt.verify.mockReturnValueOnce({ userId: "user_123", tokenId: "ghost" });
    redis.get.mockResolvedValueOnce(null);

    await expect(service.refresh("bad_token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should token 无效/过期时抛 Unauthorized（catch 兜底）", async () => {
    const { service, jwt } = createService();
    jwt.verify.mockImplementationOnce(() => {
      throw new Error("jwt expired");
    });

    await expect(service.refresh("expired_token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should 用户不存在时抛 Unauthorized", async () => {
    const { service, prisma, redis, jwt } = createService();
    jwt.verify.mockReturnValueOnce({ userId: "ghost", tokenId: "tid" });
    redis.get.mockResolvedValueOnce("ghost");
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.refresh("refresh_token")).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe("[AuthService] logout", () => {
  it("should 成功删除 token 并加入黑名单", async () => {
    const { service, redis, jwt } = createService();
    jwt.verify.mockReturnValueOnce({
      userId: "user_123",
      tokenId: "token_abc",
    });

    await service.logout("refresh_token");

    expect(redis.del).toHaveBeenCalledWith("refresh:token_abc");
    expect(redis.set).toHaveBeenCalledWith(
      "refresh:blacklist:token_abc",
      "1",
      7 * 24 * 3600,
    );
  });

  it("should 无效/过期 refresh token 静默返回不报错", async () => {
    const { service, jwt, redis } = createService();
    jwt.verify.mockImplementationOnce(() => {
      throw new Error("jwt malformed");
    });

    await expect(service.logout("garbage")).resolves.toBeUndefined();
    expect(redis.del).not.toHaveBeenCalled();
  });
});

describe("[AuthService] findOrCreateOauthUser", () => {
  const githubAccount = {
    id: "acc_1",
    provider: "github",
    providerAccountId: "gh_123",
    userId: "user_123",
    user: mockUser,
  };

  it("should 已有 account 直接返回用户", async () => {
    const { service, prisma } = createService();
    prisma.account.findUnique.mockResolvedValueOnce(githubAccount);

    const result = await service.findOrCreateOauthUser({
      provider: "github",
      providerAccountId: "gh_123",
      email: "test@example.com",
    });

    expect(prisma.account.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result).toEqual(mockUser);
  });

  it("should 已有 account 但 avatar 变更时更新并返回新值", async () => {
    const { service, prisma } = createService();
    const newAvatarUser = {
      ...mockUser,
      avatarUrl: "https://example.com/new.png",
    };
    prisma.account.findUnique.mockResolvedValueOnce(githubAccount);
    prisma.user.update.mockResolvedValueOnce(newAvatarUser);

    const result = await service.findOrCreateOauthUser({
      provider: "github",
      providerAccountId: "gh_123",
      email: "test@example.com",
      avatarUrl: "https://example.com/new.png",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_123" },
      data: { avatarUrl: "https://example.com/new.png" },
    });
    expect(result.avatarUrl).toBe("https://example.com/new.png");
  });

  it("should 已有邮箱用户但无 account 时绑定 account", async () => {
    const { service, prisma } = createService();
    prisma.account.findUnique.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce(mockUser);
    prisma.account.create.mockResolvedValueOnce({ id: "acc_new" });

    const result = await service.findOrCreateOauthUser({
      provider: "github",
      providerAccountId: "gh_new",
      email: "test@example.com",
    });

    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "github",
          providerAccountId: "gh_new",
          userId: "user_123",
        }),
      }),
    );
    expect(result).toEqual(mockUser);
  });

  it("should 全新用户时创建 user + account", async () => {
    const { service, prisma } = createService();
    prisma.account.findUnique.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce(mockUser);

    const result = await service.findOrCreateOauthUser({
      provider: "google",
      providerAccountId: "go_456",
      email: "new@example.com",
      username: "newname",
      avatarUrl: "https://example.com/avatar.png",
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          username: "newname",
          accounts: expect.objectContaining({
            create: expect.objectContaining({
              provider: "google",
              providerAccountId: "go_456",
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual(mockUser);
  });
});

describe("[AuthService] login", () => {
  it("should 返回 AuthResult", async () => {
    const { service, jwt } = createService();
    jwt.sign.mockResolvedValueOnce("access").mockResolvedValueOnce("refresh");

    const result = await service.login(mockUser);

    expect(result.accessToken).toBe("access");
    expect(result.refreshToken).toBe("refresh");
    expect(result.user.id).toBe("user_123");
  });
});

describe("[AuthService] validateAccessToken", () => {
  it("should 有效 token 返回 payload", async () => {
    const { service, jwt } = createService();
    const payload = { userId: "u1", tokenId: "t1" };
    jwt.verify.mockReturnValueOnce(payload);

    const result = await service.validateAccessToken("valid_token");
    expect(result).toEqual(payload);
  });

  it("should 无效 token 返回 null", async () => {
    const { service, jwt } = createService();
    jwt.verify.mockImplementationOnce(() => {
      throw new Error("invalid");
    });

    const result = await service.validateAccessToken("bad");
    expect(result).toBeNull();
  });
});
