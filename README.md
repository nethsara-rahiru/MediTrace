# MedTrace

An Android-first, offline medicine packaging reference and expiry tracker built
with React Native, Expo Router and SQLite. The app uses a light navy-and-teal
interface, with phone navigation and a responsive browser preview.

## Run locally

Use Node.js 24 and npm. No backend, API key or database account is required.

```sh
npm ci
npm start
```

Open the project in a compatible Expo Go version on Android, or use a development
build. Camera and notification behavior must be checked on a physical device.
For the browser preview:

```sh
npm run web
```

SQLite web support requires workers, WebAssembly and cross-origin isolation.
The development server config sets COOP/COEP headers on Metro responses. An
exported web deployment must set those headers itself; see [architecture](docs/architecture.md).
Browser preview does not establish native camera compatibility.

## Included

- Home dashboard with live inventory and scan summaries.
- Camera scanning with flashlight, manual entry and permission handling.
- EAN/UPC validation, GTIN normalization, a documented GS1 subset and Digital Link parsing.
- Exact offline identifier matching, explicit unknown results and inert website QR codes.
- Product registration and editing, multiple identifiers and ingredients, source labels.
- Library search by brand/generic name/ingredient, category and manufacturer filters.
- Owned packs with quantity, batch, day/month/unknown expiry and ingredient overlap notices.
- Expiry dashboard and opt-in generic local reminders on supported native builds.
- Searchable recent scan history with stored scan details.

## Dataset status

**No real medicine catalog is preloaded.** Real identifiers must be collected from
actual packaging and associated with the exact strength, form and pack variant.
The registration screen works without internet; records remain explicitly
user-entered and are immediately available for future local scans.

The university requirement for approximately 30–50 original product records is
still a data-collection task. Use the [collection guide](docs/dataset.md) and
[blank worksheet](docs/product-collection.csv). Synthetic tests are never seeded
into the app. No medicine facts or barcode mappings are invented.

## Checks

```sh
npm run typecheck
npm test
npm run format:check
npm run export:web
npx playwright install chromium
npm run test:e2e
```

The integration tests run the actual schema and repository SQL through Node's
SQLite engine. Browser tests exercise Expo's real SQLite worker, registration,
scanning, inventory, persistence, history and mobile navigation.

For an existing Chromium installation, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium` when running browser tests.

## Android builds

EAS profiles are included for development builds and an installable preview APK.
Builds require your own Expo account and EAS project association.

```sh
npx expo install expo-dev-client
npx eas-cli build --platform android --profile development
# Or build a standalone preview APK:
npx eas-cli build --platform android --profile preview
```

No signed APK or physical-device acceptance test is implied by a successful web
export. Use the [release checklist](docs/acceptance.md) before distribution.

iOS uses the same React Native application, but has not yet been validated on an
iPhone or simulator. No OCR, AI, online lookup, account system, MongoDB connection
or cloud sync is included in this release.

## Medical information and privacy

MedTrace does not diagnose, prescribe, recommend doses, verify authenticity or
establish personal suitability. Ingredient overlap is a comparison of recorded
names, not a contraindication or interaction assessment. “Valid” describes only
the recorded expiry date. Seek advice from a qualified pharmacist when needed.

Personal records stay in SQLite on the device. The app has no product-data upload
or analytics integration. Notifications are local and opt-in, with generic lock
screen wording. SQLite is not encrypted by this app; uninstalling or clearing app
data removes the local records. Android cloud backup is disabled in app config.
See [data and safety](docs/data-safety.md).

## Repository workflow

Features are developed on `feature/*` branches and merged into `main` with merge
commits. Commit timestamps reflect the actual work; history is not backdated.
GitHub Actions validates source checks and browser flows on future pushes.
