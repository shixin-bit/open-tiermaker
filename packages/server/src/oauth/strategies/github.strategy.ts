import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy, Profile } from "passport-github2";
import { AuthService } from "../../auth/auth.service";

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>("GITHUB_CLIENT_ID")!,
      clientSecret: config.get<string>("GITHUB_CLIENT_SECRET")!,
      callbackURL: config.get<string>("GITHUB_CALLBACK_URL")!,
      scope: ["user:email", "read:user"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException("GitHub 账号未提供邮箱，无法完成登录");
    }

    return this.authService.findOrCreateOauthUser({
      provider: "github",
      providerAccountId: profile.id,
      email,
      username: profile.username,
      avatarUrl: profile.photos?.[0]?.value,
    });
  }
}
