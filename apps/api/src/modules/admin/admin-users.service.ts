import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminOrganization, AdminUser, Page, Role } from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';

const userInclude = {
  organization: { select: { id: true, name: true, edrpou: true, verified: true } },
  _count: { select: { orders: true } },
} satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

/** Користувачі й організації для адміністратора: пошук, ролі, черга верифікації. */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: { q?: string; role?: Role; page: number; perPage: number }): Promise<Page<AdminUser>> {
    const where: Prisma.UserWhereInput = {
      role: q.role,
      ...(q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: 'insensitive' } },
              { firstName: { contains: q.q, mode: 'insensitive' } },
              { lastName: { contains: q.q, mode: 'insensitive' } },
              { phone: { contains: q.q } },
              { organization: { name: { contains: q.q, mode: 'insensitive' } } },
              { organization: { edrpou: { startsWith: q.q } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toAdminUser), total, page: q.page, perPage: q.perPage };
  }

  /**
   * Зміна ролі. Адмін не може змінити роль самому собі (щоб не залишити систему без адміна
   * випадковим кліком), і не можна прибрати останнього адміністратора.
   * Нова роль діє з наступного входу користувача (роль зашита в JWT).
   */
  async setRole(userId: string, role: Exclude<Role, 'GUEST'>, actorId: string): Promise<AdminUser> {
    if (userId === actorId) throw new BadRequestException('Не можна змінити власну роль');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw new BadRequestException('Не можна прибрати останнього адміністратора');
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role }, include: userInclude });
    return toAdminUser(updated);
  }

  async organizations(q: { verified?: boolean; q?: string; page: number; perPage: number }): Promise<Page<AdminOrganization>> {
    const where: Prisma.OrganizationWhereInput = {
      verified: q.verified,
      type: { not: 'INDIVIDUAL' },
      ...(q.q
        ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { edrpou: { startsWith: q.q } }] }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        include: { users: { select: { id: true, email: true }, take: 5 } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.prisma.organization.count({ where }),
    ]);
    return {
      items: rows.map((o) => ({
        id: o.id,
        name: o.name,
        type: o.type,
        segment: o.segment,
        edrpou: o.edrpou,
        verified: o.verified,
        users: o.users,
        createdAt: o.createdAt.toISOString(),
      })),
      total,
      page: q.page,
      perPage: q.perPage,
    };
  }
}

function toAdminUser(u: UserRow): AdminUser {
  return {
    id: u.id,
    email: u.email,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
    phone: u.phone,
    role: u.role,
    organization: u.organization,
    ordersCount: u._count.orders,
    createdAt: u.createdAt.toISOString(),
  };
}
