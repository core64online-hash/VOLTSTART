import { SetMetadata } from '@nestjs/common';
import type { Role } from '@voltstar/types';

export const ROLES_KEY = 'roles';

/** Обмежує доступ до маршруту переліком ролей (використовується з RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
