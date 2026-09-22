import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtPayload } from '@voltstar/types';
import { JwtError } from './jwt.util';
import { TokenService } from './token.service';

const BEARER_PREFIX = 'Bearer ';

/** Вимагає валідний Bearer-токен; кладе claims у `req.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers?: Record<string, string>; user?: JwtPayload }>();
    const header = req.headers?.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException('Потрібна автентифікація');
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    try {
      req.user = this.tokens.verify(token);
    } catch (e) {
      throw new UnauthorizedException(e instanceof JwtError ? e.message : 'Невалідний токен');
    }
    return true;
  }
}
