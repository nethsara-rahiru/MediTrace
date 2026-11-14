# Intelligent identification delivery

Completed within the existing React Native / Expo / SQLite application. No new
runtime dependencies, backend, API key or production medicine seed data were
introduced. The original theme, library, inventory, reminders and scan history
remain in use.

## Delivered behavior

- QR/barcode scans enter a persistent identity-only confirmation screen before
  any package fields are shown. Review and history deep links enforce this gate.
- Users can accept, reject, select another candidate, search local products, enter
  a corrected identity or scan again. A changed identity/strength clears the
  previous formulation's attributes and repeats the database lookup.
- Review exposes ingredients, strength/form identity, manufacturer/address,
  batch, manufacture/expiry dates, identifier, serial and original extra data.
  Fields can be individually checked, corrected or mapped to a literal scanned
  token. The raw scan and original extraction remain immutable.
- Product/source status, parser confidence and user confirmation are distinct.
  A packaging check is mandatory before saving; confirming a name does not verify
  ingredients or other fields. Uncertain/ambiguous dates are never ordered by guess.
- Saves are transactional and duplicate-aware. Repeated serials preserve quantity,
  conflicting pack details require an explicit choice, and similar packs without
  serials require choosing reuse versus a separate physical pack.
- Two distinct reviewed examples are required for local format reuse. Contradictory
  mappings are quarantined. No learned mapping becomes globally trusted.

## Updated schema

Version 4 migrates existing installations without a reset. Existing `products`,
`ingredients`, `product_ingredients`, `barcodes`, `user_medicines` and `scan_history`
are reused. Additions include manufacturer address, manufacture date/serial,
per-field evidence, original/reviewed extraction snapshots, confirmation state,
scan token, inventory link and barcode-source scan link. New
`qr_format_templates` and `template_observations` tables retain structural rules
and distinct supporting payloads.

See [the schema and extraction guide](intelligent-identification.md) and
[the migration source](../src/data/schema.ts) for columns, indexes, constraints and
foreign keys.

## Extraction algorithm

The offline pipeline combines exact identifiers and previously reviewed local
payloads; GS1/Digital Link decoding; labelled/keyword and bounded JSON parsing;
validated local templates; unlabelled pattern recognition; local ingredient/name
matching; and bounded fuzzy candidate ranking. Explicit field labels do not
establish medical truth. Missing values stay null in extraction. Literal amounts
in combination strengths are preserved, without computing a new dose or strength.

General URLs remain inert. Unsafe JSON keys, duplicate keys, oversized/deep input,
malformed dates and invalid numeric check digits are handled without execution.
See [algorithm details and limitations](intelligent-identification.md).

## Verification results — 14 November 2026

| Check                                                 | Result    |
| ----------------------------------------------------- | --------- |
| TypeScript with strict and unused-symbol checks       | Passed    |
| Domain, extraction, SQLite and optional-adapter tests | 54 passed |
| Playwright browser flows                              | 5 passed  |
| Formatting                                            | Passed    |
| Web production export                                 | Passed    |
| Android JavaScript/Hermes bundle export               | Passed    |

Coverage includes labelled/unlabelled and reordered text, nested JSON, missing
names, competing/fuzzy identities, rejection and corrections, GS1/1D codes,
malformed/malicious input, ambiguous and expired dates, duplicate scans/packs,
true SQLite reopen persistence, migrations preserving legacy records, local
format reuse/quarantine, and optional AI no-consent/failure/invalid-response/abort
boundaries. Browser checks cover gated details, manual fixes, a repeated save
while offline after loading the app, phone layouts, source-token selection and
retention of scan evidence after inventory deletion. The original application
registration/inventory/history flows also pass.

These are local automated results, not claims of physical-device camera testing,
a signed APK, iOS validation or a completed GitHub Actions run.

## Setup and configuration

Use Node.js 24 and the existing lockfile:

```sh
npm ci
npm start
```

For a compatible Expo Go client, use `npm start -- --go`. For browser preview use
`npm run web`. Existing databases migrate automatically; do not clear app data.
No new environment variables or services are required.

Checks:

```sh
npm run typecheck
npm test
npm run format:check
npm run export:web
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium` for browser tests.
Existing EAS profiles remain available for an Android development/preview build.
An Expo account/project and physical device are required for signed-build and
camera/notification acceptance checks.

## AI and external dependencies

No AI provider was present in the existing app and none is configured now. There
is no AI UI action, client API key or automatic outbound extraction request. A
tested optional adapter utility accepts only explicit consent, bounded raw text
and schema/literal-evidence-validated output, with timeout/abort fallback. A future
provider requires its own protected backend and real consent flow before use.
All current user flows work without that adapter.

## Known limitations

- Real packaging records must still be collected and reviewed; synthetic test
  fixtures and screenshots are not a production medicine dataset.
- Unknown unlabelled brand/ingredient roles and unsupported date forms may need
  manual interpretation. Keyword aliases are primarily English; there is no
  automatic clinical translation or universal manufacturer-format database.
- Native DataMatrix/GS1 separator preservation, actual small/reflective packaging,
  notification delivery and accessibility still need Android-device testing.
- User confirmation and local template reuse do not establish authenticity,
  independently verified medical correctness or personal suitability.
- The browser offline test covers an already loaded app. No cold-start web service
  worker is installed; the standalone native app remains the offline release target.

## Screenshots

These screenshots use an isolated **synthetic demonstration**, not real medicine data.

- [Identity confirmation](screenshots/identity-confirmation.png)
- [Field review](screenshots/field-review.png)

## File manifest

### New files

- `app/identify/[id].tsx`
- `app/review/[id].tsx`
- `docs/identification-delivery.md`
- `docs/intelligent-identification.md`
- `docs/screenshots/field-review.png`
- `docs/screenshots/identity-confirmation.png`
- `src/components/ReviewField.tsx`
- `src/data/identification.ts`
- `src/data/templates.ts`
- `src/domain/extraction/dates.ts`
- `src/domain/extraction/engine.ts`
- `src/domain/extraction/formats.ts`
- `src/domain/extraction/optional-ai.ts`
- `src/domain/extraction/templates.ts`
- `src/domain/extraction/text.ts`
- `src/domain/extraction/types.ts`
- `src/domain/extraction/verification.ts`
- `src/hooks/useIdentification.ts`
- `tests/e2e/identification.spec.ts`
- `tests/extraction.test.ts`
- `tests/helpers/database.ts`
- `tests/identification.test.ts`
- `tests/optional-ai.test.ts`

### Modified files

- `README.md`
- `app/add-product.tsx`
- `app/history.tsx`
- `app/history/[id].tsx`
- `app/inventory-entry.tsx`
- `app/product/[id].tsx`
- `app/scan-result.tsx`
- `app/scanner.tsx`
- `docs/acceptance.md`
- `docs/data-safety.md`
- `docs/scanner-support.md`
- `docs/validation.md`
- `src/components/ui.tsx`
- `src/data/history.ts`
- `src/data/inventory.ts`
- `src/data/products.ts`
- `src/data/schema.ts`
- `src/domain/gs1.ts`
- `src/domain/types.ts`
- `tests/database.test.ts`
- `tests/e2e/medicine-flow.spec.ts`
