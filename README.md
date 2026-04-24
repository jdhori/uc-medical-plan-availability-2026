# UC Medical Plan Availability — 2026

A small, dependency-free web tool that helps University of California employees, retirees, and family members determine which UC medical plans are available to them based on ZIP code and county of residence.

## Overview

UC offers several medical plans, but availability depends on where you live and/or work:

- **PPO plans** are available throughout California, the USA, or worldwide depending on the plan, with no ZIP/county lookup needed.
- **HMO plans** are only available in specific California counties and ZIP codes. This tool resolves a ZIP + county pair against the official 2026 service-area data and reports which HMOs are available.

The page also documents Via Benefits coverage for eligible retirees living outside California.

## Features

- ZIP + county lookup against the 2026 UC HMO service-area dataset
- Always-on listing of PPO plans with their geographic scope
- Mismatch detection when a ZIP and county don't overlap
- Light / dark / auto color themes (preference persisted in `localStorage`)
- Accessible by design: skip link, visible focus indicators, ARIA live regions, 44px touch targets, `prefers-reduced-motion` support
- Strict Content Security Policy (`default-src 'none'`, no inline scripts, no third-party origins)
- XSS-safe rendering — DOM is built with `textContent` only, never `innerHTML`
- Print-friendly stylesheet
- No build step, no dependencies, no tracking, no network calls beyond the local `plan_data.json`

## Files

| File | Purpose |
| --- | --- |
| `UC_Medical_Plan_Availability_2026.html` | Main page: layout, styles, and accessibility scaffolding |
| `plan-lookup.js` | Lookup logic: loads `plan_data.json`, validates input, renders results |
| `theme-init.js` | Pre-paint theme bootstrap to avoid a flash of the wrong theme |
| `plan_data.json` | 2026 plan availability dataset (ZIP → counties, county → plans) |

## Running locally

The CSP forbids `file://` script loading and `plan-lookup.js` uses `fetch()`, so you need a local HTTP server. From the project directory:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx http-server -p 8000
```

Then open <http://localhost:8000/UC_Medical_Plan_Availability_2026.html>.

## Deploying

Because there is no build step, any static host works:

- GitHub Pages (serve from `main` branch root)
- Netlify, Cloudflare Pages, S3 + CloudFront, etc.

Just upload the four files together.

## Data

`plan_data.json` reflects the **2026** plan year. UC updates plan availability annually during Open Enrollment; the file will need to be refreshed for future plan years.

## Disclaimer

This is an unofficial reference tool. For authoritative information, consult [UCnet](https://ucnet.universityofcalifornia.edu/) and the UC Health & Welfare benefits team. If the tool's output ever conflicts with official UC sources, the official sources govern.

## License

MIT — see [LICENSE](LICENSE).
