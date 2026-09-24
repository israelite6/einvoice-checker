# einvoice-checker

Free, in-browser checker and viewer for European structured e-invoices (XRechnung, ZUGFeRD/Factur-X EN 16931 profiles). Files never leave the user's device.

Company records for this product live in the company repository (`first-ai-company/projects/PRJ-2026-001-invoice-checker/`).

## Status

Feasibility spike (`spike/`). See `spike/RESULTS.md`.

## Licences

- Our code: Apache-2.0.
- Official rule artefacts: KoSIT (Apache-2.0) and CEN EN 16931 (EUPL-1.2). They are downloaded from official releases and not modified.
- SaxonJS 2.7 is proprietary freeware from Saxonica. It is **not committed** to this repository; it is installed from npm or downloaded from Saxonica at build time and shipped only inside the app with its licence notice.
