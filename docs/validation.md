# Validation record

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
