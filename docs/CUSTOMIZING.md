# Customizing

| To change | Edit this file | Notes |
|---|---|---|
| Platform name | `src/lib/config.js` (inside the app), then `public/index.html`, `public/404.html`, `app/index.html` and `public/manifest.webmanifest` | The static pages are plain HTML, so search each for "Termbook". |
| Colours | `public/css/tokens.css` | Change `--primary` and `--accent` (light) and the same names under `[data-theme="dark"]`. Keep text contrast readable. |
| Fonts | `public/css/tokens.css` and `public/assets/fonts/` | Fonts are free for commercial use (Plus Jakarta Sans and Young Serif, SIL Open Font License). |
| Landing page text | `public/index.html` | Plain HTML. |
| Logo and icons | `public/assets/icons/logo.svg`, `public/favicon.svg` | The PNG icons and `og-image.png` must be remade if the logo changes. |
| Score weights and grade boundaries | In the app: **Setup > Scoring** (school admin) | Change before scoring starts. Defaults are in `src/lib/scores.js`. |
| Default classes, arms and subjects | `src/lib/data.js` (`DEFAULT_STRUCTURE`) | Schools edit theirs in **Setup**. |
| Nigerian states and local governments | `public/data/ng-states-lgas.json` | Counts are checked by a test (774 local governments). |
| Draft privacy and terms | `public/privacy.html`, `public/terms.html` | Have a lawyer review before relying on them. |
