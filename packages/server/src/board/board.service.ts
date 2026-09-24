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

    // 保存前先查出已存在的 items，以便对已上传的图片（URL src）保留其 imageData。
    // 第一次保存后 item.id 会变（deleteMany + createMany），但 title 始终存前端 img.id，
    // 所以优先按 title 查；首次上传（title 为 null）时回退到按 id 查。
    const existingItems = await this.prisma.boardItem.findMany({
      where: { boardId },
    });
    const existingByTitle = new Map(
      existingItems.filter((i) => i.title).map((i) => [i.title!, i]),
    );
    const existingById = new Map(existingItems.map((i) => [i.id, i]));

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
            let imageData: Buffer | undefined;
            if (img.source === "local" && img.src.startsWith("data:")) {
              // 新上传的本地图片（data URL），转成 Buffer 存储
              imageData = this.base64ToBuffer(img.src);
            } else {
              // URL src：图片此前已上传并存储，从已存在 item 中保留 imageData
              const existing =
                existingByTitle.get(img.id) ?? existingById.get(img.id);
              imageData =
                (existing?.imageData as Buffer | undefined) ?? undefined;
            }
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

      // 保存图片池中的图片（tierKey = "__pool__"）
      state.pool.forEach((imgId, pos) => {
        const img = state.images[imgId];
        if (img?.src) {
          let imageData: Buffer | undefined;
          if (img.source === "local" && img.src.startsWith("data:")) {
            imageData = this.base64ToBuffer(img.src);
          } else {
            const existing =
              existingByTitle.get(img.id) ?? existingById.get(img.id);
            imageData =
              (existing?.imageData as Buffer | undefined) ?? undefined;
          }
          itemsToCreate.push({
            boardId,
            tierKey: "__pool__",
            position: pos,
            title: img.id,
            imageData,
            createdAt: img.createdAt ? new Date(img.createdAt) : undefined,
          });
        }
      });

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

  async getImage(_userId: string | null, boardId: string, imageId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException("Board not found");

    // 图片资源不做鉴权：知道 boardId + imgId 即可访问（imgId 为 cuid 难以猜测）。
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
      // 用 title（前端图片 ID）作为 images map 的 key，与 tierConfig.imageIds 对齐。
      // title 为 null 时（uploadImage 创建的未保存图片）回退到 item.id。
      const imgId = item.title || item.id;
      images[imgId] = {
        id: imgId,
        src: item.imageData ? `/api/boards/${board.id}/images/${item.id}` : "",
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
