import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { OAuthController } from "./oauth.controller";
import { GithubStrategy } from "./strategies/github.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [ConfigModule, PassportModule, AuthModule],
  controllers: [OAuthController],
  providers: [GithubStrategy, GoogleStrategy],
})
export class OAuthModule {}
