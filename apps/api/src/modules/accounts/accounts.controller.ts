import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DeleteAccountSchema,
  ForgotPasswordSchema,
  LoginInputSchema,
  RegisterInputSchema,
  ResetPasswordSchema,
  Role,
  type JwtPayload,
} from '@voltstar/types';
import { AccountsService } from './accounts.service';
import { PrivacyService } from './privacy.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Audited } from '../../common/audit/audit.interceptor';
import { RateLimit } from '../../common/security/rate-limit';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly privacy: PrivacyService,
  ) {}

  @Post('register')
  @RateLimit({ name: 'register', limit: 10, windowSec: 3600 })
  register(@Body() body: unknown) {
    return this.accounts.register(RegisterInputSchema.parse(body));
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit({ name: 'login-ip', limit: 30, windowSec: 300 }, { name: 'login-email', limit: 5, windowSec: 300, by: 'email' })
  login(@Body() body: unknown) {
    return this.accounts.login(LoginInputSchema.parse(body));
  }

  /** Запит на скидання паролю — завжди 202, лист надсилається лише існуючим користувачам. */
  @Post('password/forgot')
  @HttpCode(202)
  @RateLimit({ name: 'forgot-ip', limit: 10, windowSec: 900 }, { name: 'forgot-email', limit: 3, windowSec: 900, by: 'email' })
  forgotPassword(@Body() body: unknown) {
    return this.accounts.requestPasswordReset(ForgotPasswordSchema.parse(body));
  }

  @Post('password/reset')
  @HttpCode(200)
  @RateLimit({ name: 'reset', limit: 10, windowSec: 900 })
  resetPassword(@Body() body: unknown) {
    return this.accounts.resetPassword(ResetPasswordSchema.parse(body));
  }

  /** Кабінет: профіль поточного користувача. */
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.accounts.getProfile(user.sub);
  }

  /** Вивантаження всіх своїх персональних даних (право доступу й перенесення даних). */
  @Get('me/export')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RateLimit({ name: 'export', limit: 5, windowSec: 3600 })
  @Header('Content-Disposition', 'attachment; filename="voltstar-my-data.json"')
  @Header('Cache-Control', 'no-store')
  exportMyData(@CurrentUser() user: JwtPayload) {
    return this.privacy.export(user.sub);
  }

  /** Видалення акаунта (право на забуття) — з підтвердженням паролем. */
  @Post('me/delete')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RateLimit({ name: 'account-delete', limit: 5, windowSec: 900 })
  @Audited('account.delete', 'User')
  deleteMyAccount(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    return this.privacy.deleteAccount(user.sub, DeleteAccountSchema.parse(body).password);
  }

  /** Верифікація організації — лише менеджер/адмін. */
  @Post('organizations/:id/verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  @Audited('organization.verify', 'Organization', 'id')
  verifyOrganization(@Param('id') id: string) {
    return this.accounts.verifyOrganization(id);
  }
}
