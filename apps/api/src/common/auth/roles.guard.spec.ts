import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtPayload, Role } from '@voltstar/types';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './roles.guard';

function makeContext(user?: Partial<JwtPayload>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeReflector(required: Role[] | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}

const admin: Partial<JwtPayload> = { sub: 'a', role: 'ADMIN', segment: 'B2C', email: 'a@a' };
const customer: Partial<JwtPayload> = { sub: 'c', role: 'CUSTOMER', segment: 'B2C', email: 'c@c' };

describe('RolesGuard', () => {
  it('пропускає, коли ролі не задані', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    expect(guard.canActivate(makeContext(customer))).toBe(true);
  });

  it('пропускає користувача з потрібною роллю', () => {
    const guard = new RolesGuard(makeReflector(['MANAGER', 'ADMIN']));
    expect(guard.canActivate(makeContext(admin))).toBe(true);
  });

  it('блокує користувача без потрібної ролі', () => {
    const guard = new RolesGuard(makeReflector(['MANAGER', 'ADMIN']));
    expect(() => guard.canActivate(makeContext(customer))).toThrow(ForbiddenException);
  });

  it('блокує неавтентифікованого користувача', () => {
    const guard = new RolesGuard(makeReflector(['ADMIN']));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
