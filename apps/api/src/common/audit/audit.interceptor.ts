import {
  applyDecorators,
  Injectable,
  SetMetadata,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtPayload } from '@voltstar/types';
import { tap, type Observable } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  /** Код дії, напр. "order.status". */
  action: string;
  /** Тип сутності, напр. "Order". */
  entity: string;
  /** Параметр маршруту з ідентифікатором; інакше — id/number з відповіді. */
  idParam?: string;
}

type AuditedRequest = {
  user?: JwtPayload;
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
};

/** Після успішного виконання обробника пише запис у журнал (невдалі дії не журналюються). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_KEY, ctx.getHandler());
    if (!meta) return next.handle();
    const req = ctx.switchToHttp().getRequest<AuditedRequest>();
    return next.handle().pipe(
      tap((result) => {
        const fromResult = result && typeof result === 'object' ? (result as { id?: unknown; number?: unknown }) : {};
        const entityId =
          (meta.idParam ? req.params?.[meta.idParam] : undefined) ??
          (typeof fromResult.id === 'string' ? fromResult.id : undefined) ??
          (typeof fromResult.number === 'string' ? fromResult.number : undefined) ??
          null;
        const body = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0 ? req.body : undefined;
        void this.audit.record({
          actorId: req.user?.sub ?? null,
          action: meta.action,
          entity: meta.entity,
          entityId,
          data: body,
          ip: req.ip ?? null,
        });
      }),
    );
  }
}

/** Журналює успішний виклик маршруту в аудит-лог. */
export const Audited = (action: string, entity: string, idParam?: string) =>
  applyDecorators(SetMetadata(AUDIT_KEY, { action, entity, idParam } satisfies AuditMeta), UseInterceptors(AuditInterceptor));
