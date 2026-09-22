import type { JwtPayload, Segment } from '@voltstar/types';

/** Хто купує: гість (B2C) або автентифікований користувач зі своїм сегментом. */
export interface BuyerContext {
  userId?: string;
  segment: Segment;
  orgId?: string | null;
}

export function buyerFrom(user?: JwtPayload): BuyerContext {
  if (!user) return { segment: 'B2C' };
  return { userId: user.sub, segment: user.segment, orgId: user.orgId ?? null };
}
