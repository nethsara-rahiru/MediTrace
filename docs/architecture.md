# Architecture

The Expo Router screen layer calls typed repository functions. SQLite is the
primary source of truth on Android, iOS and the browser preview. There is no
backend in release one.

## Identification

Camera/manual input -> format classification -> validation and normalization ->
exact SQLite identifier lookup -> catalog match or explicit unknown result.

GTINs are stored as text, normalized to 14 digits when their check digit is valid.
UPC-E expansion depends on the reported symbology. Private Code 128/QR identifiers
remain literal strings. A code cannot map to two products in the local catalog.
General URLs are not resolved or opened. GS1 parser scope and caveats are in
[scanner support](scanner-support.md).

## Data model

A product describes one formulation and packaging variant. Separate product rows
represent different strengths or pack sizes; multiple codes may refer to one row.
Products link to canonical recorded ingredient names and a source description.
Source-checked status is reserved for an actual reviewed catalog process; the
registration screen always writes user-entered status and clears verification
dates when edited.

Inventory rows represent particular owned packs. Batch and expiry are pack data,
not properties inferred from the product's retail barcode. Month-only dates are
stored at month end alongside their original precision. Unknown dates remain
NULL. Ingredients are compared by normalized recorded name; there is no inferred
salt equivalence or medical interaction database.

Foreign keys, constraints and indexes protect relationships. Schema upgrades use
`PRAGMA user_version` and transactions. Data-provider writes are queued to prevent
overlapping asynchronous transactions. Search terms are passed as SQL parameters.
Scan history preserves raw content, extracted fields, match outcome and time.
The UI loads the latest 200 entries; earlier rows remain in SQLite.

## Reminders

Preferences are opt-in and local. The app reconciles saved notification IDs with
native schedules, scheduling up to 50 earliest active inventory entries. It
cancels old notifications on changes/removal. A logical 30-day trigger is retained
to avoid repeatedly scheduling an already-delivered reminder. OS permissions,
battery restrictions and scheduling limits still affect delivery. The tracker
works without notification permission.

## Web preview

Expo SQLite uses a WebAssembly worker. The current asynchronous query paths were
tested successfully in Chromium, including without cross-origin isolation. For
full compatibility, especially synchronous SQLite calls, production hosting
should serve the HTML and assets with:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Use HTTPS or localhost, serve `.wasm` with the proper MIME type, and configure SPA
fallbacks for direct routes. Browser records belong to that origin/profile and
are not shared with Android. Exporting web assets does not install an offline
service worker; the standalone native app is the release-one offline target.

## Later online catalog

A future API can serve reviewed catalog updates, optionally backed by MongoDB.
The app must not contain MongoDB credentials. Retain SQLite lookup first, preserve
source/version metadata and keep personal inventory out of catalog sync by
default. Authentication, review, conflict resolution and consent would be
separate features, rather than prerequisites for the current app.
