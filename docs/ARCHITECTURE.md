# VOLTSTAR — Архітектура

## Огляд

VOLTSTAR — e-commerce платформа підбору й продажу генераторів із вбудованим CRM та мультисегментною
моделлю **B2C / B2B / B2G**. Реалізується як **TypeScript-монорепо**: єдина мова, спільні типи й
валідатори, чисті межі модулів (готові до винесення в окремі сервіси).

## Технологічний стек

| Шар | Технологія | Призначення |
|-----|-----------|-------------|
| Monorepo | Turborepo + pnpm | кеш білдів, спільні пакети |
| Frontend | Next.js 15 (App Router), React 19, Tailwind + shadcn/ui, TanStack Query, next-intl (uk/en) | SSR/SEO, i18n |
| Backend | NestJS (модульний моноліт), REST + OpenAPI/Swagger | bounded contexts, DI |
| БД | PostgreSQL 16 + Prisma | замовлення, ціни, CRM |
| Пошук | Typesense (або Meilisearch) | фасетний каталог |
| Кеш/черги | Redis + BullMQ | асинхронні задачі |
| Auth/RBAC | Auth.js + JWT; готовність до Keycloak/SSO (B2G) | ролі guest/customer/manager/admin |
| Платежі | WayForPay/LiqPay (UAH) + Stripe (мультивалюта) | за абстракцією `PaymentProvider` |
| Файли | S3-сумісне (Cloudflare R2 / AWS S3) | фото, PDF-документи |
| Сповіщення | Email (Resend/SendGrid) + SMS + Telegram | транзакційні листи, алерти |
| Observability | Sentry, OpenTelemetry, pino, Prometheus/Grafana | помилки, трейси, метрики |
| DevOps | Docker, GitHub Actions; Vercel (web) + керований Postgres + контейнер API | CI/CD |

> **PCI:** карткові дані не зберігаємо — лише hosted payment pages/токени провайдерів.

## Діаграма

```
[Next.js web] ──REST/OpenAPI──> [NestJS API modular monolith]
      │                               │
   next-intl, SSR                     ├── PostgreSQL (Prisma)
      │                               ├── Redis + BullMQ (jobs)
[Typesense search] <── sync ──────────┤
                                      ├── S3/R2 (files, PDFs)
                                      ├── Payments: WayForPay/LiqPay, Stripe (webhooks)
                                      └── Email/SMS/Telegram
```

## Bounded contexts (модулі NestJS)

- **Catalog** — генератори, категорії, бренди, характеристики, фото, наявність.
- **Selector** — движок розрахунку потужності та підбору (див. нижче).
- **Pricing** — сегментні прайс-листи, знижки, валюти, ПДВ.
- **Accounts & Auth** — користувачі, ролі, організації (individual/business/government, ЄДРПОУ/VAT).
- **Cart & Checkout** — кошик, розрахунок вартості, доставка, гілкування за сегментом.
- **Payments** — WayForPay/LiqPay + Stripe за спільним інтерфейсом, webhooks, звірка.
- **Orders** — замовлення, машина станів, документи (рахунок, накладна, PDF).
- **CRM** — ліди, контакти, компанії, угоди (pipeline), задачі, активності, історія.
- **Notifications** — email/SMS/Telegram, шаблони, черги.
- **Content/CMS** — сторінки, блог, SEO.
- **Admin** — бек-офіс для менеджерів.
- **Analytics** — дашборди продажів і воронки.

## Мультисегментна модель B2C / B2B / B2G

Сегмент визначається `Organization.type` + прайс-лист + гілка checkout:

- **B2C** — миттєва онлайн-оплата картою, роздрібні ціни, швидкий/гість-чекаут.
- **B2B** — реєстрація компанії (ЄДРПОУ/VAT-верифікація), оптові/договірні ціни, **оплата за рахунком**
  з відстрочкою, персональний менеджер, кабінет із документами.
- **B2G** — тендерний флоу, спец-документообіг (сумісність із ProZorro), розширена верифікація,
  оплата за рахунком, звітність.

## Движок підбору (Selector)

**Вхід:** перелік споживачів (потужність, тип навантаження, кількість, одночасність пуску),
фазність (1/3), запас потужності, режим використання, уподобання за паливом.

**Логіка** (`apps/api/src/modules/selector/selector.service.ts`):
1. Робоча потужність = Σ(потужність × кількість).
2. Пусковий стрибок за коефіцієнтами: RESISTIVE ×1, ELECTRONIC ×1.5, INDUCTIVE ×3, MOTOR ×4.
3. Пік = робоча + Σ(одночасні стрибки) + max(послідовний стрибок).
4. Рекомендована потужність = max(робоча × (1 + запас + режим), пік); переклад у кВА (cosφ 0.8).
5. Ранжування каталогу: фільтр за потужністю/фазою → сортування від найближчого.

Профілі типової техніки зберігаються в `EquipmentPreset` (напр. «Холодильник», «Насос»).

## Модель даних (ключові сутності)

`User`, `Organization`, `Brand`, `Category`, `Product`, `ProductSpec`, `InventoryItem`,
`PriceList`, `Price`, `EquipmentPreset`, `Cart`/`CartItem`, `Order`/`OrderItem`, `Payment`,
`Invoice`, `Company`, `Contact`, `Lead`, `Deal`, `Activity`, `Task`.

Повна схема — `apps/api/prisma/schema.prisma`.

## Середовища та деплой

- **dev** — локально (docker-compose) або хмарний dev.
- **staging** — повна копія prod для приймальних тестів.
- **prod** — web (Vercel/CDN) + API (контейнер) + керований Postgres + Redis + Typesense.
- CI/CD: GitHub Actions (lint → typecheck → test → build → deploy), міграції Prisma у пайплайні.
