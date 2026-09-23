import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditEntry, AuditQuery, Page } from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeAuditData } from '../../common/audit/audit.sanitize';

export interface AuditRecord {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  data?: unknown;
  ip?: string | null;
}

/** Журнал дій персоналу. Запис — best effort: збій журналу не скасовує саму дію. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditRecord): Promise<void> {
    try {
      const data = entry.data === undefined ? undefined : sanitizeAuditData(entry.data);
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`Аудит не записано (${entry.action} ${entry.entityId ?? ''}): ${(e as Error).message}`);
    }
  }

  async list(q: AuditQuery): Promise<Page<AuditEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      entity: q.entity || undefined,
      entityId: q.entityId || undefined,
      actorId: q.actorId || undefined,
      action: q.action ? { startsWith: q.action } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        actor: r.actor,
        data: r.data ?? null,
        ip: r.ip,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: q.page,
      perPage: q.perPage,
    };
  }
}
