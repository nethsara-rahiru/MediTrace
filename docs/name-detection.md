# Name-detection clues

The detector uses structural clues to rank unlabelled text. These are not medical
facts or accuracy probabilities. Identity confirmation and separate package
verification remain mandatory.

| Scanned text shape                                                       | Treatment                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `Examplemed500mg`, `Examplemed 2 g`, `Examplemed10ml`                    | Separate the printed amount from the possible name; keep both available for review. |
| `Examplemed 500mg + 65mg`                                                | Preserve the complete printed combination strength; do not calculate a new amount.  |
| Long text with several comma-separated parts                             | Suggest an address, rather than a medicine name; keep the address unverified.       |
| Dense digit runs, many numeric groups, or alternating letters and digits | Treat as possible codes; do not use them to generate fuzzy medicine-name matches.   |
| `500mg` or `10 ml` alone                                                 | An amount, not a medicine identity. It may represent strength or pack volume.       |
| A small number of digits outside a recognized amount                     | Retain as an uncertain possible brand, rather than automatically selecting it.      |
| Long explanatory prose                                                   | Preserve as additional information rather than using it as a name.                  |

## Exceptions and priority

Medicine and ingredient names can genuinely contain numbers. Explicit field
labels, previously reviewed payloads, recognized identifiers and exact local
catalogue matches therefore retain their priority. The rules do not globally ban
numbers or commas from names. A numeric difference between two possible brand
names is not silently corrected through fuzzy matching, and an identifier/name
numeric disagreement is flagged for review.

A name-like line with a literal strength ranks above a weaker plain-text guess.
Close alternatives remain selectable; equally strong lines still require a user
choice. When an exact local name replaces an unrelated pattern guess, attributes
from that other guess are cleared, including its strength.

Address/code inference remains tentative. A comma-separated ingredient list may
resemble an address, and an unexplained alphanumeric string may be a brand or a
code. Users can correct those roles on the existing review screen. No barcode is
invented from an unlabelled address, company description or standalone amount.

## Compatibility and verification

- No SQL migration, dependency, backend or API key is required.
- Existing product records and explicit/manual names remain intact.
- Changing token classifications can invalidate an old template signature; the app
  safely falls back to review rather than applying a mismatched format.
- 62 automated tests pass, including attached units, digit-heavy codes, comma
  addresses, numeric-brand exceptions, conflicting names and preserved alternatives.
- Six browser flows pass, including a mixed unlabelled name/address/code scan and
  the existing identity, verification, inventory, persistence and offline flows.
- TypeScript and formatting checks pass.
- Android JavaScript/Hermes bundle export passes; no new native module is introduced.
