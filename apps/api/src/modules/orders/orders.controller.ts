import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ChangeOrderStatusSchema,
  ManageOrdersQuerySchema,
  OrderDocumentKindSchema,
  Role,
  type JwtPayload,
} from '@voltstar/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/auth/optional-jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { DocumentsService } from '../documents/documents.service';
import { OrdersService, type OrderViewer } from './orders.service';

const viewerOf = (user?: JwtPayload, email?: string): OrderViewer => ({
  userId: user?.sub,
  role: user?.role,
  email: email || undefined,
});

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly documents: DocumentsService,
  ) {}

  /** Історія замовлень поточного користувача. */
  @Get()
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: JwtPayload) {
    return this.orders.listMine(user.sub);
  }

  /** Усі замовлення — для менеджера/адміна. (Оголошено до :number, щоб не перехоплювався.) */
  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  manage(@Query() q: Record<string, unknown>) {
    return this.orders.listForStaff(
      ManageOrdersQuerySchema.parse({
        status: q.status ? String(q.status) : undefined,
        page: q.page ? Number(q.page) : undefined,
        perPage: q.perPage ? Number(q.perPage) : undefined,
      }),
    );
  }

  /** Деталі: власник / персонал / гість із ?email= замовлення. */
  @Get(':number')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('number') number: string, @Query('email') email?: string, @CurrentUser() user?: JwtPayload) {
    return this.orders.getDetail(number, viewerOf(user, email));
  }

  /** PDF: рахунок-фактура або видаткова накладна. */
  @Get(':number/documents/:kind')
  @UseGuards(OptionalJwtAuthGuard)
  async document(
    @Param('number') number: string,
    @Param('kind') kind: string,
    @Query('email') email?: string,
    @CurrentUser() user?: JwtPayload,
  ): Promise<StreamableFile> {
    const docKind = OrderDocumentKindSchema.parse(kind);
    await this.orders.assertCanView(number, viewerOf(user, email));
    const doc = await this.documents.render(number, docKind);
    return new StreamableFile(doc.content, {
      type: 'application/pdf',
      disposition: `attachment; filename="${doc.filename}"`,
      length: doc.content.length,
    });
  }

  /** Ручна зміна статусу (комплектація, відвантаження, доставка, скасування, повернення). */
  @Patch(':number/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  changeStatus(@Param('number') number: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const { status, note } = ChangeOrderStatusSchema.parse(body);
    return this.orders.changeStatus(number, status, user.sub, note);
  }
}
