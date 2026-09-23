import { Controller, Get, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { AuthService } from "../auth/auth.service";
import type { User } from "@prisma/client";

interface AuthRequest {
  user: User;
}

@Controller("auth")
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get("github")
  @UseGuards(AuthGuard("github"))
  githubLogin() {}

  @Get("github/callback")
  @UseGuards(AuthGuard("github"))
  async githubCallback(@Req() req: AuthRequest, @Res() res: Response) {
    const result = await this.authService.login(req.user);
    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    res.redirect(`${frontendUrl}/auth/callback?refresh=${result.refreshToken}`);
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleLogin() {}

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(@Req() req: AuthRequest, @Res() res: Response) {
    const result = await this.authService.login(req.user);
    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    res.redirect(`${frontendUrl}/auth/callback?refresh=${result.refreshToken}`);
  }
}
