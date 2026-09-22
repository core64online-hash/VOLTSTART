# VOLTSTAR ⚡

E-commerce платформа для **підбору й продажу генераторів** із вбудованим CRM та мультисегментною
моделлю **B2C / B2B / B2G**.

## Можливості (за дорожньою картою)

1. **Форма підбору** генератора під будь-яку техніку (розрахунок потужності + ранжування).
2. **Найповніший каталог** генераторів із фасетним пошуком.
3. **Онлайн-купівля та оплата** (Україна: WayForPay/LiqPay; міжнародні: Stripe).
4. **CRM** — ліди, угоди, клієнти, історія комунікацій.
5. **B2C / B2B / B2G** — різні флоу, ціни й документообіг.

## Стек

- **Monorepo:** Turborepo + pnpm
- **Web:** Next.js 15 (App Router), React 19, Tailwind, next-intl (uk/en)
- **API:** NestJS (модульний моноліт), Swagger/OpenAPI
- **БД:** PostgreSQL + Prisma
- **Пошук:** Typesense · **Черги/кеш:** Redis + BullMQ
- **Платежі:** WayForPay/LiqPay + Stripe

Деталі — у [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Структура

```
apps/
  web/   — Next.js фронтенд
  api/   — NestJS бекенд
packages/
  config/ — спільні tsconfig/eslint
  types/  — спільні типи та zod-схеми
  ui/     — спільні React-компоненти
docs/     — архітектура, дорожня карта, чек-лист
```

## Швидкий старт (локально)

```bash
# 1. Залежності
pnpm install

# 2. Змінні середовища
cp .env.example .env

# 3. Інфраструктура (Postgres, Redis, Typesense, Mailhog)
docker-compose up -d

# 4. Prisma: клієнт + міграції + демо-дані
pnpm --filter @voltstar/api prisma:generate
pnpm --filter @voltstar/api prisma:migrate
pnpm --filter @voltstar/api seed

# 5. Запуск усього монорепо
pnpm dev
```

- Web → http://localhost:3000
- API → http://localhost:4000/api (Swagger: http://localhost:4000/docs)
- Пошта (Mailhog UI) → http://localhost:8025

## Команди

```bash
pnpm dev         # усі застосунки в режимі розробки
pnpm build       # збірка
pnpm lint        # лінтинг
pnpm typecheck   # перевірка типів
pnpm test        # тести
```

## Документація

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — системна архітектура
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — покроковий план по фазах
- [`docs/CHECKLIST.md`](docs/CHECKLIST.md) — детальний чек-лист

## CI

GitHub Actions: `.github/workflows/ci.yml`. Пайплайн на кожен push/PR:
install → prisma generate → lint → typecheck → test → build.
