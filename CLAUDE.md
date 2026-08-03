# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An automated stock trading bot for the Korea Investment & Securities (한국투자증권, KIS) Open API.

The repo is mid-migration from a **browser-driven** architecture (React SPA polls KIS directly and runs the trading state machine client-side) to a **server-driven** one (`apps/trading-server` runs cron-scheduled auto-trading unattended; the browser app becomes a thin control/monitor surface). Both halves currently coexist:

- **Legacy (still running, unmodified during the migration)**: React SPA (`apps/stock-trading-bot`) + `apps/kis-server` proxy. Watches trading-volume-ranked stocks, auto-buys based on configurable criteria, auto-sells at configured profit/loss percentages — all client-side, only while the browser tab is open.
- **New (active development)**: `apps/trading-server` — see "Server-side auto-trading" below. Owns KIS credentials itself, runs 4 independent entry strategies + a shared trailing-stop exit, exposes a REST API, and sends Discord notifications. `apps/trading-control` is the REST client for it (see "Control frontend" below).

## Repo layout

Nx monorepo (npm workspaces, Nx 17), one `tsconfig.base.json` with path aliases:

- `apps/stock-trading-bot` — the React 18 SPA (Vite, styled-components, Recoil). Entry: `src/main.tsx` → `src/app/app.tsx`. **Legacy** — calls KIS directly from the browser via `apps/kis-server`.
- `apps/kis-server` — Express proxy (`src/main.mjs`) that forwards `/api-proxy/*` to `openapi.koreainvestment.com:9443`, injecting `appkey`/`appsecret`/`authorization` headers from whatever the browser sends. Exists solely to get around KIS API host/CORS restrictions from the browser. Kept running as-is for the legacy FE; `apps/trading-server` does **not** go through it (see below).
- `apps/trading-server` — Express + Prisma/Postgres app that owns KIS credentials and runs auto-trading unattended on a cron schedule. See "Server-side auto-trading" below.
- `apps/trading-control` — React 18 SPA (Vite, styled-components) that's the REST client for `apps/trading-server`, meant to be loaded in an Android WebView. See "Control frontend" below.
- `services/trading` (`@services/trading`) — legacy FE trading feature: pages (`Main`, `AdvanceOrder`, `LogCenter`), hooks, and the `SellByPercent` trading strategy. Not used by `trading-server` (that app has its own parallel, DB-backed reimplementation under `apps/trading-server/src/trading/`).
- `shared/apis/kis` (`@shared/apis/kis`) — legacy FE's KIS REST API client (axios + browser-localStorage token cache). `trading-server` does **not** import this (browser-only globals); it has its own client under `apps/trading-server/src/kis/`.
- `shared/states/global` (`@shared/states/global`) — Recoil atoms and the `TradingStrategy` abstract class; app config and order-list state, persisted via `local-store`.
- `shared/hooks/api-hook` / `shared/hooks/util-hook` — `useKisApi` (fetch+cache+session-retry wrapper around KIS API functions) and small utility hooks (`useStateRef`, rerender).
- `shared/ui/design-system-v1` — shared styled-components UI kit (layout primitives, buttons, toast, routing components).
- `shared/utils/date`, `shared/utils/localstorage` — small standalone utilities (`ObjectBasedLocalStore`, `ListBasedLocalStore`).

Path aliases (see `tsconfig.base.json`) map each `shared/*`/`services/*` library to its `src/index.ts` barrel — always import from the alias (e.g. `@shared/apis/kis`), not by relative path across project boundaries. `apps/trading-server` is a standalone Express app and doesn't use these aliases (plain relative imports within `apps/trading-server/src/`).

## Legacy architecture / data flow (apps/stock-trading-bot, browser-driven)

1. **`CheckBalance`** (`shared/apis/kis/src/run-process/check-balance.ts`) is a singleton poller: once it has listeners, it calls `InquireBalance` on a 1s `setTimeout` loop and fan-outs the result to all registered listeners. Started/stopped once in `App` via `CheckBalance.run()` / `.destroy()`.
2. **`TradingStrategy`** (`shared/states/global/src/order/abstract/trading-strategy.ts`) is an abstract state machine (`checking → watching-for-sell → sell-waiting → done|error`) per stock code. `SellByPercent` (`services/trading/src/trading-strategy/sell-by-percent.ts`) is the concrete strategy: it registers `CheckBalance` listeners at each state to react to balance/price changes, places market sell orders via `OrderCache` when a high/low % target is hit, and calls `removeOrderToday()` when done.
3. **`useKisApi`** (`shared/hooks/api-hook`) wraps a KIS API function with React state, an in-memory response cache keyed by `JSON.stringify(request)`, and automatic retry (up to 5x) when the API responds with a `nosession` code (stale token).
4. **Recoil state** (`shared/states/global`) holds `OrderDate`/`OrderStocks`/`OrderTrading` (today's order list, persisted to localStorage via `OrderListStore`) and `AppConfig` (trading parameters: refresh rate, working hours, buy/sell %, order amount limits — persisted via `ObjectBasedLocalStore`).
5. **Token handling**: `axios-instance.ts` reads a cached token from `window.localStorage['kis-token']`, refreshes it via `oauth2/tokenP` when missing or when the API returns a session-expired error code (`EGW00121`/`EGW00123`), and rebuilds the axios instance with the new token.
6. All KIS request bodies/headers use the API's native field names (e.g. `PDNO`, `ORD_QTY`, `tr_id`) — these correspond 1:1 to KIS Open API documentation, not internal conventions.

## Server-side auto-trading (apps/trading-server)

Express + Prisma/Postgres app, structurally independent from the rest of the monorepo (no `@shared/*` imports — see Repo layout above). Calls `openapi.koreainvestment.com:9443` (real) / `openapivts.koreainvestment.com:29443` (paper) directly; does not go through `apps/kis-server`.

**KIS client** (`apps/trading-server/src/kis/`): `env.ts` resolves `KIS_ENV` (`paper` default | `real`) to the matching `KIS_REAL_*`/`KIS_PAPER_*` env vars, or takes an explicit override; `tr-id.ts` maps buy/sell/balance tr_id per env (`V`-prefix paper vs `T`-prefix real — paper also uses the plain `inquire-balance` endpoint instead of `inquire-balance-rlz-pl`, since realized-P&L isn't available on paper accounts). `client.ts` owns access tokens itself (persisted in the `kis_tokens` table, not browser localStorage), cached **per env** (`Map<KisEnvName, ...>`) rather than a single instance — `fetchBusinessDay` (chk-holiday) is hardcoded to always call with `real` credentials regardless of the active `KIS_ENV`, because that tr_id isn't available on paper accounts at all (confirmed by hitting it live — `EGW02006 모의투자 TR 이 아닙니다`), so a `paper`-mode process still needs a live `real` client alongside its `paper` one. Every request from `getKisClient()`'s axios instance is paced through `request-queue.ts` (env별 최소 요청 간격 강제, `KIS_RATE_LIMIT_REAL_MS`/`KIS_RATE_LIMIT_PAPER_MS`로 override) to stay under KIS's official REST rate limit (API Portal 공지, 2026-04-20 기준: 실전 초당 18건 / 모의 초당 1건, 계좌 단위) — a still-rejected `EGW00201` response is retried a few times with backoff as a last resort. `quotations.ts` wraps the KIS ranking/status endpoints — see Strategies below for which one feeds which.

**Known gotcha (2026-08-03 incident, multi-part)**: a burst of ~13 VI-triggered buys right at market open, on top of the 1s `BalancePoller` loop, tripped KIS's paper-account rate limit on one sell order. `placeMarketOrder` had no try/catch, the exception became an unhandled promise rejection (the `BalancePoller` listener that threw is async — `tick()`'s `try/catch` only catches *synchronous* throws from a listener call, not rejections from its returned promise), and with no `process.on('unhandledRejection'/'uncaughtException')` handler anywhere the whole process died with zero trace (no DB row, no Discord message) — leaving every open position frozen mid-state for hours. First fix: the rate-limit queue above, wrapping every `placeMarketOrder` call site (`position-watcher.ts`'s `watchForSell`/`forceSell`, `execute-buy.ts`) in try/catch → `fail()`/`buy_failed`, and a `process.on(...)` safety net in `main.ts`.

That safety net immediately exposed two deeper bugs on the very same day. (1) KIS returns most business errors — including rate-limit rejections — as **HTTP 200 with `rt_cd:'1'` in the body**, not an HTTP-level error, so the original retry logic (hung off axios's error/reject handler) never actually fired, and the specific code that hit was `EGW00215` anyway, not the `EGW00201` that was handled. Worse, `inquireBalance()` read `res.data.output1` without checking `rt_cd` first, so a rate-limited call silently became "0 holdings" — fanned out via `BalancePoller` to every listener at once, causing every open position to be mistaken for a manual sell in the same tick. Fixed by `kis/client.ts`'s `assertKisSuccess()` (checked in `inquireBalance()` and every `quotations.ts` fetcher) plus a **success-branch** interceptor check for rate-limit codes (`EGW00201`/`EGW00215`), since the error-branch one alone never triggers for this class of failure. (2) Separately, a transient DB hiccup right at boot (`P1001`, Prisma pool not yet warm) made `resumeTodaySessionIfNeeded()` throw *before* `startTradingCron()` ran in `main.ts` — the unhandled-rejection net kept the process alive, but the 09:00/15:25/16:00 cron schedule was simply never registered for that process's entire lifetime, so that day's forced-liquidation and session-close silently never fired even though trading itself kept working fine. Fixed by wrapping the *entire* boot sequence (`BalancePoller.run()` → DB-readiness check with retry, up to 30s → `resumeTodaySessionIfNeeded()` → `startTradingCron()`) in one try/catch in `main.ts`: any failure sends a Discord alert and calls `process.exit(1)` rather than continuing in a half-initialized state — deliberate, since Jenkins reports deploy success purely from the container starting, so this is the only point that can surface an app-level boot failure. Also surfaced in the same incident: `lib/date.ts`'s day/time helpers used to derive "today"/"now" from the process's local system-TZ getters with no `TZ` pinned anywhere in the Dockerfile/Jenkins deploy command — it happened to line up with KST that day, but isn't guaranteed, so it's now computed explicitly via `Intl.DateTimeFormat({ timeZone: 'Asia/Seoul' })` regardless of the host's actual system TZ.

**Cron schedule** (`src/cron/schedule.ts` + `session.ts`, `node-cron`, `Asia/Seoul`, weekdays only): `09:00` opens today's `trading_sessions` row (checks business day via KIS, starts all 4 strategy scanners + the foreign-institution cache) → `15:25` stops new-order scanning and force-sells (`PositionWatcher.forceSell`) every still-open position ahead of the `15:30` market close → `16:00` marks the session closed (open `PositionWatcher`s / `BalancePoller` are left running regardless — the exit side doesn't stop on a clock). On boot, `resumeTodaySessionIfNeeded()` re-attaches in-memory watchers/scanners if the process restarted mid-session (crash/redeploy).

**Entry strategies** (`src/trading/*-scanner.ts`), all independently toggleable via `TradingConfig` and all funneling into the same `executeBuy()` (`execute-buy.ts`) → same `PositionWatcher` exit:
- `scanner.ts` — 거래대금순위 (KIS `volume-rank`, `FID_BLNG_CLS_CODE=3`), optionally required to also appear in `foreign-institution-cache.ts`'s 5-min-refreshed 외국인/기관 순매수 상위 list (`requireForeignInstitutionNetBuy`).
- `vi-scanner.ts` — VI(변동성완화장치) release momentum: KIS `inquire-vi-status`, buys codes released within the last 3 minutes (`viStrategyEnabled`).
- `gap-scanner.ts` — opening gap-up: KIS `ranking/fluctuation` doesn't expose 시가 directly, so it's derived from `prdy_ctrt` (vs prev close) and `oprc_vrss_prpr_rate` (vs today's open) returned on the same row; only runs for `gapScanWindowMinutes` after session open, then self-stops (`gapStrategyEnabled`).
- Each scanner keeps its own same-day dedup pool (`passedCodes` / `viActedCodes` on `trading_sessions`) but all three share one `getOrderedCodesToday()` check (`session-orders.ts`) so they never double-buy the same code.

**Exit** (`src/trading/position-watcher.ts`): per-position state machine (`checking → watching_for_sell → sell_waiting → done|error`), one row per `Order` in `position_watchers`. Take-profit (`sellAmtHigh`) is fixed at entry; stop-loss (`sellAmtLow`) trails a tracked high-water mark (`peakPrice`) upward as price rises and never retreats. Reacts to `BalancePoller` (`balance-poller.ts`, the server-side `CheckBalance` equivalent — one 1s poll loop for the whole process, active only while it has listeners).

**Persistence**: Postgres via Prisma (`prisma/schema.prisma`, migrations in `prisma/migrations/`). `TradingConfig` is a singleton row (id=1) holding everything the AdvanceOrder screen used to control, plus per-strategy on/off + threshold fields. `Order`.`sourceStrategy` tags which scanner bought a position (`'volume_rank' | 'vi_release' | 'gap_up'`). `TradeEvent` is the append-only log (buy/sell/error/session boundaries).

**Notifications** (`src/notify/discord.ts` + `src/trading/log-trade-event.ts`): `logTradeEvent()` is the *only* place code should write to `trade_events` — it wraps the Prisma insert and, for `session_start`/`session_end`/`buy_executed`/`sell_executed`/`forced_liquidation`/`sell_failed`/`error`, also sends a color-coded embed to `DISCORD_WEBHOOK_URL` (no-ops silently if that env var is unset — a notification failure must never block trading). The embed description includes the stock name next to the code (`[name(code)]`) via an optional `name` on `LogTradeEventInput` — formatting-only, stripped before the Prisma write since `TradeEvent` has no `name` column (`Order.name` is the source of truth). `sell_executed`'s message also includes realized P&L, computed from the live KIS `pchs_avg_pric` at sell time (not `Order.buyPrice`, which is only the entry-strategy's reference price and can diverge from the actual market-order fill — see the VI-momentum note above). `buy_failed` is still recorded but not notified — it includes routine rejections (e.g. 매매불가 종목) common enough that alerting on every one isn't useful yet. `closeTodaySession()` (`cron/session.ts`) additionally builds a same-day summary (`buildSessionSummary`) — buy count / done vs still-open sell count / estimated realized P&L, computed by joining `sell_executed`/`forced_liquidation` event payloads back to `orders.buyPrice` by code — and includes it in the session_end message. **Known gotcha**: `PositionWatcher` needs to pass `sessionId` into every `logTradeEvent()` call itself (it snapshots `sessionId`/`name` at construction, same pattern as the entry-percentage snapshot) — until 2026-08-03 it didn't, so every `sell_executed`/`error`/`forced_liquidation` event was written with `sessionId = NULL` and silently excluded from `buildSessionSummary`'s per-session query (buy-side events were unaffected — `execute-buy.ts` always passed it correctly). Any new call site that logs an event tied to a specific position must go through `PositionWatcher`'s own `sessionId`, not assume it's optional.

**REST API** (`src/http/`, mounted at `/api`): every route requires an `x-api-key` header matching `API_TOKEN` — **fail-closed**, i.e. if `API_TOKEN` isn't set the whole API 500s rather than opening up. `GET /status`, `GET/PUT /config`, `GET /positions` + `POST /positions/:code/force-sell`, `GET /orders`, `GET /events`, `POST/DELETE /devices` (FCM token registry — registration only, nothing actually sends an FCM push yet; live trade/session alerts go out via the Discord webhook above instead).

## Control frontend (apps/trading-control)

React 18 SPA (Vite, styled-components) — a REST client for `apps/trading-server`'s `/api/*`, nothing else; it does not talk to KIS directly. Meant to be loaded inside an Android WebView (native shell/bridge is a separate project, out of this repo's scope).

- `src/api/client.ts` — thin `fetch` wrapper that attaches `x-api-key: VITE_TRADING_SERVER_API_TOKEN` to every call against `VITE_TRADING_SERVER_HOST`.
- Pages (`src/app/pages/`): `DashboardPage` (status + positions, 5s poll, force-sell button), `ConfigPage` (GET/PUT the `TradingConfig` row via an `@mint-ui/core` `Table` form, including `formType: 'check'` for the boolean strategy toggles), `LogsPage` (`trade_events`, 5s poll).
- Reuses `@mint-ui/core` (the same third-party component kit `services/trading` uses) plus only the *generic* pieces of `shared/ui/design-system-v1` — `GlobalStyleV1`, `MainToastContextProvider`/`useShowToastHook`, `ComponentRoutes`/`ComponentRoute`/`ComponentRouteLink`. Deliberately does **not** reuse `AppContainer`/`PageContainer`/`Header`/`Footer`: `Footer` hardcodes the legacy app's own menu items and `PageContainer` is wired to Recoil's `PageState`, so `trading-control` has its own minimal shell (`app.tsx`) instead and carries no Recoil dependency at all.
- Two bugs found and fixed here that affect any future consumer of these shared libs: `shared/ui/design-system-v1`'s `routes/index.ts` barrel was missing `export * from './ComponentRouteLink'` (legacy code worked around it with a relative import instead of the alias). `@mint-ui/core`'s `Flex` defaults to `height: 100%; overflow: auto;` when `flexHeight`/`flexOverflow` aren't passed, which clips column-stacked content with more than ~2 rows — worth remembering when composing new layouts with it (`trading-control`'s local `Card` component sets `flexHeight='fit-content'` to opt out).

## Deployment (Jenkins on the home server)

`apps/trading-server` deploys via a shared Jenkins instance at `home.ribs.kr:10000` (also hosts an unrelated project, "ribs" — its jobs were the template for these). Not part of this repo, but documenting the conventions here since the job definitions are the actual source of truth for how this app runs in production:

- **Jobs**: `build-trading-server` (checks out the `feature/2026-new-bot` branch → `npm ci` + `npm run db:generate` + `npm run build-trading-server` + `npm run image-trading-server`, i.e. `docker build -t trading-server:latest`) → on SUCCESS auto-triggers `deploy-trading-server` (`docker rm -f trading-server` then `docker run` with secrets injected as `-e VAR=$VAR`, `-p 3364:3364`) → `stop-trading-server` (`docker stop trading-server` — the fast kill-switch if something looks wrong; posts to Discord either way).
- **Credentials**: every secret `.env.local` value trading-server needs is duplicated into Jenkins as a Secret-text credential prefixed `TRADING_` (e.g. `TRADING_DATABASE_URL`, `TRADING_KIS_PAPER_APP_KEY`, `TRADING_DISCORD_WEBHOOK_URL`), bound in `deploy-trading-server`'s `SecretBuildWrapper`. Non-secret values (`KIS_REAL_HOST`/`KIS_PAPER_HOST`/`HOST`/`PORT`, and **`KIS_ENV=paper`**) are hardcoded directly in the job's shell command instead of round-tripped through a credential — `KIS_ENV` in particular is deliberately not a credential so it can't be silently left on `real`.
- **Known gotcha**: `POST /job/<name>/config.xml` (in-place job update via the Jenkins REST API) 500s under this instance's permission setup, even though `createItem`/`doDelete`/credential management all work fine with the same token. The working pattern is delete-then-`createItem` instead (fine here — these jobs carry no build history worth preserving).
- **Known gotcha**: the Dockerfile's `prisma generate` step must pin the same Prisma version as `package.json`'s `"prisma"` devDependency (currently `6.19.3`). An unpinned `npx prisma generate` grabs whatever's newest on the registry at image-build time — Prisma 7 dropped the `datasource.url`-in-schema syntax this project's `schema.prisma` uses, so an unpinned build breaks (this happened on the very first real deploy).
- **Port**: 3364 (container and host). 3363 was tried first but the home network's port-forwarding was already pointed at the unrelated "ribs"/sisulbot service.

## Commands

Run everything from the repo root via `nx` (or `npx nx` if not installed globally); project names come from each `project.json` (`stock-trading-bot`, `kis-server`, `trading-server`, `trading-control`, `trading`, `kis`, `api-hook`, `util-hook`, `global`, `design-system-v1`, `date`, `localstorage`).

```bash
# Frontend app (dev server, port 4200)
npm start                          # = nx serve stock-trading-bot
npm run build                      # = nx build stock-trading-bot, then after.mjs copies dist into an Android assets folder (path hardcoded — irrelevant off that machine)

# Proxy server (dev, defaults to port 3000) — legacy, used only by apps/stock-trading-bot
npm run server                     # = nx serve kis-server
npm run build-server               # = nx build kis-server
npm run image-server               # docker build using apps/kis-server/Dockerfile
nx docker-build kis-server         # alternative docker build target defined in project.json

# Trading server (dev, defaults to port 3001)
npm run server-trading              # = nx serve trading-server
npm run build-trading-server        # = nx build trading-server
npm run image-trading-server        # docker build using apps/trading-server/Dockerfile
npm run db:generate                 # prisma generate (schema: apps/trading-server/prisma/schema.prisma)
npm run db:migrate                  # prisma migrate dev — needs DATABASE_URL in .env.local
npm run db:deploy                   # prisma migrate deploy (non-interactive, for CI/deploy)

# Control frontend (dev server, port 4201)
npm run start-control                # = nx serve trading-control
npm run build-control                # = nx build trading-control

# Lint (per-project; also runs via nx affected)
npx eslint --fix .                 # = npm run fix
nx lint <project>
nx affected -t lint --base=main    # see affected.defaultBase gotcha in the Tests notes below

# Tests
nx test trading                    # services/trading — Jest
nx test <shared-lib-name>          # shared libs (kis, api-hook, util-hook, global, design-system-v1, date, localstorage) — Jest
nx test stock-trading-bot          # apps/stock-trading-bot — Vitest
nx test <project> --testFile=<pattern>   # single test file (Vitest projects)
nx affected -t test --base=main    # run tests for everything touched vs main
```

Notes:
- Both React apps (`stock-trading-bot`, `trading-control`) use **Vitest** (`@nx/vite:test`); `services/trading` and every `shared/*` library use **Jest** (`@nx/jest:jest`) — check `project.json`'s `test` target before assuming which runner applies. `trading-server` and `trading-control` have test targets wired up (Jest and Vitest respectively) but no test files exist yet in either.
- `nx.json`'s `affected.defaultBase` is stale (`"master"`, a branch that doesn't exist in this repo — the real default branch is `main`), so plain `nx affected ...` fails with a git revision error; always pass `--base=main` (or `--base=origin/main`) explicitly.
- Nx caches `build`/`lint`/test targets; if output looks stale, add `--skip-nx-cache`.
- `.env.local` (git-ignored, shared by both Vite apps and `trading-server`'s `dotenv.config()`) holds all secrets/config; **`.env.example` at the repo root is the checked-in, secret-free spec** — every var name, what it's for, its expected format, and where to obtain it (KIS appkey/secret/CANO come from the KIS developer portal — real and paper are separate applications with separate keys). New machine setup: `cp .env.example .env.local` then fill in real values. Never commit real values or print them.
- `JENKINS_API_TOKEN` also lives in `.env.local` (paired with the `goju2k` Jenkins user for Basic Auth) but isn't in `.env.example` — it's only used to script Jenkins job/credential setup from this machine (see Deployment below), no app code reads it.

## Conventions

- ESLint config (`.eslintrc.json`) extends `airbnb`/`airbnb/hooks`; notable non-default rules: single-quote JSX (`jsx-quotes: prefer-single`), always-multiline trailing commas, 2-space indent, no final newline (`eol-last: never`), enforced `import/order` (external → builtin → internal → sibling → parent → index, alphabetized, blank line between groups), `no-unused-vars`/`no-shadow` handled by the TS-aware variants only.
- Styling is styled-components throughout (Nx generator default is set to `"style": "styled-components"` in `nx.json`); new components/libraries generated with `nx g @nx/react:component|library` will inherit this.
- Korean-language inline comments and UI strings are used throughout the trading logic to describe domain behavior (state meanings, order semantics) — match this when touching those files.
- When adding/changing a KIS endpoint call in `apps/trading-server/src/kis/`, verify the exact `tr_id`/path/param names against KIS's own example code (`gh api repos/koreainvestment/open-trading-api/contents/examples_llm/domestic_stock/<endpoint>/<endpoint>.py`) rather than guessing — KIS's docs and field-naming aren't fully consistent across endpoints (e.g. `mksc_shrn_iscd` vs `stck_shrn_iscd` for "종목코드" depending on which ranking API). This is how every tr_id currently in the codebase was confirmed.
