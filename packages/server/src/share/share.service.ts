import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  async findByShareId(shareId: string, password?: string) {
    const board = await this.prisma.board.findFirst({
      where: { shareId },
    });

    if (!board) throw new NotFoundException("Board not found");
    if (board.visibility === "private")
      throw new NotFoundException("Board not found");

    if (board.sharePasswordHash) {
      if (!password) throw new UnauthorizedException("Password required");
      const valid = await bcrypt.compare(password, board.sharePasswordHash);
      if (!valid) throw new UnauthorizedException("Invalid password");
    }

    const items = await this.prisma.boardItem.findMany({
      where: { boardId: board.id },
      orderBy: [{ tierKey: "asc" }, { position: "asc" }],
    });

    const images: Record<
      string,
      { id: string; src: string; source: "local"; createdAt: number }
    > = {};
    for (const i of items) {
      // 用 title（前端图片 ID）作为 key，与 tierConfig.imageIds 对齐；
      // src 用 item.id（DB id）构造，与 getImage 的查询一致。
      const imgId = i.title || i.id;
      images[imgId] = {
        id: imgId,
        src: i.imageData ? `/api/share/${shareId}/images/${i.id}` : "",
        source: "local",
        createdAt: i.createdAt.getTime(),
      };
    }

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      visibility: board.visibility,
      shareId: board.shareId,
      hasSharePassword: !!board.sharePasswordHash,
      sharedBy: board.userId,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      tiers: board.tierConfig,
      items: items.map((i) => ({
        id: i.id,
        tierKey: i.tierKey,
        position: i.position,
        title: i.title,
        hasImage: !!i.imageData,
      })),
      images,
    };
  }

  async getImage(shareId: string, imageId: string): Promise<Buffer> {
    const board = await this.prisma.board.findFirst({
      where: { shareId },
    });
    if (!board) throw new NotFoundException("Board not found");

    const item = await this.prisma.boardItem.findFirst({
      where: { id: imageId, boardId: board.id },
    });
    if (!item?.imageData) throw new NotFoundException("Image not found");

    return Buffer.from(item.imageData);
  }
}
