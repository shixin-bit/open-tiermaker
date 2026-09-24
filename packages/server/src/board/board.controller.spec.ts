import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import {
  HttpStatus,
  ValidationPipe,
  ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BoardController } from "./board.controller";
import { BoardService } from "./board.service";
import { PrismaService } from "../prisma/prisma.service";
import { createMockPrisma, createMockConfig } from "../test-helpers";

vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "abc123xy") }));
vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("hashed_pw"),
  compare: vi.fn(),
}));

vi.mock("../auth/guards/jwt-auth.guard", () => ({
  JwtAuthGuard: class {
    canActivate(ctx: ExecutionContext) {
      const req = ctx.switchToHttp().getRequest();
      req.user = {
        id: "user_123",
        email: "test@example.com",
        username: "testuser",
        avatarUrl: null,
      };
      return true;
    }
  },
}));

let app!: INestApplication;
let prismaMock: ReturnType<typeof createMockPrisma>;
let configMock: ReturnType<typeof createMockConfig>;

const mockBoard = {
  id: "board_1",
  title: "我的 S 排名",
  description: "desc",
  shareId: "share_abc",
  visibility: "unlisted" as const,
  sharePasswordHash: null,
  tierConfig: [
    { id: "S", label: "S", color: "#ef4444", imageIds: [] },
    { id: "A", label: "A", color: "#f97316", imageIds: [] },
  ],
  userId: "user_123",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-02"),
};

async function setup() {
  prismaMock = createMockPrisma();
  configMock = createMockConfig();

  const module = await Test.createTestingModule({
    controllers: [BoardController],
    providers: [
      BoardService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();

  app = module.createNestApplication();
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

function authHeader() {
  return { Authorization: "Bearer mocked_token" };
}

describe("GET /boards", () => {
  it("should 返回当前用户排行榜列表", async () => {
    prismaMock.board.findMany.mockResolvedValueOnce([mockBoard]);

    const res = await request(app.getHttpServer())
      .get("/boards")
      .set(authHeader());

    expect(res.status).toBe(HttpStatus.OK);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /boards", () => {
  it("should 成功创建排行榜返回 Board", async () => {
    prismaMock.board.create.mockResolvedValueOnce(mockBoard);

    const res = await request(app.getHttpServer())
      .post("/boards")
      .set(authHeader())
      .send({ title: "我的 S 排名", description: "desc" });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.id).toBe("board_1");
    expect(res.body.title).toBe("我的 S 排名");
  });
});

describe("GET /boards/:id", () => {
  it("should owner 可获取排行榜详情 DTO", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(mockBoard);
    prismaMock.boardItem.findMany.mockResolvedValueOnce([]);

    const res = await request(app.getHttpServer())
      .get("/boards/board_1")
      .set(authHeader());

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.id).toBe("board_1");
  });

  it("should 不存在返回 404", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .get("/boards/ghost")
      .set(authHeader());

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("PUT /boards/:id", () => {
  it("should 更新 meta 成功返回 DTO", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(mockBoard);
    prismaMock.boardItem.findMany.mockResolvedValueOnce([]);
    prismaMock.board.update.mockResolvedValueOnce(mockBoard);

    const res = await request(app.getHttpServer())
      .put("/boards/board_1")
      .set(authHeader())
      .send({ title: "新名字" });

    expect(res.status).toBe(HttpStatus.OK);
  });
});

describe("DELETE /boards/:id", () => {
  it("should 成功删除返回 204 No Content", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(mockBoard);
    prismaMock.board.delete.mockResolvedValueOnce(mockBoard);

    const res = await request(app.getHttpServer())
      .delete("/boards/board_1")
      .set(authHeader());

    expect(res.status).toBe(HttpStatus.NO_CONTENT);
  });
});

describe("PUT /boards/:id/content", () => {
  it("should 更新 TierState 成功返回 { success: true }", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(mockBoard);
    prismaMock.boardItem.findMany.mockResolvedValueOnce([]);

    const state = {
      tiers: [{ id: "S", label: "S", color: "#ef4444", imageIds: [] }],
      images: {},
      pool: [],
    };

    const res = await request(app.getHttpServer())
      .put("/boards/board_1/content")
      .set(authHeader())
      .send(state);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.success).toBe(true);
  });
});

describe("POST /boards/:id/share", () => {
  it("should 重新生成 shareId 返回新 shareId + visibility", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce({
      ...mockBoard,
      visibility: "private",
      shareId: null,
    });
    prismaMock.board.update.mockResolvedValueOnce({
      ...mockBoard,
      visibility: "unlisted",
      shareId: "abc123xy",
    });

    const res = await request(app.getHttpServer())
      .post("/boards/board_1/share")
      .set(authHeader());

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.shareId).toBe("abc123xy");
  });
});

describe("POST /boards/:id/images", () => {
  it("should 上传图片成功返回 { id }", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(mockBoard);
    prismaMock.boardItem.create.mockResolvedValueOnce({ id: "new_item_1" });

    const res = await request(app.getHttpServer())
      .post("/boards/board_1/images")
      .set(authHeader())
      .attach("file", Buffer.from("fake-png-bytes"), {
        filename: "test.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.id).toBe("new_item_1");
  });

  it("should 超过 10MB 返回 400", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(mockBoard);

    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);
    const res = await request(app.getHttpServer())
      .post("/boards/board_1/images")
      .set(authHeader())
      .attach("file", bigBuffer, {
        filename: "big.png",
        contentType: "image/png",
      });

    expect([HttpStatus.BAD_REQUEST, HttpStatus.PAYLOAD_TOO_LARGE]).toContain(
      res.status,
    );
  });
});

describe("DELETE /boards/:id/images/:imgId", () => {
  it("should 删除图片成功返回 204", async () => {
    prismaMock.board.findUnique.mockResolvedValueOnce(mockBoard);
    prismaMock.boardItem.delete.mockResolvedValueOnce({ id: "item_1" });

    const res = await request(app.getHttpServer())
      .delete("/boards/board_1/images/item_1")
      .set(authHeader());

    expect(res.status).toBe(HttpStatus.NO_CONTENT);
  });
});
