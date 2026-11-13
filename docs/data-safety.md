# Data and safety

## Evidence labels

- **Catalog match:** exact local identifier association; no authenticity claim.
- **User-entered:** copied or supplied by a user; not independently verified.
- **Source checked:** reserved for information actually reviewed against a cited
  source. The first-release registration form cannot award this status.
- **Unknown / needs review:** the app cannot establish a reliable product match
  or could not completely interpret structured fields.

A source description applies to the entered record. It is not field-level proof.
Before publishing a reviewed catalog, add a review process and field-level
citations where sources differ. A manufacturer leaflet from another jurisdiction
must not be assumed to establish Sri Lankan prescription classification.

## Medical boundaries

No diagnosis, prescribing, dose calculation or personalized safety recommendation.
Indications, warnings and storage text are displayed only when recorded from a
source; missing fields say “Not recorded.” Duplicate ingredient notices require
pharmacist review and do not establish contraindications.

Expiry status uses the device's local calendar and a 30-day threshold. The printed
expiry day remains within date; month-only expiry is interpreted at month end.
After-opening/reconstitution limits, storage damage and medicine authenticity are
not assessed. Device clock errors affect expiry classification.

## Local privacy

The application code has no remote medicine lookup, telemetry or photo-upload
flow. Development tools and package installation still use network access.
Camera frames are not stored by the application. Raw scanned identifiers, batch
and serial fields are kept in local scan history and can be sensitive.

SQLite is stored in the app sandbox and is not encrypted by MedTrace. Device and
browser security therefore matter. Android backup is disabled. iOS backup policy
and device behavior require review before an iOS release. Uninstalling or clearing
application/browser data can remove records; backup/export is outside release one.

Notifications require explicit permission and use generic wording. No medicine
name is included in lock-screen notification text. OS delivery is best effort.
