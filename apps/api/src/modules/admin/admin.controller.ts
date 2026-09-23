import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AdminListQuerySchema,
  AdminProductInputSchema,
  AdminProductUpdateSchema,
  AnalyticsQuerySchema,
  AuditQuerySchema,
  Role,
  RoleSchema,
  SetPriceSchema,
  SetRoleSchema,
  SetStockSchema,
  type JwtPayload,
} from '@voltstar/types';
import { Audited } from '../../common/audit/audit.interceptor';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminUsersService } from './admin-users.service';
import { AnalyticsService } from './analytics.service';

type Q = Record<string, unknown>;
const num = (v: unknown) => (v != null && v !== '' ? Number(v) : undefined);
const str = (v: unknown) => (v != null && v !== '' ? String(v) : undefined);
const listQuery = (q: Q) => AdminListQuerySchema.parse({ q: str(q.q), page: num(q.page), perPage: num(q.perPage) });

/**
 * Back-office. Менеджер: дашборд і залишки; адміністратор: каталог, ціни, користувачі, аудит.
 * Роль за замовчуванням для контролера — ADMIN; послаблення вказано на окремих маршрутах.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly users: AdminUsersService,
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
  ) {}

  // ─────────── Аналітика ───────────

  @Get('analytics')
  @Roles(Role.MANAGER, Role.ADMIN)
  report(@Query() q: Q) {
    return this.analytics.report(AnalyticsQuerySchema.parse({ from: str(q.from), to: str(q.to) }));
  }

  // ─────────── Каталог ───────────

  @Get('catalog/refs')
  @Roles(Role.MANAGER, Role.ADMIN)
  refs() {
    return this.catalog.refs();
  }

  @Get('products')
  @Roles(Role.MANAGER, Role.ADMIN)
  products(@Query() q: Q) {
    return this.catalog.list(listQuery(q));
  }

  @Get('products/:id')
  @Roles(Role.MANAGER, Role.ADMIN)
  product(@Param('id') id: string) {
    return this.catalog.get(id);
  }

  @Post('products')
  @Audited('product.create', 'Product')
  createProduct(@Body() body: unknown) {
    return this.catalog.create(AdminProductInputSchema.parse(body));
  }

  @Patch('products/:id')
  @Audited('product.update', 'Product', 'id')
  updateProduct(@Param('id') id: string, @Body() body: unknown) {
    return this.catalog.update(id, AdminProductUpdateSchema.parse(body));
  }

  @Put('products/:id/prices/:priceListId')
  @Audited('product.price', 'Product', 'id')
  setPrice(@Param('id') id: string, @Param('priceListId') priceListId: string, @Body() body: unknown) {
    return this.catalog.setPrice(id, priceListId, SetPriceSchema.parse(body));
  }

  @Delete('products/:id/prices/:priceListId')
  @Audited('product.price-remove', 'Product', 'id')
  removePrice(@Param('id') id: string, @Param('priceListId') priceListId: string) {
    return this.catalog.removePrice(id, priceListId);
  }

  /** Інвентаризація — доступна й менеджеру. */
  @Put('products/:id/stock')
  @Roles(Role.MANAGER, Role.ADMIN)
  @Audited('product.stock', 'Product', 'id')
  setStock(@Param('id') id: string, @Body() body: unknown) {
    return this.catalog.setStock(id, SetStockSchema.parse(body).quantity);
  }

  // ─────────── Користувачі й організації ───────────

  @Get('users')
  listUsers(@Query() q: Q) {
    return this.users.list({ ...listQuery(q), role: q.role ? RoleSchema.parse(q.role) : undefined });
  }

  @Patch('users/:id/role')
  @Audited('user.role', 'User', 'id')
  setRole(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.users.setRole(id, SetRoleSchema.parse(body).role, user.sub);
  }

  /** Черга верифікації (саму верифікацію робить POST /accounts/organizations/:id/verify). */
  @Get('organizations')
  @Roles(Role.MANAGER, Role.ADMIN)
  organizations(@Query() q: Q) {
    const verified = q.verified === 'true' ? true : q.verified === 'false' ? false : undefined;
    return this.users.organizations({ ...listQuery(q), verified });
  }

  // ─────────── Аудит ───────────

  @Get('audit')
  auditLog(@Query() q: Q) {
    return this.audit.list(
      AuditQuerySchema.parse({
        entity: str(q.entity),
        entityId: str(q.entityId),
        actorId: str(q.actorId),
        action: str(q.action),
        page: num(q.page),
        perPage: num(q.perPage),
      }),
    );
  }
}
