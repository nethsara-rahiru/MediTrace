# Intelligent identification

## Architecture review and decisions

The existing Expo Router app has a SQLite provider, serialized repository writes,
GTIN/GS1 decoders, reusable themed controls, and separate product/owned-pack rows.
The scanner currently passes raw content to `scan-result`, which immediately
shows details. That route will become a progress gateway to a persistent identity
confirmation, followed by field review. Existing library and inventory workflows
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

Implementation and test evidence are recorded below as milestones complete.
