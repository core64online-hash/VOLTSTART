import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { verifyPassword } from '../../common/auth/password.util';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../crm/crm-rules';

/** Домен для анонімізованих адрес (RFC 2606 — гарантовано не існує). */
export const DELETED_EMAIL_DOMAIN = 'deleted.invalid';
export const anonymizedEmail = (userId: string) => `deleted+${userId}@${DELETED_EMAIL_DOMAIN}`;

/**
 * Права субʼєкта персональних даних (ЗУ «Про захист персональних даних», GDPR ст. 15, 17, 20):
 * вивантаження своїх даних і видалення акаунта. Замовлення не видаляються — їх зберігаємо
 * для бухгалтерського й податкового обліку (ПКУ ст. 44.3 — 1095 днів), але звʼязок з людиною
 * знеособлюється разом з акаунтом.
 */
@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Усі дані про користувача, що зберігаються в системі, у машиночитному вигляді. */
  async export(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        orders: {
          include: { items: { include: { product: { select: { name: true, slug: true } } } }, events: true },
          orderBy: { createdAt: 'asc' },
        },
        contact: true,
      },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    const leads = await this.prisma.lead.findMany({
      where: { OR: this.leadMatch(user.email, user.phone) },
      orderBy: { createdAt: 'asc' },
    });
    return {
      exportedAt: now.toISOString(),
      profile: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      organization: user.organization && {
        name: user.organization.name,
        type: user.organization.type,
        edrpou: user.organization.edrpou,
        vatNumber: user.organization.vatNumber,
        verified: user.organization.verified,
      },
      orders: user.orders.map((o) => ({
        number: o.number,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        currency: o.currency,
        totalMinor: o.totalMinor,
        deliveryMethod: o.deliveryMethod,
        contact: { name: o.contactName, email: o.contactEmail, phone: o.contactPhone },
        items: o.items.map((i) => ({ product: i.product.name, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor })),
        history: o.events.map((e) => ({ status: e.toStatus, at: e.createdAt.toISOString() })),
      })),
      requests: leads.map((l) => ({
        source: l.source,
        createdAt: l.createdAt.toISOString(),
        name: l.name,
        email: l.email,
        phone: l.phone,
        companyName: l.companyName,
        message: l.message,
        details: l.payload,
      })),
      crmContact: user.contact && {
        firstName: user.contact.firstName,
        lastName: user.contact.lastName,
        email: user.contact.email,
        phone: user.contact.phone,
      },
    };
  }

  /**
   * Видалення акаунта: персональні дані профілю, CRM-контакту й заявок знеособлюються,
   * кошики й токени видаляються; увійти в акаунт більше неможливо.
   */
  async deleteAccount(userId: string, password: string): Promise<{ id: string; deleted: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.endsWith(`@${DELETED_EMAIL_DOMAIN}`)) throw new NotFoundException('Користувача не знайдено');
    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Невірний пароль');
    }
    if (user.role === 'ADMIN' && (await this.prisma.user.count({ where: { role: 'ADMIN' } })) <= 1) {
      throw new BadRequestException('Не можна видалити останнього адміністратора');
    }
    const leadMatch = this.leadMatch(user.email, user.phone);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      this.prisma.cart.deleteMany({ where: { userId } }),
      this.prisma.lead.updateMany({
        where: { OR: leadMatch },
        data: { name: null, email: null, phone: null, message: null, payload: Prisma.DbNull },
      }),
      this.prisma.contact.updateMany({
        where: { userId },
        data: { firstName: null, lastName: null, email: null, phone: null, userId: null },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail(userId),
          firstName: null,
          lastName: null,
          phone: null,
          passwordHash: null,
          role: 'CUSTOMER',
        },
      }),
    ]);
    return { id: userId, deleted: true };
  }

  private leadMatch(email: string, phone: string | null) {
    const byPhone = normalizePhone(phone);
    return [{ email: email.toLowerCase() }, ...(byPhone ? [{ phone: byPhone }] : [])];
  }
}
