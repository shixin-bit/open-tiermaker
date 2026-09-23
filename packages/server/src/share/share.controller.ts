import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ShareService } from "./share.service";

@Controller("share")
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get(":shareId")
  async getBoard(
    @Param("shareId") shareId: string,
    @Query("password") password?: string,
  ) {
    return this.shareService.findByShareId(shareId, password);
  }

  @Get(":shareId/images/:imgId")
  async getImage(
    @Param("shareId") shareId: string,
    @Param("imgId") imgId: string,
    @Res() res: Response,
  ) {
    const data = await this.shareService.getImage(shareId, imgId);
    res.setHeader("Content-Type", "image/png");
    res.send(data);
  }
}
