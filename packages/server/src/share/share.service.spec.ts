import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";

vi.mock("../prisma/prisma.service", () => ({ PrismaService: vi.fn() }));
vi.mock("bcrypt", () => ({ compare: vi.fn() }));

import { ShareService } from "./share.service";
import { PrismaService } from "../prisma/prisma.service";
import { compare } from "bcrypt";

const mockBoard = {
  id: "board_1",
  title: "分享的排行榜",
  description: "desc",
  shareId: "share_public",
  visibility: "public" as const,
  sharePasswordHash: null,
  tierConfig: [
    { id: "S", label: "S", color: "#ef4444", imageIds: ["img_1"] },
    { id: "A", label: "A", color: "#f97316", imageIds: [] },
  ],
  userId: "user_123",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const privateBoard = {
  ...mockBoard,
  visibility: "private" as const,
  shareId: "share_private",
};
const protectedBoard = {
  ...mockBoard,
  visibility: "unlisted" as const,
  sharePasswordHash: "$2b$10$abc",
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

function createService() {
  const prisma = {
    board: { findFirst: vi.fn() },
    boardItem: { findMany: vi.fn(), findFirst: vi.fn() },
  };
  vi.mocked(PrismaService).mockImplementation(() => prisma);
  const service = new ShareService(
    prisma as unknown as InstanceType<typeof PrismaService>,
  );
  return { service, prisma };
}

beforeEach(() => vi.clearAllMocks());

describe("[ShareService] findByShareId", () => {
  it("should public 排行榜匿名访问成功", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce(mockItems);

    const result = await service.findByShareId("share_public");

    expect(result.id).toBe("board_1");
    expect(result.title).toBe("分享的排行榜");
    expect(result.tiers).toEqual(mockBoard.tierConfig);
    expect(result.items).toHaveLength(1);
  });

  it("should private 排行榜对外返回 NotFound（隐藏存在性）", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(privateBoard);

    await expect(service.findByShareId("share_private")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should 排行榜不存在抛 NotFoundException", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(null);

    await expect(service.findByShareId("ghost_id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should 有密码保护但未提供密码抛 Unauthorized", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(protectedBoard);

    await expect(service.findByShareId("share_protected")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should 密码错误抛 Unauthorized", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(protectedBoard);
    vi.mocked(compare).mockResolvedValueOnce(false);

    await expect(
      service.findByShareId("share_protected", "wrong"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should 密码正确返回完整数据", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(protectedBoard);
    prisma.boardItem.findMany.mockResolvedValueOnce(mockItems);
    vi.mocked(compare).mockResolvedValueOnce(true);

    const result = await service.findByShareId("share_protected", "correct");

    expect(vi.mocked(compare)).toHaveBeenCalledWith("correct", "$2b$10$abc");
    expect(result.items).toHaveLength(1);
  });
});

describe("[ShareService] getImage", () => {
  it("should 成功返回图片 Buffer", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findFirst.mockResolvedValueOnce(mockItems[0]);

    const result = await service.getImage("share_public", "item_1");

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe("bytes");
  });

  it("should shareId 找不到对应 board 抛 NotFound", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(null);

    await expect(service.getImage("ghost", "item")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should 图片不存在抛 NotFound", async () => {
    const { service, prisma } = createService();
    prisma.board.findFirst.mockResolvedValueOnce(mockBoard);
    prisma.boardItem.findFirst.mockResolvedValueOnce(null);

    await expect(service.getImage("share_public", "ghost_img")).rejects.toThrow(
      NotFoundException,
    );
  });
});
