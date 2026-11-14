# Validation record

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
