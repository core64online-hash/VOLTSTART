import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentProviderKindSchema, Role, type JwtPayload } from '@voltstar/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { PaymentsService } from './payments.service';

/** Мінімальний тип запиту: потрібні сирі байти тіла для перевірки підпису. */
interface RawRequest {
  rawBody?: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

function flattenHeaders(h: RawRequest['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) if (v != null) out[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : v;
  return out;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Вебхуки провайдерів (WAYFORPAY | LIQPAY | STRIPE). */
  @Post('webhooks/:provider')
  @HttpCode(200)
  async webhook(@Param('provider') provider: string, @Req() req: RawRequest) {
    const kind = PaymentProviderKindSchema.safeParse(provider.toUpperCase());
    if (!kind.success || kind.data === 'BANK_INVOICE') throw new BadRequestException('Невідомий провайдер');
    if (!req.rawBody) throw new BadRequestException('Порожнє тіло запиту');

    const outcome = await this.payments.handleWebhook(
      kind.data,
      flattenHeaders(req.headers),
      req.rawBody.toString('utf8'),
    );
    return outcome.ack ?? { received: true };
  }

  /** Звірка оплати за рахунком — менеджер/адмін. */
  @Post('orders/:number/mark-paid')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  markPaid(@Param('number') number: string, @CurrentUser() user: JwtPayload) {
    return this.payments.markInvoicePaid(number, user.sub);
  }
}
