# Shared catalog with Supabase

SQLite is the primary local database. Saving a product in the app now saves it
locally and queues its public reference information for direct online publication.
No sign-in or reviewer approval is required. The shared product is labelled
**user-entered**, never automatically source-checked.

Inventory quantities, batch/serial numbers, expiry dates, raw scans, history and
photographs stay local. Save screens explain which information becomes public.
Existing local products are shared when saved/edited; they are not bulk uploaded
silently. A newly identified product is queued when its checked package is saved.
Saving another package of an existing product does not republish its reference.

## One-time project setup

1. Open Supabase → SQL Editor → New query.
2. For a fresh project, run the complete contents of
   [001_shared_catalog.sql](../supabase/migrations/001_shared_catalog.sql) first.
3. Then run
   [002_direct_product_save.sql](../supabase/migrations/002_direct_product_save.sql).
   If you already ran migration 001, run only 002. Each file runs once in a
   transaction. Check that it succeeds.
4. Keep RLS enabled. App users can read `community`, `approved` and `withdrawn`
   products; drafts are hidden. Direct table INSERT, UPDATE and DELETE remain
   denied. The bounded `publish_catalog_product` function handles app writes.
5. Never put personal information in the public catalog. The `product` JSON stores
   reference information; the app splits it into normalized SQLite tables.

The publishable key cannot apply migrations. Applying migration 002 in your
project remains a dashboard step; its SQL was tested in an isolated PostgreSQL
engine without modifying your live catalog.

## App configuration

Copy `.env.example` to `.env.local` and set:

```text
EXPO_PUBLIC_SUPABASE_URL=https://yoflcfahecsjsfhimqbg.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
```

This workspace already has your supplied public connection details in ignored
`.env.local`. A fresh checkout needs its own configuration. Restart Metro with
`npx expo start --clear` after changing environment values. Set the same variables
when building an APK. Never use a database password, secret key or service-role
key. The app calls Supabase's HTTPS REST API directly.

Run `npm ci` after updating the project. `expo-crypto` supplies cryptographically
secure native publication credentials. Web uses browser Web Crypto and requires
HTTPS or localhost. Native builds must include the SDK-compatible Expo Crypto
module; rebuild an existing development build after adding the dependency.

## Product saves and offline retry

- App saves commit the local product and its upload queue entry in one SQLite
  transaction, then attempt upload. Failure never discards the local record.
- Pending saves retry at startup, when the app returns to the foreground, once a
  minute while active, after product saves, or using **Shared catalog → Retry
  online saves**. They survive app restarts and retain the latest correction.
- Product details show whether the record is saved locally and online or pending,
  along with any upload error. Shared catalog lists pending product names.
- Retries use a persisted UUID, so a lost acknowledgement does not create another
  online record. Edits to a product published from this installation reuse its ID.
- A secure device-held write token allows editing that installation's own
  community record. Only its hash is stored in a private server table. Tokens are
  not returned by catalog downloads. Clearing app data loses this capability.
- There are no user accounts or ownership recovery in this version. Other users
  cannot overwrite someone's shared record. Editing a downloaded product creates
  a separate publication; an existing barcode mapping produces an explicit
  conflict rather than changing another user's record. Correct the local
  identifiers/source information as appropriate; do not invent a new barcode.
- Public submissions cannot set independent verification or change reviewed or
  withdrawn records. Administrators can review them in the dashboard later.
- Upload requests contain an explicit whitelist of product fields. Extra
  package/personal fields are rejected by the server publication function.
- Public contribution is available without authentication. This prototype has no
  account-based quotas or abuse reporting yet. Keep the catalog's user-entered
  status visible; a shared match is not evidence of authenticity or medical safety.

## Downloading and reviewing products

Library → Shared catalog → Download catalog updates imports community and reviewed
products into SQLite for offline use. Source and review status remain distinct.
Downloaded products do not re-upload automatically. The publisher's own community
rows are not imported a second time.

A product represents one exact medicine/strength/package variant. `product` is a
JSON object with:

- `name`, `source`, `verification`, `verified_at`, `ingredients`, `barcodes`.
- `ingredients`: objects with `name` and `strength` strings.
- `barcodes`: strings from the actual package, preserving leading zeros.
- Optional strings: `generic_name`, `strength`, `dosage_form`, `manufacturer`,
  `manufacturer_address`, `country`, `category`, `pack_size`, `storage`, `warnings`,
  `indications`, `prescription`. Omit unavailable facts.

To source-check a record, an administrator must independently review its facts,
source and exact barcode mapping, set `verification` to `source_checked` and
`verified_at` to the actual `YYYY-MM-DD` review date, then set `status` to
`approved`. Public writes always force `user_entered` and a null review date.
No real or synthetic production medicines have been seeded by this integration.

Use `withdrawn` rather than deleting published records or returning them to draft.
Unchanged downloaded copies lose barcode matching and source-checked status on
the next download, retaining inventory references. Locally changed copies are
preserved as conflicts and require manual review. A withdrawal cannot reach an
offline device until it downloads updates. Owned publications are protected from
further public edits after withdrawal and require manual local review.

Downloads use UUID pagination, 15-second request timeouts and bounded records.
All pages are validated before an atomic SQLite import. Malformed data or write
failure leaves the existing library unchanged. Local edits and barcode conflicts
are preserved; refreshed counts include unchanged downloaded records. Concurrent
publisher changes may require another download because pages are not a single
server snapshot. Downloads are manual; no realtime subscription is configured.

## Database and verification

SQLite schema 6 adds `product_publications`, storing product/project mapping,
remote ID, device write capability, public payload and pending/error state. Schema
5's `cloud_catalog_links` continues to track downloaded records and local snapshots.
Existing records remain intact. Supabase migration 002 adds private write-key and
normalized unique-barcode tables, a barcode trigger and the publication function.

Run `npm run typecheck`, `npm test` and `npm run test:e2e`. Browser tests use synthetic connection values when starting their server and
block unmocked Supabase requests. They do not publish fixtures to the live project. A real app
save after migration 002 should appear immediately as `community` in Supabase
Table Editor and show an online-save success indicator in product details.
