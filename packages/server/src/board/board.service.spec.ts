import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

vi.mock("../prisma/prisma.service", () => ({ PrismaService: vi.fn() }));
vi.mock("@nestjs/config", () => ({ ConfigService: vi.fn() }));
vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "abc123xy") }));
vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("hashed_pw"),
  compare: vi.fn(),
}));

import { BoardService } from "./board.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type { TierState } from "@open-tiermaker/shared";
import type { Readable } from "node:stream";

const mockBoard = {
  id: "board_1",
  title: "我的 S 排名",
  description: "一些描述",
  shareId: "share_abc123",
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

const mockItem = {
  id: "item_1",
  boardId: "board_1",
  tierKey: "S",
  position: 0,
  title: "img_1",
  imageData: Buffer.from("fake-bytes"),
  createdAt: new Date(),
};

function createService() {
  const prisma = {
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
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async <T>(fn: (tx: unknown) => Promise<T>) => {
      const tx = {
        boardItem: { deleteMany: vi.fn(), createMany: vi.fn() },
        board: { update: vi.fn() },
      };
      // 暴露 tx 给测试断言使用
      (prisma as unknown as { _lastTx: typeof tx })._lastTx = tx;
      return fn(tx);
    }),
  };
  const config = { get: vi.fn() };

  vi.mocked(PrismaService).mockImplementation(() => prisma);
  vi.mocked(ConfigService).mockImplementation(() => config);

  const service = new BoardService(
    prisma as unknown as InstanceType<typeof PrismaService>,
    config as unknown as InstanceType<typeof ConfigService>,
  );
  return { service, prisma, config };
}

beforeEach(() => vi.clearAllMocks());

describe("[BoardService] create", () => {
  it("should 创建排行榜并设置默认 5 个 tier", async () => {
    const { service, prisma } = createService();
    prisma.board.create.mockResolvedValueOnce(mockBoard);

    const result = await service.create("user_123", { title: "我的 S 排名" });

    expect(prisma.board.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_123",
          title: "我的 S 排名",
          tierConfig: expect.arrayContaining([
            expect.objectContaining({ id: "S" }),
            expect.objectContaining({ id: "A" }),
            expect.objectContaining({ id: "B" }),
            expect.objectContaining({ id: "C" }),
            expect.objectContaining({ id: "D" }),
          ]),
        }),
      }),
    );
    expect(result.id).toBe("board_1");
  });

  it("should description 缺省存 null", async () => {
    const { service, prisma } = createService();
    prisma.board.create.mockResolvedValueOnce(mockBoard);

    await service.create("u", { title: "t" });

    expect(prisma.board.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: null }),
      }),
    );
  });
});

describe("[BoardService] list", () => {
  it("should 返回用户排行榜列表，按 updatedAt 倒序", async () => {
    const { service, prisma } = createService();
    const list = [
      {
        id: "b1",
        title: "a",
        visibility: "private",
        shareId: null,
        _count: { items: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    prisma.board.findMany.mockResolvedValueOnce(list);

    const result = await service.list("user_123");

    expect(prisma.board.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_123" },
        orderBy: { updatedAt: "desc" },
      }),
    );
    expect(result).toHaveLength(1);
  });
});

describe("[BoardService] findOne", () => {
  it("should owner 可查，返回含 items/images 的 DTO，images 以 title 为 key", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([mockItem]);

    const result = await service.findOne("user_123", "board_1");

    expect(result.id).toBe("board_1");
    expect(prisma.boardItem.findMany).toHaveBeenCalled();
    // images map key 应为 item.title（前端图片 ID），而非 item.id
    expect(result.images["img_1"]).toBeDefined();
    expect(result.images["img_1"].src).toBe(
      "/api/boards/board_1/images/item_1",
    );
  });

  it("should 非 owner 抛 ForbiddenException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(service.findOne("other", "board_1")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("should 不存在抛 NotFoundException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne("u", "ghost")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("[BoardService] updateMeta", () => {
  it("should 更新 title/description 成功", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);
    prisma.board.update.mockResolvedValueOnce(mockBoard);

    await service.updateMeta("user_123", "board_1", { title: "新名字" });

    expect(prisma.board.update).toHaveBeenCalledWith({
      where: { id: "board_1" },
      data: { title: "新名字" },
    });
  });

  it("should 改成 private 时清 shareId 和密码", async () => {
    const { service, prisma } = createService();
    const publicBoard = {
      ...mockBoard,
      visibility: "unlisted" as const,
      shareId: "share_abc",
    };
    prisma.board.findUnique.mockResolvedValueOnce(publicBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);
    prisma.board.update.mockResolvedValueOnce({
      ...publicBoard,
      visibility: "private",
    });

    await service.updateMeta("user_123", "board_1", { visibility: "private" });

    expect(prisma.board.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: "private",
          shareId: null,
          sharePasswordHash: null,
        }),
      }),
    );
  });

  it("should 改成 public/unlisted 且无 shareId 时自动生成", async () => {
    const { service, prisma } = createService();
    const privateBoard = {
      ...mockBoard,
      visibility: "private" as const,
      shareId: null,
    };
    prisma.board.findUnique.mockResolvedValueOnce(privateBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);
    prisma.board.update.mockResolvedValueOnce({
      ...privateBoard,
      visibility: "public",
      shareId: "abc123xy",
    });

    await service.updateMeta("user_123", "board_1", { visibility: "public" });

    expect(prisma.board.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shareId: "abc123xy" }),
      }),
    );
  });

  it("should 设置分享密码时 bcrypt hash", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);
    prisma.board.update.mockResolvedValueOnce(mockBoard);

    await service.updateMeta("user_123", "board_1", {
      sharePassword: "secret123",
    });

    expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 10);
    expect(prisma.board.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sharePasswordHash: "hashed_pw" }),
      }),
    );
  });

  it("should 清空分享密码时设 null", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);
    prisma.board.update.mockResolvedValueOnce(mockBoard);

    await service.updateMeta("user_123", "board_1", { sharePassword: "" });

    expect(prisma.board.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sharePasswordHash: null }),
      }),
    );
  });

  it("should 非 owner 抛 ForbiddenException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(
      service.updateMeta("other", "board_1", { title: "x" }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe("[BoardService] remove", () => {
  it("should owner 可删除", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.board.delete.mockResolvedValueOnce(mockBoard);

    await expect(
      service.remove("user_123", "board_1"),
    ).resolves.toBeUndefined();
    expect(prisma.board.delete).toHaveBeenCalledWith({
      where: { id: "board_1" },
    });
  });

  it("should 非 owner 抛 ForbiddenException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(service.remove("other", "board_1")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("should 不存在抛 NotFoundException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(null);

    await expect(service.remove("u", "ghost")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("[BoardService] regenerateShareId", () => {
  it("should 重新生成 shareId，private 自动转 unlisted", async () => {
    const { service, prisma } = createService();
    const privateBoard = {
      ...mockBoard,
      visibility: "private" as const,
      shareId: null,
    };
    prisma.board.findUnique.mockResolvedValueOnce(privateBoard);
    prisma.board.update.mockResolvedValueOnce({
      ...privateBoard,
      visibility: "unlisted",
      shareId: "abc123xy",
    });

    const result = await service.regenerateShareId("user_123", "board_1");

    expect(prisma.board.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shareId: "abc123xy" }),
      }),
    );
    expect(result.shareId).toBe("abc123xy");
    expect(result.visibility).toBe("unlisted");
  });

  it("should 非 owner 抛 ForbiddenException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(service.regenerateShareId("other", "board_1")).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe("[BoardService] updateContent", () => {
  const state: TierState = {
    tiers: [
      { id: "S", label: "S", color: "#ef4444", imageIds: ["img_1"] },
      { id: "A", label: "A", color: "#f97316", imageIds: [] },
    ],
    images: {
      img_1: {
        id: "img_1",
        src: "data:image/png;base64,iVBORw0KGgo=",
        source: "local" as const,
        createdAt: 1700000000000,
      },
    },
    pool: [],
  };

  it("should 事务全量更新：删旧 items → 写新 items → 更新 tierConfig", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);

    const result = await service.updateContent("user_123", "board_1", state);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("should data URL 图片转 Buffer 写入 imageData", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);

    await service.updateContent("user_123", "board_1", state);

    const tx = (
      prisma as unknown as {
        _lastTx: { boardItem: { createMany: ReturnType<typeof vi.fn> } };
      }
    )._lastTx;
    expect(tx.boardItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: "img_1",
            imageData: expect.any(Buffer),
          }),
        ]),
      }),
    );
  });

  it("should URL src 图片保留已存在 item 的 imageData", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    // 已存在的 item，imageData 应被保留
    prisma.boardItem.findMany.mockResolvedValueOnce([
      { id: "img_1", imageData: Buffer.from("preserved-bytes") },
    ]);

    const urlState: TierState = {
      tiers: [{ id: "S", label: "S", color: "#ef4444", imageIds: ["img_1"] }],
      images: {
        img_1: {
          id: "img_1",
          src: "/api/boards/board_1/images/img_1",
          source: "local" as const,
          createdAt: 1700000000000,
        },
      },
      pool: [],
    };

    await service.updateContent("user_123", "board_1", urlState);

    const tx = (
      prisma as unknown as {
        _lastTx: { boardItem: { createMany: ReturnType<typeof vi.fn> } };
      }
    )._lastTx;
    expect(tx.boardItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: "img_1",
            imageData: Buffer.from("preserved-bytes"),
          }),
        ]),
      }),
    );
  });

  it("should 图片池中的图片以 tierKey=__pool__ 保存", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce([]);

    const poolState: TierState = {
      tiers: [{ id: "S", label: "S", color: "#ef4444", imageIds: [] }],
      images: {
        pool_img: {
          id: "pool_img",
          src: "data:image/png;base64,iVBORw0KGgo=",
          source: "local" as const,
          createdAt: 1700000000000,
        },
      },
      pool: ["pool_img"],
    };

    await service.updateContent("user_123", "board_1", poolState);

    const tx = (
      prisma as unknown as {
        _lastTx: { boardItem: { createMany: ReturnType<typeof vi.fn> } };
      }
    )._lastTx;
    expect(tx.boardItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            tierKey: "__pool__",
            title: "pool_img",
            imageData: expect.any(Buffer),
          }),
        ]),
      }),
    );
  });

  it("should 第二次保存时通过 title 查到已有 item 并保留 imageData（即使 id 已变）", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    // 模拟第一次保存后的状态：item.id 已变，但 title 保存了前端 img.id
    prisma.boardItem.findMany.mockResolvedValueOnce([
      {
        id: "new_db_id_after_first_save",
        title: "img_1",
        imageData: Buffer.from("preserved-data"),
        tierKey: "S",
        position: 0,
        createdAt: new Date(),
      },
    ]);

    // 前端 state 中 img.id 仍为 "img_1"（与 title 一致），src 指向新 DB id
    const secondSaveState: TierState = {
      tiers: [{ id: "S", label: "S", color: "#ef4444", imageIds: ["img_1"] }],
      images: {
        img_1: {
          id: "img_1",
          src: "/api/boards/board_1/images/new_db_id_after_first_save",
          source: "local" as const,
          createdAt: 1700000000000,
        },
      },
      pool: [],
    };

    await service.updateContent("user_123", "board_1", secondSaveState);

    const tx = (
      prisma as unknown as {
        _lastTx: { boardItem: { createMany: ReturnType<typeof vi.fn> } };
      }
    )._lastTx;
    expect(tx.boardItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: "img_1",
            imageData: Buffer.from("preserved-data"),
          }),
        ]),
      }),
    );
  });

  it("should 非 owner 抛 ForbiddenException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(
      service.updateContent("other", "board_1", state),
    ).rejects.toThrow(ForbiddenException);
  });

  it("should 不存在抛 NotFoundException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(null);

    await expect(service.updateContent("u", "ghost", state)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("[BoardService] uploadImage", () => {
  const createFile = (
    size: number,
    mimetype = "image/png",
  ): Express.Multer.File => ({
    originalname: "test.png",
    mimetype,
    buffer: Buffer.alloc(size),
    size,
    fieldname: "file",
    encoding: "7bit",
    stream: null as unknown as Readable,
    destination: "",
    filename: "",
    path: "",
  });

  it("should owner 上传成功返回 { id }", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    const created = { ...mockItem, id: "new_item_1" };
    prisma.boardItem.create.mockResolvedValueOnce(created);

    const result = await service.uploadImage(
      "user_123",
      "board_1",
      createFile(1024),
    );

    expect(prisma.boardItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          boardId: "board_1",
          tierKey: "__pool__",
          imageData: expect.any(Buffer),
        }),
      }),
    );
    expect(result).toEqual({ id: "new_item_1" });
  });

  it("should 超过 10MB 抛 BadRequestException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(
      service.uploadImage("user_123", "board_1", createFile(11 * 1024 * 1024)),
    ).rejects.toThrow(BadRequestException);
  });

  it("should 非 owner 抛 ForbiddenException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(
      service.uploadImage("other", "board_1", createFile(1024)),
    ).rejects.toThrow(ForbiddenException);
  });

  it("should 不存在抛 NotFoundException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.uploadImage("u", "ghost", createFile(1024)),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("[BoardService] getImage", () => {
  it("should owner 获取图片 Buffer", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findFirst.mockResolvedValueOnce(mockItem);

    const result = await service.getImage("user_123", "board_1", "item_1");

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe("fake-bytes");
  });

  it("should 图片不存在抛 NotFoundException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getImage("user_123", "board_1", "ghost"),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("[BoardService] deleteImage", () => {
  it("should owner 删除成功", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.delete.mockResolvedValueOnce(mockItem);

    await expect(
      service.deleteImage("user_123", "board_1", "item_1"),
    ).resolves.toEqual({ success: true });
    expect(prisma.boardItem.delete).toHaveBeenCalledWith({
      where: { id: "item_1" },
    });
  });

  it("should 非 owner 抛 ForbiddenException", async () => {
    const { service, prisma } = createService();
    prisma.board.findUnique.mockResolvedValueOnce(mockBoard);

    await expect(
      service.deleteImage("other", "board_1", "item"),
    ).rejects.toThrow(ForbiddenException);
  });
});
