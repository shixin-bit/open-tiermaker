import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  override handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | null,
  ): TUser | null {
    return user;
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const result = super.canActivate(context);
    if (result instanceof Observable) {
      return new Observable((subscriber) => {
        result.subscribe({
          next: (v) => subscriber.next(v),
          error: () => subscriber.next(true),
          complete: () => subscriber.complete(),
        });
      });
    }
    if (result instanceof Promise) {
      return result.catch(() => true);
    }
    return result;
  }
}
