# Local-first medicine details and background online checks

After medicine identity confirmation, the existing SQLite/scan result appears
immediately. An asynchronous Supabase request checks the confirmed identity without
holding a SQLite transaction or waiting to display the page. For a barcode with no local identity, a separate identifier-only online lookup
first proposes its name, strength, form and pack size. The user must confirm that
proposal before any remaining details are displayed. Codes with local matches or
QR payloads already containing a name retain immediate local confirmation.

The request sends a product identifier or confirmed name, never raw scanned text,
photographs, batch/serial numbers, expiry details or personal inventory. It uses
the existing public catalog and policies; no additional Supabase migration or
backend is needed. SQLite migrates automatically to schema 8.

## Unknown barcodes before name confirmation

A traditional barcode usually carries an identifier, not a medicine name. If the
local extraction has no identity suggestion and contains a product identifier,
the confirmation screen looks up that identifier online. It never sends an empty
or guessed medicine name. The screen shows progress, permits manual entry and
rescan, and labels a matching proposal **Identity source: Online database**.

The request checks equivalent valid GTIN/EAN/UPC representations, including
GTIN-14 padding and legacy unpadded identifiers stored by administrators. It only
proposes a record whose returned barcode normalizes to the scanned identifier.
Multiple matches, withdrawal, unavailable network and malformed responses retain
manual identification and retry options.

Before Yes, only the proposed identity is displayed. Details are held in the
per-scan lookup result rather than imported as a reusable local medicine. Yes
atomically caches the matching product and confirms its identity; remaining
fields then carry their online retrieval and original verification status. No
repeated network request is needed to reveal details already fetched. No clears
the proposal without importing it. Late replies cannot attach to rejected or
already confirmed sessions. Original scan/extraction data stays unchanged.

`scan_identity_lookups` persists this provisional result in SQLite schema 8.
There is no new Supabase migration or dependency. Full catalog downloads remain
optional; an unknown barcode can resolve directly from the shared online catalog.
Draft records remain hidden under the existing server access policies.

## Matching after confirmation

1. Check an existing remote catalog link or the current device's publication ID.
2. Look up the normalized barcode when available.
3. Fall back to an exact case-insensitive name query with wildcard characters
   escaped. This lookup does not use fuzzy matches to select a medicine.
4. Require a compatible confirmed name, exact normalized strength, confirmed form
   where known, encoded barcode where supplied, and local pack size where known.
5. More than one compatible result, incomplete/mismatched identity, or a withdrawn
   record produces a review state; no online facts are applied.

Queries are bounded to 21 results and each request times out after 10 seconds.
Malformed responses or connection failures leave the displayed data available.
The user can retry the check. Recent completed checks are reused for 60 seconds
when returning to the same identity; saved scan reviews are not re-enriched.

## Combining information

Missing ingredient/manufacturer/address fields can be filled from one compatible
online record. Existing local or scanned fields remain unchanged when they differ.
The interface displays the current and online values and offers **Use online …**
for each supported field. Identity changes still require the separate identity
confirmation workflow. Online data never assigns package dates or serial numbers.

The commit re-reads the current session after the request, rejecting late results
for changed, rejected or saved identities. Fields currently being edited or already
touched during the check are protected. A save in progress suppresses the late
commit. Existing manual corrections are not overwritten. Adopting an online value
resets the physical-package checkbox and preserves the online record's own
verification status.

An exact, nonconflicting online-only product is cached in the existing normalized
SQLite product/ingredient/barcode/source tables, without creating an upload. Its
local ID is bound to the already confirmed session. Conflicting scan facts are not
bound to that cache until differences are explicitly resolved. Cached products
support future offline scans. Existing local catalog products are not overwritten
by the background check; explicit catalog downloads/edits remain separate actions.

## Source and verification labels

Each review field separately displays its retrieval source and verification state:

| Label                                 | Meaning                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Local database                        | Retrieved from this device's product catalog, including previously cached online products.                                   |
| Online database                       | Retrieved from the current Supabase lookup. Its citation remains available as evidence.                                      |
| Product scan data                     | Extracted from the scanned payload. Parser uncertainty remains visible.                                                      |
| User correction                       | Manually entered or corrected during the review.                                                                             |
| Previous local scan                   | Reused from a previous scan stored on the device.                                                                            |
| Source-checked catalog                | The catalog record has an independent source-check status and citation.                                                      |
| System checked · online catalog match | The confirmed identity matches an online catalog record. This does not verify medical accuracy, authenticity or suitability. |

A user-entered online record stays user-entered/unverified. Merely finding the same
value online never promotes a field to independently source-checked. “System
verified” is deliberately not used as an unrestricted medical trust claim.

`scan_catalog_checks` persists the result, identity fingerprint, provider record,
conflicting field names and check time for each scan. Original scan/extraction data
is preserved. Field JSON adds an optional retrieval source; older records remain
readable. History and saved reviews retain the source information that was used.

## Verification

Automated tests cover online-only caching, local/scan conflicts and explicit
selection, independent source status, wrong strengths, ambiguous variants, pack
mismatches, withdrawals, malformed/offline responses, protected edits, rejected
identities, wildcard escaping and exclusion of private package data. Browser flows
hold an online response open while asserting local facts are visible, verify
online-to-offline caching, and preserve unfinished form edits. All browser
Supabase responses are synthetic and intercepted.
