import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '@voltstar/types';
import { signJwt, verifyJwt } from './jwt.util';

const DEFAULT_SECRET = 'change_me_in_production';
const DEFAULT_TTL_SEC = 900; // 15 хв

/** Парсить тривалість "15m"/"2h"/"7d"/"30s"/"3600" у секунди. */
export function parseDuration(value: string, fallbackSec: number): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallbackSec;
  }
  const n = Number(match[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 1;
  return n * mult;
}

/** Випуск і перевірка access-токенів (HS256) на основі конфіга. */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly secret: string;
  readonly expiresInSec: number;

  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET') ?? DEFAULT_SECRET;
    if (secret === DEFAULT_SECRET) {
      this.logger.warn('JWT_SECRET не задано — використовується небезпечний дефолт (лише для dev).');
    }
    this.secret = secret;
    this.expiresInSec = parseDuration(config.get<string>('JWT_EXPIRES_IN') ?? '15m', DEFAULT_TTL_SEC);
  }

  /** Підписує токен для користувача. */
  sign(payload: JwtPayload): string {
    return signJwt({ ...payload }, { secret: this.secret, expiresInSec: this.expiresInSec });
  }

  /** Перевіряє токен і повертає його claims. Кидає JwtError за некоректності. */
  verify(token: string): JwtPayload {
    return verifyJwt(token, this.secret) as unknown as JwtPayload;
  }
}
