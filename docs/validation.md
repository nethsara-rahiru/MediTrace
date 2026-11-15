# Validation record

## Online barcode identity before confirmation — 15 November 2026

- Automated tests: **115 passed**. New coverage includes unknown EAN identification,
  hidden/unimported facts before Yes, explicit confirmation/cache, rejected and
  late results, local-match priority, manual fallback, unrelated identifiers and
  equivalent padded/unpadded GTIN lookups.
- Full browser suite: **17 passed**, including online-only barcode → proposed name
  → confirmation → details → offline rescan, and rejection followed by a manual
  identity without importing the rejected product's facts.
- TypeScript, formatting and Android JavaScript/Hermes export: passed.
- Live combined barcode filter returned HTTP 200 in a read-only query. No online
  product data was created or modified during testing.
- SQLite schema 8 adds `scan_identity_lookups`. No new Supabase migration or
  application dependency is required.

## Background online identification and source labels — 15 November 2026

- Automated tests: **109 passed**, including exact online matching, conflict
  resolution, offline caching, ambiguous/wrong variants, protected edits, late
  responses, source-check status and exclusion of personal package data.
- Full browser suite: **15 passed**. New flows prove local results remain visible
  during a delayed request, online facts are labelled/cached for an offline scan,
  and unfinished edits survive a background response.
- Rapid repeated date-correction flow passed three consecutive checks after
  disabling a field while its previous correction is being saved.
- TypeScript, formatting and Android JavaScript/Hermes export: passed.
- Live Supabase name and barcode JSON filters returned HTTP 200 for nonexistent
  test identifiers. No product records were written by verification.
- SQLite schema 7 adds persisted per-scan catalog checks. No Supabase migration,
  application dependency or additional backend is required.

## Bundled connection and local-save recovery — 15 November 2026

- Automated tests: **98 passed**. Connection fallback, complete/partial overrides,
  recovery of unqueued products, credential preservation and private-data exclusion covered.
- Publication browser flows: **3 passed**, including visible connection/recovery
  controls, online editing and offline reload/retry.
- TypeScript, formatting and Android export: passed. Android export ran with
  environment-file loading disabled and no Supabase environment overrides; the
  generated Hermes bundle contains the built-in MedTrace project URL.
- A rejected invalid-input probe confirmed the live publication function exists;
  no online product was created. No new SQL migration or dependency is required.

## Direct online product saves — 15 November 2026

- TypeScript, formatting and Android JavaScript/Hermes export: passed.
- Automated tests: **92 passed**. New coverage includes atomic product/outbox
  saves, public-field whitelisting, retry identity, edits, offline persistence,
  stale acknowledgements, barcode conflicts and private-package exclusion.
- Full browser suite: **11 passed**, including immediate publication, editing
  with the same publication ID, offline reload/retry and existing medicine flows.
  Shared fixtures block unmocked Supabase requests; CI uses synthetic connection values.
- Supabase migration 002 executed in isolated PGlite PostgreSQL: direct public
  publication and owner edits succeeded; retries were idempotent; duplicate
  normalized barcodes, cross-device edits, extra personal fields and edits to
  reviewed records were rejected. Public writes could not claim source verification
  or read private write-key hashes.
- Live catalog remained empty during verification. No synthetic production data
  was added. Migration 002 still needs to be applied through the project dashboard.
- SQLite schema 6; SDK-compatible `expo-crypto` added for secure native write tokens.

## Supabase shared catalog — 15 November 2026

- TypeScript, formatting and Android JavaScript/Hermes export: passed.
- Automated tests: **81 passed**, including catalog persistence, conflicts,
  withdrawals, malformed responses, pagination, offline errors and rollback.
- New browser flows: **2 passed**, covering download/reload/offline identification
  and missing-schema/empty-catalog states. Responses were intercepted synthetic data.
- Migration and access policies executed in an isolated PGlite PostgreSQL engine:
  RLS enabled, drafts hidden, approved/withdrawn rows readable, anonymous and
  authenticated writes denied, and missing verification rejected.
- Live project accepted the public key but returned PGRST205 for the missing table.
  Applying the supplied SQL and testing a real download remain dashboard setup steps.
- SQLite schema version 5; no new app dependencies or native modules.

## Single-name confirmation — 14 November 2026

- TypeScript, formatting and Android JavaScript/Hermes export: passed.
- Automated tests: **67 passed**.
- Browser flows: **7 verified**, including hiding alternatives before rejection
  and confirming a replacement name before displaying details.
- No SQL migration, dependency or native-module change.

## Name-detection update — 14 November 2026

- TypeScript and formatting: passed.
- Automated tests: **62 passed**.
- Browser flows: **6 passed**, including mixed unlabelled name/address/code content.
- Android JavaScript/Hermes bundle export: passed.
- No dependency or schema changes. See [name-detection rules](name-detection.md).

## Intelligent identification — 14 November 2026

- TypeScript and formatting: passed.
- Domain, extraction, SQLite and optional-adapter tests: **54 passed**.
- Playwright browser flows: **5 passed**, including offline repeated-save,
  confirmation/deep-link gating, correction, duplicate handling, inventory deletion,
  persisted evidence and mobile layouts.
- Production web export and Android JavaScript/Hermes bundle export: passed.

Fixtures remain synthetic and isolated; no production medicine data is seeded.
[Delivery report](identification-delivery.md) includes the file manifest, schema,
setup, boundaries and remaining device acceptance work. New feature screenshots
show a synthetic scan; the original overview screenshots show an empty catalog.

## Original application — 13 November 2026

Checked on 13 November 2026 in the development workspace with Node.js 24 and
Chromium. These are local results, not claims about a signed Android build or
GitHub Actions runs.

| Check                                                                    | Result       |
| ------------------------------------------------------------------------ | ------------ |
| TypeScript, including unused imports/parameters                          | Passed       |
| Prettier formatting                                                      | Passed       |
| Domain and SQLite integration tests                                      | 14 passed    |
| Browser registration, offline SQL lookup, inventory and persistence flow | Passed       |
| Browser narrow-screen navigation and inert URL handling                  | Passed       |
| Production web export                                                    | Passed       |
| Android JavaScript/Hermes bundle export                                  | Passed       |
| Expo Doctor                                                              | 20/20 passed |

The browser tests use synthetic records in isolated browser contexts. They do not
populate a production medicine catalog. Screenshots show an empty catalog.

The first Expo Doctor attempt could not reach two metadata services directly;
rerunning with Node's environment-proxy support completed all checks successfully.

Outstanding release acceptance: collect/review 30–50 real packaged products,
produce and install an Android APK, test actual camera formats and GS1 separator
preservation, validate native notification delivery, and perform accessibility
checks on a physical Android device. iOS has not been validated. See
[acceptance checklist](acceptance.md).
