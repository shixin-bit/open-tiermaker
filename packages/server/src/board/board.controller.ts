import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BoardService } from "./board.service";
import { CreateBoardDto } from "./dto/create-board.dto";
import { UpdateBoardMetaDto } from "./dto/update-board-meta.dto";
import type { TierState } from "@open-tiermaker/shared";

interface AuthedRequest {
  user: {
    id: string;
    email: string;
    username: string | null;
    avatarUrl: string | null;
  };
}

@Controller("boards")
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: AuthedRequest) {
    return this.boardService.list(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: AuthedRequest, @Body() dto: CreateBoardDto) {
    return this.boardService.create(req.user.id, dto);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.boardService.findOne(req.user.id, id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async updateMeta(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateBoardMetaDto,
  ) {
    return this.boardService.updateMeta(req.user.id, id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    await this.boardService.remove(req.user.id, id);
  }

  @Put(":id/content")
  @UseGuards(JwtAuthGuard)
  async updateContent(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: TierState,
  ) {
    return this.boardService.updateContent(req.user.id, id, body);
  }

  @Post(":id/share")
  @UseGuards(JwtAuthGuard)
  async regenerateShare(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.boardService.regenerateShareId(req.user.id, id);
  }

  @Post(":id/images")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error("Invalid file type"), false);
      },
    }),
  )
  async uploadImage(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.boardService.uploadImage(req.user.id, id, file);
  }

  @Get(":id/images/:imgId")
  async getImage(
    @Param("id") id: string,
    @Param("imgId") imgId: string,
    @Res() res: Response,
  ) {
    const data = await this.boardService.getImage(null, id, imgId);
    res.setHeader("Content-Type", "image/png");
    res.send(data);
  }

  @Delete(":id/images/:imgId")
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteImage(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Param("imgId") imgId: string,
  ) {
    await this.boardService.deleteImage(req.user.id, id, imgId);
  }
}
