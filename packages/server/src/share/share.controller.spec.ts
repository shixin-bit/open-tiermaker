import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import { HttpStatus, type INestApplication } from "@nestjs/common";
import { ShareController } from "./share.controller";
import { ShareService } from "./share.service";
import { PrismaService } from "../prisma/prisma.service";
import { createMockPrisma } from "../test-helpers";
import * as bcrypt from "bcrypt";

vi.mock("bcrypt", () => ({
  compare: vi.fn(),
}));

let app!: INestApplication;
let prismaMock: ReturnType<typeof createMockPrisma>;

const mockPublicBoard = {
  id: "board_1",
  title: "公开排行榜",
  description: "desc",
  shareId: "share_public",
  visibility: "public" as const,
  sharePasswordHash: null,
  tierConfig: [{ id: "S", label: "S", color: "#ef4444", imageIds: ["img_1"] }],
  userId: "user_123",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockItems = [
  {
    id: "item_1",
    tierKey: "S",
    position: 0,
    title: "img_1",
    imageData: Buffer.from("bytes"),
    boardId: "board_1",
    createdAt: new Date(),
  },
];

async function setup() {
  prismaMock = createMockPrisma();

  const module = await Test.createTestingModule({
    controllers: [ShareController],
    providers: [ShareService, { provide: PrismaService, useValue: prismaMock }],
  }).compile();

  app = module.createNestApplication();
  await app.init();
}

beforeEach(async () => {
  vi.clearAllMocks();
  await setup();
});

afterEach(async () => {
  if (app) await app.close();
});

describe("GET /share/:shareId", () => {
  it("should 匿名访问 public 排行榜成功返回数据", async () => {
    prismaMock.board.findFirst.mockResolvedValueOnce(mockPublicBoard);
    prismaMock.boardItem.findMany.mockResolvedValueOnce(mockItems);

    const res = await request(app.getHttpServer()).get("/share/share_public");

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.id).toBe("board_1");
    expect(res.body.title).toBe("公开排行榜");
    expect(res.body.tiers).toBeDefined();
    expect(res.body.items).toBeDefined();
  });

  it("should 排行榜不存在返回 404", async () => {
    prismaMock.board.findFirst.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer()).get("/share/ghost_id");

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("should private 排行榜对匿名隐藏（返回 404 不暴露存在性）", async () => {
    prismaMock.board.findFirst.mockResolvedValueOnce({
      ...mockPublicBoard,
      visibility: "private" as const,
    });

    const res = await request(app.getHttpServer()).get("/share/share_private");

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("should 有密码但未提供返回 401", async () => {
    prismaMock.board.findFirst.mockResolvedValueOnce({
      ...mockPublicBoard,
      sharePasswordHash: "$2b$10$abc",
    });

    const res = await request(app.getHttpServer()).get(
      "/share/share_protected",
    );

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("should 有密码且正确提供返回 200", async () => {
    prismaMock.board.findFirst.mockResolvedValueOnce({
      ...mockPublicBoard,
      sharePasswordHash: "$2b$10$abc",
    });
    prismaMock.boardItem.findMany.mockResolvedValueOnce(mockItems);
    vi.mocked(bcrypt.compare).mockImplementationOnce(() =>
      Promise.resolve(true),
    );

    const res = await request(app.getHttpServer())
      .get("/share/share_protected")
      .query({ password: "correct" });

    expect(res.status).toBe(HttpStatus.OK);
  });
});

describe("GET /share/:shareId/images/:imgId", () => {
  it("should 返回图片 Buffer + 正确 Content-Type", async () => {
    prismaMock.board.findFirst.mockResolvedValueOnce(mockPublicBoard);
    prismaMock.boardItem.findFirst.mockResolvedValueOnce(mockItems[0]);

    const res = await request(app.getHttpServer()).get(
      "/share/share_public/images/item_1",
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.header["content-type"]).toMatch(/image/);
  });

  it("should 图片不存在返回 404", async () => {
    prismaMock.board.findFirst.mockResolvedValueOnce(mockPublicBoard);
    prismaMock.boardItem.findFirst.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer()).get(
      "/share/share_public/images/ghost",
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});
