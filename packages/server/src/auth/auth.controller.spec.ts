import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import {
  HttpStatus,
  ValidationPipe,
  type INestApplication,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import {
  createMockPrisma,
  createMockRedis,
  createMockConfig,
  createMockJwt,
  mockUser,
} from "../test-helpers";
import * as bcrypt from "bcrypt";

vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("hashed_password"),
  compare: vi.fn(),
}));
vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "mock_token_id") }));

vi.mock("passport-jwt", () => {
  interface MockStrategyInternal {
    validate: (payload: {
      userId: string;
      tokenId: string;
    }) => Promise<unknown>;
    success: (user: unknown) => void;
    fail: (err: Error) => void;
  }

  class MockStrategy {
    name = "jwt";
    private _options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this._options = options;
    }
    async authenticate(_req: Record<string, unknown>) {
      const self = this as unknown as MockStrategyInternal;
      try {
        const payload = { userId: "user_123", tokenId: "any" };
        const user = await self.validate(payload);
        if (user) {
          self.success(user);
        } else {
          self.fail(new Error("Unauthorized"));
        }
      } catch (e) {
        self.fail(e as Error);
      }
    }
  }
  return {
    ExtractJwt: { fromAuthHeaderAsBearerToken: () => () => "any" },
    Strategy: MockStrategy,
  };
});

let app!: INestApplication;
let prismaMock: ReturnType<typeof createMockPrisma>;
let redisMock: ReturnType<typeof createMockRedis>;
let jwtMock: ReturnType<typeof createMockJwt>;
let configMock: ReturnType<typeof createMockConfig>;

async function setup() {
  prismaMock = createMockPrisma();
  redisMock = createMockRedis();
  jwtMock = createMockJwt();
  configMock = createMockConfig();

  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      AuthService,
      LocalStrategy,
      JwtStrategy,
      { provide: PrismaService, useValue: prismaMock },
      { provide: RedisService, useValue: redisMock },
      { provide: ConfigService, useValue: configMock },
      { provide: JwtService, useValue: jwtMock },
    ],
  }).compile();

  app = module.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
}

beforeEach(async () => {
  vi.clearAllMocks();
  await setup();
});

afterEach(async () => {
  if (app) await app.close();
});

describe("POST /auth/register", () => {
  it("should 注册成功返回 access token + user，refresh token 写入 cookie", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(mockUser);
    jwtMock.sign
      .mockResolvedValueOnce("access_token_123")
      .mockResolvedValueOnce("refresh_token_456");

    const res = await request(app.getHttpServer()).post("/auth/register").send({
      email: "new@example.com",
      password: "password123",
      username: "newname",
    });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.accessToken).toBe("access_token_123");
    // refresh token 不再返回在 body 中，而是写入 HttpOnly cookie
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("refreshToken=refresh_token_456"),
      ]),
    );
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe("user_123");
  });

  it("should 邮箱已存在返回 409 Conflict", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);

    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(HttpStatus.CONFLICT);
  });

  it("should 邮箱格式非法返回 400 Bad Request", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "not-an-email", password: "pw123" });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("should 密码太短返回 400 Bad Request", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "a@b.com", password: "123" });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("should 缺 email 返回 400 Bad Request", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ password: "password123" });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("POST /auth/login", () => {
  it("should 邮箱密码正确返回 access token，refresh token 写入 cookie", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
    vi.mocked(bcrypt.compare).mockImplementationOnce(() =>
      Promise.resolve(true),
    );
    jwtMock.sign
      .mockResolvedValueOnce("access_tok")
      .mockResolvedValueOnce("refresh_tok");

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.accessToken).toBe("access_tok");
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("refreshToken=refresh_tok"),
      ]),
    );
  });

  it("should 用户不存在返回 401", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "ghost@test.com", password: "pw" });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("should 密码错误返回 401", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
    vi.mocked(bcrypt.compare).mockImplementationOnce(() =>
      Promise.resolve(false),
    );

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "test@example.com", password: "wrong" });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("should OAuth-only 用户（无密码）返回 401", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      passwordHash: null,
    });

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "oauth@test.com", password: "pw" });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

describe("POST /auth/refresh", () => {
  it("should 有效 refresh token（cookie）返回新 access token，refresh token 写入 cookie", async () => {
    jwtMock.verify.mockReturnValueOnce({
      userId: "user_123",
      tokenId: "old_tid",
    });
    redisMock.get.mockResolvedValueOnce("user_123");
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
    jwtMock.sign
      .mockResolvedValueOnce("new_access")
      .mockResolvedValueOnce("new_refresh");

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", "refreshToken=valid_refresh_token");

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.accessToken).toBe("new_access");
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("refreshToken=new_refresh"),
      ]),
    );
    expect(redisMock.del).toHaveBeenCalledWith("refresh:old_tid");
  });

  it("should Redis 找不到 tokenId 返回 401（token 已登出）", async () => {
    jwtMock.verify.mockReturnValueOnce({
      userId: "u1",
      tokenId: "blacklisted_tid",
    });
    redisMock.get.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", "refreshToken=blacklisted");

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("should 过期/无效 refresh token 返回 401", async () => {
    jwtMock.verify.mockImplementationOnce(() => {
      throw new Error("jwt expired");
    });

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", "refreshToken=expired");

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("should 无 refreshToken cookie 返回 401", async () => {
    const res = await request(app.getHttpServer()).post("/auth/refresh");

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

describe("POST /auth/logout", () => {
  it("should 成功登出返回 200 + { success: true }，清 cookie", async () => {
    jwtMock.verify.mockReturnValueOnce({
      userId: "user_123",
      tokenId: "logout_tid",
    });

    const res = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", "refreshToken=valid_refresh");

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({ success: true });
    expect(redisMock.del).toHaveBeenCalledWith("refresh:logout_tid");
    expect(redisMock.set).toHaveBeenCalledWith(
      "refresh:blacklist:logout_tid",
      "1",
      7 * 24 * 3600,
    );
    // 清除 cookie
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("refreshToken=;")]),
    );
  });

  it("should 无效 refresh token 也返回 200（幂等安全）", async () => {
    jwtMock.verify.mockImplementationOnce(() => {
      throw new Error("garbage");
    });

    const res = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", "refreshToken=garbage");

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({ success: true });
  });

  it("should 无 cookie 也返回 200", async () => {
    const res = await request(app.getHttpServer()).post("/auth/logout");

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({ success: true });
  });
});

describe("GET /auth/session", () => {
  it("should 无 Authorization header 返回 401", async () => {
    const res = await request(app.getHttpServer()).get("/auth/session");
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("should 有效 access token 返回当前用户", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);

    const res = await request(app.getHttpServer())
      .get("/auth/session")
      .set("Authorization", "Bearer any_token");

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.user.id).toBe("user_123");
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user.username).toBe("testuser");
  });

  it("should JwtStrategy validate 返回 null 时返回 401", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .get("/auth/session")
      .set("Authorization", "Bearer any");

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});
