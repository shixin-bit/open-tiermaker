import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { nanoid } from "nanoid";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import type { Board, Prisma } from "@prisma/client";
import type { TierState, Tier } from "@open-tiermaker/shared";
import { CreateBoardDto } from "./dto/create-board.dto";
import { UpdateBoardMetaDto } from "./dto/update-board-meta.dto";

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string) {
    return this.prisma.board.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        shareId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });
  }

  async create(userId: string, dto: CreateBoardDto): Promise<Board> {
    const defaultTiers: Tier[] = [
      { id: "S", label: "S", color: "#ef4444", imageIds: [] },
      { id: "A", label: "A", color: "#f97316", imageIds: [] },
      { id: "B", label: "B", color: "#eab308", imageIds: [] },
      { id: "C", label: "C", color: "#22c55e", imageIds: [] },
      { id: "D", label: "D", color: "#3b82f6", imageIds: [] },
    ];

    return this.prisma.board.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description ?? null,
        tierConfig: defaultTiers as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findOne(userId: string, boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) throw new NotFoundException("Board not found");
    if (board.userId !== userId) throw new ForbiddenException("Not authorized");

    return this.toDto(board);
  }

  async updateMeta(userId: string, boardId: string, dto: UpdateBoardMetaDto) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");
    if (board.userId !== userId) throw new ForbiddenException("Not authorized");

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;

    if (dto.visibility !== undefined) {
      data.visibility = dto.visibility;
      if (dto.visibility === "private") {
        data.shareId = null;
        data.sharePasswordHash = null;
      } else if (!board.shareId) {
        data.shareId = nanoid(8);
      }
    }

    if (dto.sharePassword !== undefined) {
      data.sharePasswordHash = dto.sharePassword
        ? await bcrypt.hash(dto.sharePassword, 10)
        : null;
    }

    const updated = await this.prisma.board.update({
      where: { id: boardId },
      data,
    });

    return this.toDto(updated);
  }

  async remove(userId: string, boardId: string): Promise<void> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");
    if (board.userId !== userId) throw new ForbiddenException("Not authorized");

    await this.prisma.board.delete({ where: { id: boardId } });
  }

  async regenerateShareId(userId: string, boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");
    if (board.userId !== userId) throw new ForbiddenException("Not authorized");

    const newShareId = nanoid(8);
    const updated = await this.prisma.board.update({
      where: { id: boardId },
      data: {
        shareId: newShareId,
        visibility:
          board.visibility === "private" ? "unlisted" : board.visibility,
      },
    });

    return { shareId: updated.shareId, visibility: updated.visibility };
  }

  async updateContent(userId: string, boardId: string, state: TierState) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");
    if (board.userId !== userId) throw new ForbiddenException("Not authorized");

    await this.prisma.$transaction(async (tx) => {
      await tx.boardItem.deleteMany({ where: { boardId } });

      const itemsToCreate: Array<{
        boardId: string;
        tierKey: string;
        position: number;
        title?: string;
        imageData?: Buffer;
        createdAt?: Date;
      }> = [];

      for (const tier of state.tiers) {
        tier.imageIds.forEach((imgId, pos) => {
          const img = state.images[imgId];
          if (img?.src) {
            const imageData =
              img.source === "local" && img.src.startsWith("data:")
                ? this.base64ToBuffer(img.src)
                : undefined;
            itemsToCreate.push({
              boardId,
              tierKey: tier.id,
              position: pos,
              title: img.id,
              imageData,
              createdAt: img.createdAt ? new Date(img.createdAt) : undefined,
            });
          }
        });
      }

      if (itemsToCreate.length > 0) {
        await tx.boardItem.createMany({
          data: itemsToCreate as unknown as Prisma.BoardItemCreateManyInput[],
        });
      }

      await tx.board.update({
        where: { id: boardId },
        data: { tierConfig: state.tiers as unknown as Prisma.InputJsonValue },
      });
    });

    return { success: true };
  }

  async getImage(userId: string | null, boardId: string, imageId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");

    const isOwner = userId !== null && board.userId === userId;
    if (!isOwner) {
      if (board.visibility === "private") {
        throw new ForbiddenException("Not authorized");
      }
    }

    const item = await this.prisma.boardItem.findFirst({
      where: { boardId, id: imageId },
    });
    if (!item?.imageData) throw new NotFoundException("Image not found");

    return item.imageData;
  }

  async deleteImage(userId: string, boardId: string, imageId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");
    if (board.userId !== userId) throw new ForbiddenException("Not authorized");

    await this.prisma.boardItem.delete({
      where: { id: imageId },
    });
    return { success: true };
  }

  async uploadImage(
    userId: string,
    boardId: string,
    file: Express.Multer.File,
  ) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");
    if (board.userId !== userId) throw new ForbiddenException("Not authorized");

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException("Image too large (max 10MB)");
    }

    const item = await this.prisma.boardItem.create({
      data: {
        boardId,
        tierKey: "__pool__",
        position: 0,
        imageData: file.buffer as unknown as Prisma.Bytes,
      },
    });

    return { id: item.id };
  }

  private async toDto(board: Board) {
    const items = await this.prisma.boardItem.findMany({
      where: { boardId: board.id },
      orderBy: [{ tierKey: "asc" }, { position: "asc" }],
    });

    const tiers = board.tierConfig as unknown as Tier[];
    const images: Record<
      string,
      { id: string; src: string; source: "local" | "url"; createdAt: number }
    > = {};

    for (const item of items) {
      const imgId = item.id;
      images[imgId] = {
        id: imgId,
        src: item.imageData ? `/api/boards/${board.id}/images/${imgId}` : "",
        source: "local",
        createdAt: item.createdAt.getTime(),
      };
    }

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      visibility: board.visibility,
      shareId: board.shareId,
      hasSharePassword: !!board.sharePasswordHash,
      tiers,
      items: items.map((i) => ({
        id: i.id,
        tierKey: i.tierKey,
        position: i.position,
        title: i.title,
        hasImage: !!i.imageData,
      })),
      images,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    };
  }

  private base64ToBuffer(base64: string): Buffer | undefined {
    try {
      const commaIdx = base64.indexOf(",");
      const data = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64;
      return Buffer.from(data, "base64");
    } catch {
      return undefined;
    }
  }
}
