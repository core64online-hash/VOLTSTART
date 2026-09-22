/**
 * Повна переіндексація каталогу в Typesense з командного рядка:
 *   pnpm --filter @voltstar/api search:reindex
 * Читає ті самі змінні середовища, що й API (DATABASE_URL, TYPESENSE_*).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../modules/search/search.service';

/** tsx не читає .env сам — підхоплюємо apps/api/.env і кореневий .env (вже задані змінні не перезаписуються). */
function loadEnv(): void {
  for (const file of [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../../.env')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const prisma = new PrismaService();
  const config = { get: (key: string) => process.env[key] } as unknown as ConfigService;
  const search = new SearchService(prisma, config);
  if (!search.enabled) throw new Error('Задайте TYPESENSE_HOST і TYPESENSE_API_KEY');
  try {
    const { collection, indexed } = await search.reindexAll();
    console.log(`✅ Проіндексовано ${indexed} товарів → ${collection}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌', (e as Error).message);
  process.exit(1);
});
