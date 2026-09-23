import { applyDecorators, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ChangeDealStageSchema,
  ConvertLeadSchema,
  CreateActivitySchema,
  CreateDealSchema,
  CreateLeadSchema,
  CreateTaskSchema,
  LeadStatusSchema,
  Role,
  UpdateLeadSchema,
  UpdateTaskSchema,
  type JwtPayload,
} from '@voltstar/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Audited } from '../../common/audit/audit.interceptor';
import { RateLimit } from '../../common/security/rate-limit';
import { CrmService } from './crm.service';

/** Доступ лише для менеджерів і адмінів. */
const Staff = () => applyDecorators(ApiBearerAuth(), UseGuards(JwtAuthGuard, RolesGuard), Roles(Role.MANAGER, Role.ADMIN));
const mineFilter = (mine: unknown, user: JwtPayload) => (mine === 'true' ? user.sub : undefined);

@ApiTags('crm')
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  /** Публічна заявка (форма підбору, запит B2B/B2G). Відповідь не розкриває внутрішніх даних. */
  @Post('leads')
  @HttpCode(202)
  @RateLimit({ name: 'lead', limit: 5, windowSec: 600 })
  async createLead(@Body() body: unknown) {
    await this.crm.createLead(CreateLeadSchema.parse(body));
    return { received: true };
  }

  @Get('leads')
  @Staff()
  leads(@Query('status') status: string | undefined, @Query('mine') mine: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.crm.listLeads({ status: status ? LeadStatusSchema.parse(status) : undefined, ownerId: mineFilter(mine, user) });
  }

  @Patch('leads/:id')
  @Staff()
  @Audited('lead.update', 'Lead', 'id')
  updateLead(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.crm.updateLead(id, UpdateLeadSchema.parse(body), user.sub);
  }

  @Post('leads/:id/convert')
  @Staff()
  @Audited('lead.convert', 'Lead', 'id')
  convertLead(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.crm.convertLead(id, ConvertLeadSchema.parse(body ?? {}), user.sub);
  }

  /** Канбан угод за стадіями. */
  @Get('pipeline')
  @Staff()
  pipeline(@Query('mine') mine: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.crm.pipeline({ ownerId: mineFilter(mine, user) });
  }

  @Post('deals')
  @Staff()
  @Audited('deal.create', 'Deal')
  createDeal(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.crm.createDeal(CreateDealSchema.parse(body), user.sub);
  }

  @Get('deals/:id')
  @Staff()
  deal(@Param('id') id: string) {
    return this.crm.getDeal(id);
  }

  @Patch('deals/:id/stage')
  @Staff()
  @Audited('deal.stage', 'Deal', 'id')
  changeStage(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.crm.changeDealStage(id, ChangeDealStageSchema.parse(body), user.sub);
  }

  /** Запис у історію комунікацій (дзвінок, лист, зустріч, нотатка). */
  @Post('activities')
  @Staff()
  addActivity(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.crm.addActivity(CreateActivitySchema.parse(body), user.sub);
  }

  @Get('tasks')
  @Staff()
  tasks(@Query('mine') mine: string | undefined, @Query('done') done: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.crm.listTasks({ assigneeId: mineFilter(mine, user), includeDone: done === 'true' });
  }

  @Post('tasks')
  @Staff()
  createTask(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.crm.createTask(CreateTaskSchema.parse(body), user.sub);
  }

  @Patch('tasks/:id')
  @Staff()
  updateTask(@Param('id') id: string, @Body() body: unknown) {
    return this.crm.updateTask(id, UpdateTaskSchema.parse(body).done);
  }
}
