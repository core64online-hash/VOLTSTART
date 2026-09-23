import { Global, Module } from '@nestjs/common';
import { AuditInterceptor } from '../../common/audit/audit.interceptor';
import { AuditService } from './audit.service';

// Phase 6: журнал дій персоналу. Глобальний — @Audited() доступний у будь-якому контролері.
@Global()
@Module({
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
