/**
 * Призначення ролі зареєстрованому користувачу (перший менеджер/адмін CRM):
 *   pnpm --filter @voltstar/api user:role manager@firm.ua MANAGER
 * Ролі: CUSTOMER, MANAGER, ADMIN. Діє з наступного входу (роль — у JWT).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Role, RoleSchema } from '@voltstar/types';
import { PrismaService } from '../prisma/prisma.service';

function loadEnv(): void {
  for (const file of [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../../.env')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const [email, rawRole] = process.argv.slice(2);
  const role = RoleSchema.safeParse(rawRole?.toUpperCase());
  if (!email || !role.success) {
    throw new Error(`Використання: user:role <email> <${Object.values(Role).join('|')}>`);
  }
  const prisma = new PrismaService();
  try {
    const user = await prisma.user
      .update({
        where: { email: email.trim().toLowerCase() },
        data: { role: role.data },
        select: { email: true, role: true },
      })
      .catch(() => null);
    if (!user) throw new Error(`Користувача ${email} не знайдено — спершу зареєструйтеся`);
    console.log(`✅ ${user.email} → ${user.role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌', (e as Error).message);
  process.exit(1);
});
