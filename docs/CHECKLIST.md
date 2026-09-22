# VOLTSTAR — Чек-лист впровадження

## Phase 0 — Каркас (поточний інкремент)
- [x] Ініціалізація монорепо: pnpm workspaces + Turborepo
- [x] Базові конфіги: TS, ESLint, Prettier, `.editorconfig`, `.gitignore`, `.env.example`
- [x] `apps/web`: Next.js 15 + Tailwind + next-intl (uk/en), стартова сторінка
- [x] `apps/api`: NestJS + Swagger + health-endpoint + скелети модулів bounded contexts
- [x] `packages/`: `config`, `ui`, `types` (zod DTO)
- [x] Prisma: `schema.prisma` зі скелетом ключових моделей + seed
- [x] Selector: сервіс розрахунку потужності + unit-тести
- [x] `docker-compose.yml`: postgres, redis, typesense, mailhog
- [x] `.github/workflows/ci.yml`: install → lint → typecheck → test → build
- [x] `docs/`: ARCHITECTURE.md, ROADMAP.md, CHECKLIST.md, README
- [ ] Локальний запуск перевірено (`pnpm install`, `docker-compose up`, `pnpm dev`)
- [x] Перша Prisma-міграція згенерована в оточенні з БД (`prisma/migrations/*_init`)

## Phase 1 — Каталог + Підбір
- [ ] Моделі Product/Category/Brand/ProductSpec/InventoryItem + міграції
- [ ] CRUD API каталогу + сідінг демо-даних
- [ ] Інтеграція Typesense + синхронізація індексу (BullMQ job)
- [ ] Фронт: список каталогу з фасетними фільтрами, сторінка товару, SEO
- [ ] EquipmentPreset (профілі навантаження типової техніки)
- [ ] Форма підбору (UI) → `/api/selector/calculate` → ранжований список
- [ ] Тести: розрахунок потужності (є), E2E пошук і підбір

## Phase 2 — Акаунти, сегменти, ціни
- [x] Auth (реєстрація/логін), JWT-токени, ролі RBAC (JwtAuthGuard + RolesGuard)
- [x] Organization + типи; верифікація ЄДРПОУ/VAT (контрольна сума ЄДРПОУ)
- [x] Pricing-движок: PriceList/Price за сегментом і валютою (розкладка ПДВ)
- [x] Кабінети профілю за сегментами (B2C/B2B/B2G): login/register/account на web
- [x] Тести доступів (RBAC) і коректності цін за сегментом
- [ ] Скидання паролю (email) — перенесено до наступного інкременту
- [x] Перша Prisma-міграція для Accounts/Pricing в оточенні з БД (увійшла в `init`)

## Phase 3 — Кошик, checkout, платежі
- [x] Cart/CartItem, розрахунок вартості, ПДВ, доставка (Нова пошта / курʼєр / самовивіз, пороги безкоштовної доставки)
- [x] `PaymentProvider`: WayForPay/LiqPay + Stripe + оплата за рахунком (BANK_INVOICE)
- [x] Webhooks + звірка статусів (ідемпотентність за `WebhookEvent`, перевірка підписів, звірка суми)
- [x] Гілки checkout: B2C (карта) vs B2B/B2G (рахунок; лише для верифікованих організацій)
- [x] Резерв складу при оформленні (умовне списання) і відкат при збої провайдера
- [x] Web: кнопка «У кошик», кошик із доставкою та оформленням, повернення з оплати
- [x] Тести: підписи провайдерів, ідемпотентність вебхуків, розрахунки кошика, гілки checkout; e2e на реальній БД
- [ ] Тести оплат у sandbox провайдерів (потрібні тестові облікові дані WayForPay/LiqPay/Stripe)
- [ ] Повернення коштів (refund) через Stripe-вебхуки `charge.refunded` — наступний інкремент

## Phase 4 — Замовлення й документи
- [ ] Order/OrderItem, машина станів
- [ ] Генерація PDF (рахунок, накладна) → S3/R2
- [ ] Сповіщення (email/SMS/Telegram)
- [ ] Кабінет: історія замовлень і документи
- [ ] E2E: повний цикл замовлення для кожного сегмента

## Phase 5 — CRM
- [ ] Lead/Contact/Company/Deal/Activity/Task + міграції
- [ ] Авто-створення лідів із форми підбору та B2B/B2G-запитів
- [ ] Pipeline угод (kanban), задачі, історія комунікацій
- [ ] Звʼязок CRM ↔ Orders/Accounts; призначення менеджерів
- [ ] Тести бізнес-логіки воронки

## Phase 6 — Back-office + аналітика
- [ ] Адмін-панель: каталог, ціни, замовлення, користувачі
- [ ] Дашборди: продажі, воронка, конверсія підбору
- [ ] Аудит-лог дій менеджерів

## Phase 7 — Готовність до релізу
- [ ] Безпека: OWASP, rate-limit, CSRF/headers, валідація, секрети
- [ ] Продуктивність: індекси БД, кеш, зображення, Lighthouse
- [ ] SEO (sitemap, robots, schema.org), i18n uk/en, a11y (WCAG AA)
- [ ] Навантажувальні тести; бекап і відновлення БД перевірені
- [ ] Політики: GDPR / ЗУ «Про захист персональних даних», cookie-згода

## Phase 8 — Випуск у прод
- [ ] Середовища dev/staging/prod + керування секретами
- [ ] CI/CD: автодеплой web + api, міграції БД у пайплайні
- [ ] Домен/DNS/TLS, CDN, моніторинг (Sentry + Prometheus/Grafana), алерти
- [ ] Бекапи БД за розкладом + перевірка відновлення
- [ ] Smoke-тести на prod, плейбук відкату (rollback)
- [ ] Запуск 🚀 + пост-реліз спостереження (2 тижні)
