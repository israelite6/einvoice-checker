# einvoice-checker

**Live: https://e-rechnung-pruefen.pages.dev**

Free, in-browser checker and viewer for German e-invoices (XRechnung, UBL and CII; ZUGFeRD/Factur-X coming). **Files never leave the user's device**: the XML schema, EN 16931 and XRechnung rules run entirely in the browser, with verdicts identical to the official KoSIT validator (678/678 files, see `spike/RESULTS.md`).

Company records for this product live in the company repository (`first-ai-company/projects/PRJ-2026-001-invoice-checker/`).

## Stack

- React 19 + TypeScript (strict) + Vite + Tailwind CSS 4
- Light/dark theme with toggle; German and English; installable PWA that works offline after the first load
- Validation: official KoSIT configuration, schematron compiled for SaxonJS 2.7, XSD via libxml2 (xmllint-wasm, bundled)
- Rendering: official KoSIT XRechnung visualization, shown in a sandboxed iframe
- Hosting: Cloudflare Pages (free); `functions/api/event.ts` (TypeScript) writes anonymous experiment events to Workers Analytics Engine

## Develop

```bash
nvm use            # Node 24 (see .nvmrc)
npm ci
npm run rules      # downloads official rules + SaxonJS runtime, compiles to public/ (not committed)
npm run dev        # http://localhost:5173
```

## Test and build

```bash
npm run lint && npm run typecheck
npm run build      # dist/ plus dist/_headers (strict CSP with hashed inline scripts)
npm run test:e2e   # Playwright on desktop + mobile: flows, no-upload check, CSP, axe (light/dark), layout
spike/run-parity.sh  # official Java validator vs our engine (needs Java 21)
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, build and e2e on every push, plus the parity job (also weekly).

## Deploy

```bash
npx wrangler login                                           # once, with the owner's Cloudflare account
npx wrangler pages deploy dist --project-name e-rechnung-pruefen
```

## Licences

- Our code: Apache-2.0.
- Official rule artefacts: KoSIT (Apache-2.0) and CEN EN 16931 (EUPL-1.2), downloaded from official releases and not modified. Sample invoices in `public/samples/` are derived from the KoSIT test suite (Apache-2.0).
- SaxonJS 2.7 is proprietary freeware from Saxonica. It is **not committed**; `npm run rules` downloads it, and it ships only inside the app with its licence notice (in-app "Licences" page).
