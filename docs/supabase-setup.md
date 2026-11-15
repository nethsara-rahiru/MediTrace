# Shared catalog with Supabase

SQLite remains the primary database. Library → Shared catalog → Download catalog
updates explicitly downloads reviewed reference products. Scanning, search,
inventory and history continue to use SQLite without internet. No personal
records, raw scans, photographs or locally added products are uploaded.

## One-time project setup

1. Open your Supabase project → SQL Editor → New query.
2. Copy the complete contents of
   [001_shared_catalog.sql](../supabase/migrations/001_shared_catalog.sql), run it
   once, and check that it succeeds. This creates the catalog, update trigger and
   row-level security policy in a transaction.
3. In Table Editor, confirm `catalog_products` exists and RLS is enabled. There
   should be no public INSERT, UPDATE or DELETE policy. Only your privileged
   dashboard/server administration can publish records.
4. Never put patient information in this public reference table. Approved and
   withdrawn rows are publicly readable; drafts are hidden from app users.

A publishable key can read permitted rows but cannot create tables or policies.
The supplied project accepted its key; its catalog endpoint returned PGRST205
(table missing) before setup. No cloud schema was applied from this workspace.

## App configuration

Copy `.env.example` to `.env.local` and set:

```text
EXPO_PUBLIC_SUPABASE_URL=https://yoflcfahecsjsfhimqbg.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
```

This workspace already has your supplied public connection details in ignored
`.env.local`. A fresh checkout needs its own configuration. Restart Metro with
`npx expo start --clear` after changing environment values. Set the same variables
when building an APK. Public values are embedded in the app; never use a database
password, secret key or service-role key. No new npm dependencies are required:
Supabase's HTTPS REST API is used directly with a timeout and a publishable key.

## Publishing real reference products

Use Table Editor to insert a draft row. Its `product` column is a JSON object
matching the existing local ProductInput fields:

- Required: `name`, `source`, `verification`, `verified_at`, `ingredients`,
  `barcodes`.
- `verification` must be `source_checked` for publication. `verified_at` is the
  actual review date in `YYYY-MM-DD` format. Record a meaningful source citation.
- `ingredients` is an array of objects with `name` and `strength` strings.
- `barcodes` is an array of strings, collected from the exact package variant.
  Keep leading zeros. Confirm real product mappings rather than inventing them.
- Optional string fields: `generic_name`, `strength`, `dosage_form`,
  `manufacturer`, `manufacturer_address`, `country`, `category`, `pack_size`,
  `storage`, `warnings`, `indications`, `prescription`. Omit unavailable facts.

One row represents one product/strength/package variant, with multiple associated
identifiers and ingredients. This JSON document is the download format; the app
normalizes it into its existing SQL product, ingredient, barcode and source tables.
No medical or synthetic production records have been seeded.

Review the medicine facts, sources, identifiers and exact package variant before
changing `status` to `approved`. Approval is an administrator's assertion, not an
automated medical check. The client validates types, lengths, dates and evidence
before accepting the download. A malformed row rejects the entire download.

To withdraw a published record, change status to `withdrawn`; do not delete it or
return it to draft. On the next download an unchanged local copy loses barcode
associations and source-checked status, with a withdrawal note. Inventory links
remain. Locally edited copies are preserved and reported as conflicts, including
withdrawal conflicts; they require manual review. Withdrawals cannot reach an
offline device until it downloads updates.

## Synchronization behavior

- Manual, download-only; there is no account system or product-submission upload
  in this first connection. Locally added products remain local.
- UUID pagination downloads the complete visible catalog before SQLite writes.
  Requests have 15-second timeouts and bounded page/record sizes.
- Schema version 5 adds `cloud_catalog_links` mapping project URL and remote UUID
  to a stable local product ID, remote timestamp and local snapshot. Successful
  download times live in `preferences`. Existing SQL records are retained.
- One SQLite transaction applies imports and records the successful download time.
  Failed fetches, validation or writes leave the existing library unchanged.
- Repeated downloads reuse product IDs. Changed local copies and barcode
  collisions are skipped and counted; no silent merge or overwrite occurs.
- Refreshed counts include previously downloaded records even when unchanged.
- There is no realtime subscription or background synchronization. Concurrent
  publisher changes may require another download; pages are not a server snapshot.
- No separate backend server is needed for this read-only catalog. Authentication,
  moderated submissions and photo upload require an additional feature and policies.

## Verification

Run `npm ci`, `npm run typecheck`, and `npm test`. Browser tests use synthetic
intercepted responses and Chromium (`npm run test:e2e`). No test inserts real
medicines into the online catalog. To verify the live setup, run the SQL, open
Shared catalog and download: an empty table should report zero imports, and a
reviewed record should become available for offline lookup after downloading.
