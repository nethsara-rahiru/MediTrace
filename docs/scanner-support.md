# Scanner support

The Expo SDK 58 camera configuration requests EAN-13, EAN-8, UPC-A, UPC-E,
Code 128, QR and DataMatrix. Listing a format is not evidence of physical-device
compatibility. Android and iOS acceptance checks are still required.

The app prefers the Android raw payload where available. Explicit GS1 symbology
identifiers, human-readable `(01)` data, or GS-separated element strings activate
the GS1 parser. The manual GS1 option supports an explicit user interpretation
when the native decoder strips the symbology identifier. The result screen also
offers this interpretation for a plausible DataMatrix/Code 128 prefix.

Variable fields consume through ASCII 29 or the end of the symbol. A missing
separator cannot always be detected: an apparently valid final lot number may
contain what was intended to be another AI. No heuristic splits are attempted.
Unsupported AIs stop raw parsing and appear as notes. This is a documented subset,
not a complete GS1 parser or GS1 certification.

General URLs remain inert and cannot be registered as product identifiers.
Digital Link identifiers are decoded locally; the website is not fetched.
Barcode mappings must be collected from actual packaging; the unit tests contain
standards examples that are never seeded into the product catalog.

On Android, test tiny DataMatrix codes in the centre of the camera frame, on flat
packaging, with adequate light. Browser scanning is only a convenience preview.
