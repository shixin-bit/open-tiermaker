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

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      visibility: board.visibility,
      shareId: board.shareId,
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
