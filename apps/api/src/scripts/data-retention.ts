/**
 * Очищення даних за строками зберігання (запускати щодня cron-ом / планувальником):
 *   pnpm --filter @voltstar/api data:retention            # застосувати
 *   pnpm --filter @voltstar/api data:retention --dry-run  # лише показати, що буде зачеплено
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { applyRetention, RETENTION_DAYS } from '../modules/accounts/retention';

function loadEnv(): void {
  for (const file of [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../../.env')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaService();
  try {
    const report = await applyRetention(prisma, { dryRun });
    console.log(dryRun ? 'Пробний прогін (нічого не змінено):' : '✅ Очищення за строками зберігання:');
    for (const [key, n] of Object.entries(report)) {
      console.log(`  ${key.padEnd(18)} ${String(n).padStart(6)}  (строк ${RETENTION_DAYS[key as keyof typeof RETENTION_DAYS]} дн.)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌', (e as Error).message);
  process.exit(1);
});
