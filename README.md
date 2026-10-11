# Daily Fuel

A personal calorie and protein tracker PWA. Premium, phone-first interface; hosted as a static app on GitHub Pages.

## Features
- Editable calories, protein, carbs, fat, and fiber goals.
- Meal diary, serving/gram portions, editing, delete/undo, previous-day copying.
- Saved foods, favorites, history, and seven-day chart.
- Camera barcode scanning or manual barcode lookup through Open Food Facts.
- On-device nutrition-label OCR with review before logging.
- Local storage, persistent-storage request, JSON backup export/import.
- Installable home-screen app and offline shell.

## Development
Use Node.js 24.

```sh
npm ci
npm test
npm run dev
npm run build
npm run preview
```

TASKS.md tracks implementation and verification. DESIGN.md records the product, visual direction, data model, and acceptance criteria.

## Privacy and persistence
Goals, food history, and reviewed barcode records are saved in a namespaced localStorage record on the device. They are not uploaded to GitHub. Open Food Facts receives barcode lookup requests; label photos are processed on the device by Tesseract.js. OCR engine/language assets are external downloads. Fonts are bundled locally. The app has no analytics, account, cloud database, or AI API key.

Persistent storage, if granted by the browser, protects against automatic eviction. Explicitly clearing website data can still remove records. Export regular backups to Files. Safari tabs and installed home-screen apps may have separate storage; use one consistently and export/import when moving between them. No personal meal data belongs in this repository.

## Scanning
Barcode camera access needs HTTPS (or localhost), camera permission, and a physical camera. Typed barcode entry is always available. Lookup coverage and nutrition completeness vary; review serving sizes before logging. Label recognition requires a clear photo, can take time on phones, and may require internet for initial assets. Missing nutrients remain unknown.

## Deploy
The GitHub Actions workflow runs tests, builds the app, and publishes `dist` to GitHub Pages. Enable Pages with GitHub Actions as the source. Relative paths support repository hosting. Service-worker caches are isolated to the app's repository scope and versioned by build content; app updates do not erase nutrition data.

Food database attribution: [Open Food Facts](https://world.openfoodfacts.org), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Barcode decoder: ZXing; OCR: Tesseract.js.
