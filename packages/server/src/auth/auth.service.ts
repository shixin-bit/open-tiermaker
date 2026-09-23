import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import type { User } from "@prisma/client";

export interface TokenPayload {
  userId: string;
  tokenId: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string | null;
    avatarUrl: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(
    email: string,
    password: string,
    username?: string,
  ): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        username: username ?? null,
        passwordHash,
      },
    });

    return this.generateAuthResult(user);
  }

  async validateLocal(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  async login(user: User): Promise<AuthResult> {
    return this.generateAuthResult(user);
  }

  async validateAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      return this.jwt.verify<TokenPayload>(token);
    } catch {
      return null;
    }
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = this.jwt.verify<TokenPayload>(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });

      const stored = await this.redis.get(`refresh:${payload.tokenId}`);
      if (!stored) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      await this.redis.del(`refresh:${payload.tokenId}`);

      return this.generateAuthResult(user);
    } catch (err) {
      this.logger.warn(
        "Refresh token error:",
        err instanceof Error ? err.message : err,
      );
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwt.verify<TokenPayload>(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
      await this.redis.del(`refresh:${payload.tokenId}`);
      await this.redis.set(
        `refresh:blacklist:${payload.tokenId}`,
        "1",
        7 * 24 * 3600,
      );
    } catch {
      // token already expired or invalid — just return success
    }
  }

  async findOrCreateOauthUser(params: {
    provider: string;
    providerAccountId: string;
    email: string;
    username?: string;
    avatarUrl?: string;
  }): Promise<User> {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: params.provider,
          providerAccountId: params.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (account) {
      if (params.avatarUrl && account.user.avatarUrl !== params.avatarUrl) {
        const updated = await this.prisma.user.update({
          where: { id: account.userId },
          data: { avatarUrl: params.avatarUrl },
        });
        return updated;
      }
      return account.user;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: params.email },
    });

    if (existingUser) {
      await this.prisma.account.create({
        data: {
          provider: params.provider,
          providerAccountId: params.providerAccountId,
          userId: existingUser.id,
        },
      });
      return existingUser;
    }

    return this.prisma.user.create({
      data: {
        email: params.email,
        username: params.username ?? null,
        avatarUrl: params.avatarUrl ?? null,
        accounts: {
          create: {
            provider: params.provider,
            providerAccountId: params.providerAccountId,
          },
        },
      },
    });
  }

  private async generateAuthResult(user: User): Promise<AuthResult> {
    const accessToken = await this.generateAccessToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private async generateAccessToken(userId: string): Promise<string> {
    const tokenId = nanoid(16);
    return this.jwt.sign(
      { userId, tokenId },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
      },
    );
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = nanoid(16);
    const expiresIn = this.parseExpiry(
      this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
    );

    await this.redis.set(`refresh:${tokenId}`, userId, expiresIn);

    return this.jwt.sign(
      { userId, tokenId },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
      },
    );
  }

  private parseExpiry(input: string): number {
    const match = input.match(/^(\d+)([smhdw])$/);
    if (!match) return 7 * 24 * 3600;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 24 * 3600;
      case "w":
        return value * 7 * 24 * 3600;
      default:
        return 7 * 24 * 3600;
    }
  }
}
