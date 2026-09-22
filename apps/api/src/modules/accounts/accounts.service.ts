import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AuthResult,
  AuthUser,
  LoginInput,
  Organization as OrganizationDto,
  RegisterInput,
  Segment,
} from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../common/auth/password.util';
import { TokenService } from '../../common/auth/token.service';
import { isValidEdrpou, isValidVat } from './edrpou.util';

const userInclude = { organization: true } satisfies Prisma.UserInclude;
type UserWithOrg = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Реєстрація користувача (+ організація для B2B/B2G). Повертає токен і профіль. */
  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Користувач із таким email вже існує');

    let orgId: string | undefined;
    if (input.organization) {
      const org = input.organization;
      const requiresEdrpou = org.type === 'BUSINESS' || org.type === 'GOVERNMENT';
      if (org.edrpou && !isValidEdrpou(org.edrpou)) {
        throw new BadRequestException('Некоректний код ЄДРПОУ');
      }
      if (requiresEdrpou && !org.edrpou) {
        throw new BadRequestException('Для організації потрібен код ЄДРПОУ');
      }
      if (org.vatNumber && !isValidVat(org.vatNumber)) {
        throw new BadRequestException('Некоректний VAT/ІПН');
      }
      const created = await this.prisma.organization.create({
        data: {
          name: org.name,
          type: org.type,
          segment: org.segment,
          edrpou: org.edrpou ?? null,
          vatNumber: org.vatNumber ?? null,
        },
      });
      orgId = created.id;
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(input.password),
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        role: 'CUSTOMER',
        orgId: orgId ?? null,
      },
      include: userInclude,
    });

    return this.toAuthResult(user);
  }

  /** Логін за email + паролем. */
  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: userInclude,
    });
    if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('Невірний email або пароль');
    }
    return this.toAuthResult(user);
  }

  /** Профіль користувача за id (кабінет). */
  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userInclude,
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.toAuthUser(user);
  }

  /** Верифікація організації (ЄДРПОУ/VAT) — для менеджера/адміна. */
  async verifyOrganization(orgId: string): Promise<OrganizationDto> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Організацію не знайдено');
    if (org.edrpou && !isValidEdrpou(org.edrpou)) {
      throw new BadRequestException('Код ЄДРПОУ організації некоректний');
    }
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { verified: true },
    });
    return this.toOrgDto(updated);
  }

  private segmentOf(user: UserWithOrg): Segment {
    return (user.organization?.segment ?? 'B2C') as Segment;
  }

  private toAuthResult(user: UserWithOrg): AuthResult {
    const authUser = this.toAuthUser(user);
    const accessToken = this.tokens.sign({
      sub: user.id,
      email: user.email,
      role: authUser.role,
      segment: authUser.segment,
      orgId: user.orgId ?? null,
    });
    return { accessToken, expiresIn: this.tokens.expiresInSec, user: authUser };
  }

  private toAuthUser(user: UserWithOrg): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      segment: this.segmentOf(user),
      organization: user.organization ? this.toOrgDto(user.organization) : null,
    };
  }

  private toOrgDto(org: NonNullable<UserWithOrg['organization']>): OrganizationDto {
    return {
      id: org.id,
      name: org.name,
      type: org.type,
      segment: org.segment,
      edrpou: org.edrpou,
      vatNumber: org.vatNumber,
      verified: org.verified,
    };
  }
}
