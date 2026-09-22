import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { TokenService } from './token.service';

const config = { get: (k: string) => (k === 'JWT_SECRET' ? 'test-secret' : undefined) } as unknown as ConfigService;
const tokens = new TokenService(config);
const guard = new OptionalJwtAuthGuard(tokens);

function ctx(authorization?: string) {
  const req: { headers: Record<string, string>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { req, context };
}

describe('OptionalJwtAuthGuard', () => {
  it('без заголовка — гість (req.user не задано)', () => {
    const { req, context } = ctx();
    expect(guard.canActivate(context)).toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('валідний токен — кладе claims у req.user', () => {
    const token = tokens.sign({ sub: 'u1', email: 'a@b.ua', role: 'CUSTOMER', segment: 'B2B', orgId: 'org1' });
    const { req, context } = ctx(`Bearer ${token}`);
    expect(guard.canActivate(context)).toBe(true);
    expect(req.user).toMatchObject({ sub: 'u1', segment: 'B2B', orgId: 'org1' });
  });

  it('невалідний токен — 401, а не тихий гостьовий режим', () => {
    expect(() => guard.canActivate(ctx('Bearer broken').context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx('Basic abc').context)).toThrow(UnauthorizedException);
  });
});
