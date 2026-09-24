# Feasibility spike results — 2026-09-24

Question: can the **full official** XRechnung 3.0.2 validation (XSD + EN 16931 + XRechnung schematron, KoSIT configuration 2026-08-31) run in the browser with verdicts identical to the official KoSIT validator 1.6.3?

## Method

1. Reference: KoSIT validator 1.6.3 (Java) over the official test suite (86 valid files) and 592 generated broken files (7 mutation types: missing invoice number, wrong amount due, bad currency, missing buyer reference, empty seller name, unknown element, invalid date).
2. Ours: `engine.mjs`. It reads the KoSIT `scenarios.xml`, runs XSD checks with libxml2 (xmllint-wasm) and the official schematron compiled to SaxonJS 2.7, and applies KoSIT custom severity levels.
3. Comparison: `parity.mjs`, file by file. It compares the accept verdict, XSD validity, and rule codes by level (the raw level, as KoSIT reports it).
4. Browser: `browser/index.html` in headless Chromium, served from localhost.

## Results

| Check | Result |
|---|---|
| Accept/reject verdict matches KoSIT | **678 / 678** |
| XSD valid/invalid matches | **678 / 678** |
| Schematron rule codes (error, warning, information) match | **678 / 678** (schema-valid files) |
| Differences | 209 schema-invalid files: only the XSD engine's message wording differs (Xerces `cvc-*` vs libxml2). Both reject. |
| Time per file (Node) | p50 572 ms, p90 885 ms, max 2.4 s |
| Time per file (headless Chromium) | 253–756 ms on 5 samples (UBL and CII, valid and invalid) |
| Network requests in the browser | Only the page's own assets. No file data sent anywhere |
| Rule download size | UBL rule set about 270 KB gzip (about 100 KB brotli); CII about 260 KB gzip; XSD bundle 1.27 MB raw |

**Verdict: PASS** for XRechnung/UBL/CII. The spike fail conditions (unresolved mismatch, or more than 10 s per file) were not hit.

## Open items for the build

- ZUGFeRD/Factur-X PDF: extract the embedded XML (pdf.js/pdf-lib), detect the profile, and check parity against Mustang. Not yet tested.
- The XSD bundle is large (1.27 MB raw); lazy-load it per syntax and compress it.
- Chrome logs a deprecation warning about the native XSLTProcessor during the run. SaxonJS does its own XSLT processing, but confirm it has no dependency on the native processor.
- Parity must be re-run automatically on every rule update (CI) and before each release.
