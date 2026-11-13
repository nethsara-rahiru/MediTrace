# Release acceptance

Automated checks do not replace testing real packages on physical devices. Mark
these items only after observing the behavior; this document does not claim they
have been completed.

## Android physical device

- [ ] Install preview APK or compatible development build on a supported Android device.
- [ ] Grant/deny/revoke camera permission and recover from each state.
- [ ] Scan real EAN-13, EAN-8, UPC-A, UPC-E, Code 128 and QR samples.
- [ ] Test actual pharmaceutical DataMatrix specimens, including small/reflective labels.
- [ ] Inspect whether raw output preserves FNC1/symbology indicators and ASCII 29.
- [ ] Confirm GS1 lot, date and serial against printed human-readable values.
- [ ] Confirm a website QR never opens automatically.
- [ ] Register the correct product/pack and repeat its scan in airplane mode.
- [ ] Restart the standalone app in airplane mode and inspect SQLite records.
- [ ] Test unknown code, malformed code and duplicate product identifier.
- [ ] Test day-only, month-only, leap-year and unknown expiry inputs.
- [ ] Verify ingredient overlap notices and incomplete-ingredient caveats.
- [ ] Grant/deny notification permission and inspect generic lock-screen text.
- [ ] Update expiry, remove a pack and check old alerts are cancelled.
- [ ] Test notification delivery after app closure and device restart.
- [ ] Test larger system fonts, TalkBack, narrow screen and touch targets.
- [ ] Validate 30–50 real product records and cite their evidence.

## Before iOS distribution

- [ ] Validate build/signing, camera formats, safe areas and permission recovery.
- [ ] Validate SQLite migrations and native reminder scheduling limits.
- [ ] Review iOS device backup and privacy behavior.

## Browser preview

- [ ] Serve exports with COOP/COEP headers and correct WebAssembly MIME type.
- [ ] Verify SQLite persistence in the intended browser and origin.
- [ ] Verify deep-link fallback and narrow viewport navigation.

No public store publication, EAS cloud build, APK signing or physical-device test
is performed merely by running this repository's source checks.
