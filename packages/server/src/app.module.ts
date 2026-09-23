import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { OAuthModule } from "./oauth/oauth.module";
import { BoardModule } from "./board/board.module";
import { ShareModule } from "./share/share.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    OAuthModule,
    BoardModule,
    ShareModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
