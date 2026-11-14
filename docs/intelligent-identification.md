# Intelligent identification

## Architecture review and decisions

The existing Expo Router app has a SQLite provider, serialized repository writes,
GTIN/GS1 decoders, reusable themed controls, and separate product/owned-pack rows.
The original scanner passed raw content to `scan-result`, which immediately
showed details. That route now provides progress before persistent identity
confirmation and field review. Existing library and inventory workflows
remain available.

- Extend `products` for manufacturer address and `user_medicines` for manufacturing
  date, serial and verification evidence. Reuse these as the product/package entities.
- Extend `scan_history` with original extraction, reviewed snapshot, confirmation
  state, session token and saved inventory reference. Reopening a session must not
  create another scan or inventory entry.
- Keep per-field origin, method, confidence category and verification. Identity
  confirmation is distinct from package review and source verification.
- Use bounded offline parsers, catalog comparison and fuzzy name suggestions.
  Unlabelled dates must not receive manufacturing/expiry roles by chronological guess.
- Store format rules as validated data, never executable regex/code. Require two
  distinct reviewed payloads before local reuse; never promote them globally.
- The app has no AI provider/backend. No cloud request or client API key will be
  introduced. Any optional extraction adapter must be opt-in, bounded and validated.
- Continue using `feature/*` branches, milestone commits and a final tested merge.

Implementation details and verification boundaries follow.

## Implemented workflow

`scanner` → `scan-result` (local progress) → `identify/[id]` (identity only) →
`review/[id]` (field review and package save).

Every new scan has a persisted session token. Refreshing or remounting that
session does not insert another history row. Opening review or history cannot
bypass the identity gate. Rejection clears the reviewed identity and its
product-specific attributes, while preserving the original scan as evidence.
Selecting a replacement repeats the local lookup. A changed strength or form is
also an identity change, even when its brand name stays the same.

Name, strength and form confirmation affect those identity fields only. The
review screen distinguishes missing, labelled, predicted, user-entered catalog,
source-checked catalog and user-confirmed fields. Individual corrections persist
immediately; the original extraction is immutable. A final packaging checkbox is
required before saving available package fields. Expired status is shown after
expiry has been user-confirmed, source-checked, or included in the explicit
packaging check.

## Extraction algorithm

1. Normalize supported identifiers, check GTIN digits and query the local catalog.
   Exact previously reviewed payloads can help identify custom formats, but a
   manually added expiry that was absent from a retail code is never copied to
   another pack. Known catalog identities still require confirmation.
2. Decode GS1 element strings/Digital Link with AIs 01 (GTIN), 10 (lot), 11
   (manufacturing date), 17 (expiry) and 21 (serial). A valid GS1-shaped
   DataMatrix/Code 128 without an indicator is treated as a suggestion and flagged.
3. Tokenize bounded JSON objects, labelled text, keyword labels and URL query
   fields without fetching URLs. JSON depth, field count, size, duplicate keys
   and prototype-related keys are checked. Unknown scalar metadata is retained.
4. Apply validated, locally confirmed template mappings for the exact structural
   signature. Labels/JSON paths and unique pattern classes are used, never
   arbitrary learned line offsets or executable parsing rules.
5. Compare unlabelled text with recorded names and ingredients; recognize literal
   strengths, dosage forms, possible company/address lines and code candidates.
   Keep missing fields null and uncertain code roles explicitly unverified.
6. Rank local name suggestions with bounded edit-distance similarity, accounting
   for strength and dosage form. Ingredient overlap alone cannot select a brand.
   Multiple close variants remain choices, with pack size available to distinguish
   otherwise identical catalog entries.
7. Require the user to resolve the identity before showing remaining information.
   Scanned content is data, never executable instructions.

Every field records its value, original evidence, method, confidence category,
verification state, origin, source and optional token locator. Ingredient amounts
remain null when unknown in extraction; legacy SQL product text uses empty strings
at the repository boundary. Confidence is parser/ranking confidence, not an
accuracy probability or medical guarantee.

## Schema changes

Schema version 4 upgrades versions 0–3 through transactions without resetting data.

| Existing entity  | Added information                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `products`       | `manufacturer_address`                                                                                                    |
| `user_medicines` | `manufacturing_date`, `serial_number`, `verification_data`                                                                |
| `scan_history`   | `extraction_data`, `reviewed_data`, `identity_json`, `verification_status`, `scan_token`, `package_id`, `rejection_count` |
| `barcodes`       | `source_scan_id` for a user-confirmed local association                                                                   |

New tables:

- `qr_format_templates`: signature, validated rules JSON, candidate/local-confirmed
  state, evidence count, creation/update timestamps.
- `template_observations`: template, scan reference and original payload. The
  unique `(template_id, payload)` key prevents repeat scans from inflating evidence.

New unique/indexed lookups cover session tokens, reviewed payloads, format
signatures and `(product_id, serial_number)` for nonempty serials. Foreign keys
preserve relationships and clear inventory references when an owned pack is
removed. Product/ingredient/source tables are reused; no duplicate medicine or
package catalog is introduced.

## Saving and duplicates

Product creation, optional barcode association, owned-pack creation/linking,
reviewed scan persistence and template learning share one transaction. An
unowned barcode can be appended to a selected product after user confirmation;
another product's identifier is never reassigned. Existing catalog descriptions
are not overwritten by scan corrections.

A second save of the same session returns its original inventory reference.
Repeated serials link to the recorded pack without adding quantity. Conflicting
recorded batch/expiry/manufacturing information must be reconciled explicitly.
Users can choose recorded fields or manage the existing entry. Similar
nonserialized batch/expiry entries require choosing an existing entry or adding a
separate physical pack. Removing inventory preserves scan evidence; an old saved
session cannot silently recreate a deleted pack.

## Adaptive recognition

One reviewed mapping creates a candidate. Two distinct saved payloads with the
same signature and compatible confirmed mappings are required for local reuse.
Future extracted fields remain unverified and every scan still goes through
identity/package review. Contradictory field mappings quarantine reuse, including
counterevidence from candidate rules. A learned serial/date role takes priority
over a generic unlabelled heuristic. No manufacturer-wide or global trust is
created.

## Optional AI boundary

There is no configured AI service, backend endpoint, API key or AI button in the
app. The production workflow makes no AI request. A tested, pure optional adapter
contract is provided in `src/domain/extraction/optional-ai.ts` for a future
server-backed provider. It requires explicit per-call consent, sends only bounded
raw scan text, supplies an untrusted-input instruction, validates fields against
literal original evidence and aborts on timeout. Failures return the offline
result and manual-entry route. All accepted AI suggestions remain low-confidence
and unverified. A future integration must supply its own backend, keep keys there
and present an appropriate consent flow before enabling the adapter.

## Scope and limitations

- No production medicines or fabricated identifiers are seeded. A real collected
  catalog improves offline name/ingredient matching.
- Unlabelled unknown brands versus generic names cannot always be distinguished.
  Fuzzy suggestions and plausible code roles require human checking.
- Dates support ISO, month/year and unambiguous numeric day/month or month/day
  forms. Ambiguous dates stay unassigned; unlabelled dates need explicit roles
  unless a matching, locally confirmed format supplies one. Month precision stays
  month precision. No date ordering guess is used.
- GS1 support remains a documented subset; native separator preservation and
  physical packaging scans still need Android-device acceptance testing.
- Historical source checking applies only to the cited data. User confirmation
  does not establish authenticity, medical correctness or personal suitability.
- SQLite remains local and unencrypted by the app. No cloud sync, OCR, translation
  or independent medicine-verification service has been introduced.
