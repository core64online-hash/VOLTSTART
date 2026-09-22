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
- [ ] Перша Prisma-міграція згенерована в оточенні з БД

## Phase 1 — Каталог + Підбір
- [ ] Моделі Product/Category/Brand/ProductSpec/InventoryItem + міграції
- [ ] CRUD API каталогу + сідінг демо-даних
- [ ] Інтеграція Typesense + синхронізація індексу (BullMQ job)
- [ ] Фронт: список каталогу з фасетними фільтрами, сторінка товару, SEO
- [ ] EquipmentPreset (профілі навантаження типової техніки)
- [ ] Форма підбору (UI) → `/api/selector/calculate` → ранжований список
- [ ] Тести: розрахунок потужності (є), E2E пошук і підбір

## Phase 2 — Акаунти, сегменти, ціни
- [ ] Auth (реєстрація/логін/скидання паролю), сесії, ролі RBAC
- [ ] Organization + типи; верифікація ЄДРПОУ/VAT
- [ ] Pricing-движок: PriceList/Price за сегментом і валютою
- [ ] Кабінети профілю за сегментами (B2C/B2B/B2G)
- [ ] Тести доступів (RBAC) і коректності цін за сегментом

## Phase 3 — Кошик, checkout, платежі
- [ ] Cart/CartItem, розрахунок вартості, ПДВ, доставка
- [ ] `PaymentProvider`: WayForPay/LiqPay + Stripe
- [ ] Webhooks + звірка статусів (ідемпотентність, перевірка підписів)
- [ ] Гілки checkout: B2C (карта) vs B2B/B2G (рахунок)
- [ ] Тести оплат у sandbox

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
