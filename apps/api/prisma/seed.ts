/**
 * Демо-сідінг для локальної розробки VOLTSTAR.
 * Запуск: pnpm --filter @voltstar/api seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Бренди
  const generac = await prisma.brand.upsert({
    where: { slug: 'generac' },
    update: {},
    create: { name: 'Generac', slug: 'generac' },
  });

  // Категорії
  const backup = await prisma.category.upsert({
    where: { slug: 'backup-generators' },
    update: {},
    create: { name: 'Резервні генератори', slug: 'backup-generators' },
  });

  // Прайс-листи по сегментах
  const b2cList = await prisma.priceList.upsert({
    where: { segment_currency_name: { segment: 'B2C', currency: 'UAH', name: 'Роздріб' } },
    update: {},
    create: { name: 'Роздріб', segment: 'B2C', currency: 'UAH' },
  });

  // Товар
  const product = await prisma.product.upsert({
    where: { slug: 'generac-gp3300' },
    update: {},
    create: {
      slug: 'generac-gp3300',
      name: 'Generac GP3300',
      description: 'Бензиновий генератор для резервного живлення.',
      brandId: generac.id,
      categoryId: backup.id,
      fuel: 'PETROL',
      phase: 'SINGLE',
      ratedPowerW: 3300,
      maxPowerW: 4000,
      inventory: { create: { quantity: 12 } },
    },
  });

  await prisma.price.upsert({
    where: { productId_priceListId: { productId: product.id, priceListId: b2cList.id } },
    update: {},
    create: { productId: product.id, priceListId: b2cList.id, amountMinor: 1899000, vatRate: 0.2 },
  });

  // Пресети типової техніки для форми підбору
  const presets = [
    { label: 'Холодильник побутовий', powerW: 200, loadType: 'INDUCTIVE', category: 'Побут' },
    { label: 'Обігрівач', powerW: 2000, loadType: 'RESISTIVE', category: 'Побут' },
    { label: 'Насос свердловинний', powerW: 1100, loadType: 'MOTOR', category: 'Інженерія' },
    { label: 'Комп’ютер', powerW: 400, loadType: 'ELECTRONIC', category: 'Офіс' },
  ];
  for (const p of presets) {
    await prisma.equipmentPreset.create({ data: p });
  }

  console.log('Seed завершено ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
