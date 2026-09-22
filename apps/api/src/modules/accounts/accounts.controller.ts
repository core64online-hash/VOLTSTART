import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ForgotPasswordSchema,
  LoginInputSchema,
  RegisterInputSchema,
  ResetPasswordSchema,
  Role,
  type JwtPayload,
} from '@voltstar/types';
import { AccountsService } from './accounts.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('register')
  register(@Body() body: unknown) {
    return this.accounts.register(RegisterInputSchema.parse(body));
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.accounts.login(LoginInputSchema.parse(body));
  }

  /** Запит на скидання паролю — завжди 202, лист надсилається лише існуючим користувачам. */
  @Post('password/forgot')
  @HttpCode(202)
  forgotPassword(@Body() body: unknown) {
    return this.accounts.requestPasswordReset(ForgotPasswordSchema.parse(body));
  }

  @Post('password/reset')
  @HttpCode(200)
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

  /** Верифікація організації — лише менеджер/адмін. */
  @Post('organizations/:id/verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  verifyOrganization(@Param('id') id: string) {
    return this.accounts.verifyOrganization(id);
  }
}
