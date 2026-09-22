import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtPayload } from '@voltstar/types';
import { JwtError } from './jwt.util';
import { TokenService } from './token.service';

/**
 * Автентифікація «за наявності»: без заголовка — гість (req.user не задано),
 * з валідним Bearer-токеном — req.user; з невалідним — 401 (не мовчимо про протухлий токен).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers?: Record<string, string>; user?: JwtPayload }>();
    const header = req.headers?.authorization;
    if (!header) return true;
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException('Некоректний заголовок авторизації');
    try {
      req.user = this.tokens.verify(header.slice('Bearer '.length).trim());
    } catch (e) {
      throw new UnauthorizedException(e instanceof JwtError ? e.message : 'Невалідний токен');
    }
    return true;
  }
}
