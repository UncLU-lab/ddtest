# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NestJS + PostgreSQL (TypeORM) backend for "Demurrage Defender" — a system for tracking bulk shipping (voyages, charter parties, laytime/demurrage calculations) and container shipping (shipments, free-time clocks, demurrage & detention invoices).

Entities exist for all three domains. The **bulk / tramp shipping** domain also has a full REST API; `container/` and `cross-cutting/` are still entities only. There is no authentication yet — every route is public, pending Firebase bearer-token verification.

## Commands

```bash
npm run start:dev          # run with watch mode
npm run start:debug        # run with debugger + watch mode
npm run build               # nest build
npm test                    # unit tests (jest, rootDir: src, *.spec.ts)
npm test -- <pattern>       # run a single test file/suite, e.g. npm test -- voyage
npm run test:watch
npm run test:cov
npm run test:e2e            # e2e tests (test/*.e2e-spec.ts, separate jest config)
npm run test:debug          # debug unit tests with --inspect-brk
npm run lint                # eslint --fix on src/apps/libs/test
npm run prettier             # check formatting; prettier:fix to write
npm run check                # lint + prettier check + tests (--runInBand) + build — run before considering work done
```

Migrations (TypeORM CLI, config from `typeorm.config.ts`):

```bash
npm run migration:generate --name=<Name>   # generate from entity changes
npm run migration:create --name=<Name>     # empty migration
npm run migration:up                        # run pending migrations
npm run migration:down                      # revert last migration
npm run migration:show
```

Commits must follow Conventional Commits (enforced by commitlint + husky commit-msg hook); `npm run commit` launches the interactive `git-cz` prompt.

## Architecture

### Entity registration

- All persistence is TypeORM entities under `src/modules/<domain>/entities/*.entity.ts`.
- Every entity is registered by hand in `src/database/entities/index.ts` (`databaseEntities` array) and consumed by `src/config/database.config.ts` as `entities: [...databaseEntities]`. **When adding a new entity, add it to this array** — nothing is auto-discovered by glob. Feature modules separately list the entities they inject via `TypeOrmModule.forFeature([...])`.
- `src/database/entities/entities.spec.ts` asserts the exact list of table names produced by `databaseEntities`. When adding/renaming/removing an entity, update this test's expected array to match.
- All entities extend `UuidEntity` (`src/database/entities/base.entity.ts`), which supplies a `uuid` primary key named `id`.

### Three domain areas under `src/modules/`

- `bulk/` — bulk/tramp shipping: `Vessel`, `Voyage`, `CharterParty`, `CpClause`, `SofDocument`, `SofEvent`, `NorDocument`, `LaytimeCalculation`, `CalculationPeriod`, `DisputeCaseBulk`, `Counterparty`.
- `container/` — container/liner shipping: `Container`, `Shipment`, `ShipmentContainer`, `ContainerMilestone`, `CarrierTariff`, `FreeTimeClock`, `DdInvoice`, `DdInvoiceLine`, `DisputeCaseContainer`.
- `cross-cutting/` — shared concerns: `User`, `AuditLog`, `AiInteraction`, `FeedbackSignal`, `KnowledgeBaseChunk`.

`container/` and `cross-cutting/` still contain only an `entities/` folder. When building them out, mirror `bulk/`: a `<domain>.module.ts` importing `TypeOrmModule.forFeature([...])`, with one folder per resource inside it.

### The bulk API layer

`BulkModule` (`src/modules/bulk/bulk.module.ts`) registers one folder per resource — `vessels/`, `voyages/`, `charter-parties/`, `sof-documents/`, `nor-documents/`, `laytime-calculations/`, `disputes/`, `counterparties/` — each holding a controller, a service, and a `dto/` folder.

- Routes are served under the `api/v1` global prefix set in `main.ts`, alongside a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). DTOs rely on that pipe running, so `@Type(() => Number)` is what makes numeric query/body fields arrive as numbers.
- Controllers whose resource spans several URL roots (e.g. `sof-documents` also owns `PATCH /sof-events/:eventId`) use a bare `@Controller()` and put the full path on each method, so routes map one-to-one onto the API spec.
- All list endpoints return `{ data, meta: { page, limit, total } }` via `paginate()` in `src/common/dto/paginated.ts`; their query DTOs extend `PaginationQueryDto`, whose `skip` getter feeds TypeORM.
- `src/modules/bulk/bulk.module.spec.ts` asserts the exact set of registered routes against the documented endpoint list, with repositories and `DataSource` mocked. **Adding or renaming a bulk route requires updating `EXPECTED_ROUTES` there.**
- `BulkModule` is imported by `AppModule` only when `DB_ENABLED=true`, since its services need repositories.
- DECIMAL columns surface as strings through TypeORM; services convert with `.toFixed(2)` on write. `interval` columns use `intervalTransformer` (`laytime/interval.util.ts`) so they stay strings on read instead of becoming `pg` interval objects.

### The laytime engine

`src/modules/bulk/laytime/laytime.engine.ts` is a pure function — no NestJS or TypeORM — taking NOR documents, SOF events, charter-party clauses, and cargo quantity, and returning allowed/used laytime, money, and the `calculation_periods` timeline. `LaytimeCalculationsService` loads the inputs, calls it, and persists the result as the next `version`; `LaytimeEngineError` maps to HTTP 422.

- Understood clause types: `laytime_rate`, `demurrage_rate`, `despatch`, `shex_shinc`. Anything else is ignored and reported through the `warnings` array returned by `POST /voyages/:voyageId/laytime-calculations` (warnings are response-only — there is no column for them).
- Not modelled: WIBON, reversible laytime, weather working days, turn time, and "once on demurrage, always on demurrage".
- Recognised SOF event types are the `COMPLETION_EVENTS` / `STOPPAGE_START_EVENTS` / `STOPPAGE_END_EVENTS` sets at the top of the engine — extend those rather than special-casing at the call site.
- Calculations prefer events from `Final` SOF documents, falling back to drafts with a warning.

### Entity conventions

- `@Entity('snake_case_table_name')`; every `@Column` that isn't already snake_case gets an explicit `name: 'snake_case'`.
- Table/column check constraints and indexes are declared via decorators on the entity class (`@Check(name, sql)`, `@Index(name, columns)`), not in raw migrations — keep the constraint name pattern `chk_<table>_<field>` / `idx_<table>_<field>`.
- Enum-like string fields are declared as a `const` array plus a derived union type (e.g. `VOYAGE_STATUSES` / `VoyageStatus`). The array is the single source of truth: the entity's `@Check` constraint is built from it, and DTOs validate with `@IsIn(VOYAGE_STATUSES)`. Add a value in one place only.
- Because `isolatedModules` + `emitDecoratorMetadata` are on, a union type used as a decorated property's type must be imported with `import type` — DTOs therefore import the const array and the type in two separate statements from the same module.
- Relations are declared on both sides where practical (`@ManyToOne`/`@OneToMany`, `@OneToOne`), with the FK column also exposed as a plain `@Column` (e.g. `vesselId` alongside the `vessel` relation) so the id is usable without loading the relation.
- `createdAt`/`updatedAt` use `@CreateDateColumn`/`@UpdateDateColumn` with `type: 'timestamptz'`.

### Configuration

- Env vars are loaded from `.env.${NODE_ENV}` then `.env` (see `.env.example`) via both `dotenv.config()` directly and Nest's `ConfigModule.forRoot`.
- `DatabaseModule` (`src/database/database.module.ts`) is `@Global()` and only imported into `AppModule` when `DB_ENABLED=true`; with it unset/false the app runs with only `AppController`/`AppService` and no DB connection — useful for exercising non-DB routes without Postgres running.
- `src/config/database.config.ts` builds `TypeOrmModuleOptions` from env: `DATABASE_URL` takes precedence over discrete `DB_HOST`/`DB_PORT`/etc. `synchronize` and `dropSchema` are hardcoded `false` — schema changes always go through migrations.
- `typeorm.config.ts` (repo root) is the DataSource used by the TypeORM CLI for migrations; it reuses the same `database.config.ts` factory.
