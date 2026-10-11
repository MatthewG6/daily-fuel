# Daily Fuel — development tasks

## Working agreement
- Test-driven development for nutrition calculations, saved records, imports, and scanning parsers: write behavior tests, observe the failure, implement, rerun.
- Verify visual and interaction behavior in a browser after the app is recognizable.
- Track completed work and verification here. Do not mark physical camera testing complete without a phone test.

## Foundation
- [x] Confirm GitHub and local development tooling.
- [x] Inspect the existing water tracker storage model.
- [x] Document the product and design in DESIGN.md.
- [x] Set up Vite, barcode decoding, and browser OCR dependencies.
- [x] Add core acceptance tests and record their initial failure.
- [x] Implement and verify nutrition calculations, product mapping, label parsing, and backup validation.

## Phone app
- [x] Premium responsive dashboard with calorie and protein progress.
- [x] Editable calorie, protein, carbs, fat, and fiber goals.
- [x] Meal logging, serving/gram quantities, edit, remove, undo.
- [x] Saved foods, favorites, search, and reuse.
- [x] Barcode camera scanning and typed barcode lookup through Open Food Facts.
- [x] Nutrition label OCR with editable review and no automatic logging.
- [x] Daily history, weekly totals, and copy previous day.
- [x] Device persistence, storage-status display, export/import, backup reminder.
- [x] Home-screen manifest, icons, scoped offline service worker.

## Verify and deliver
- [x] Core automated tests pass.
- [x] Production build passes.
- [x] Browser: empty state, goals, manual logging, edit/delete/undo, favorite, history, backup, and reload persistence.
- [x] Browser: typed barcode lookup mapping.
- [ ] Physical phone: camera permission/recognition and scanner failure fallback.
- [x] Browser: OCR parsing/review flow; report any OCR engine test limits.
- [x] Browser: narrow viewport, keyboard focus, and no horizontal overflow.
- [x] Browser: service-worker control and offline reload.
- [x] Create GitHub repository and deploy with GitHub Pages.
- [x] Verify successful deployment and published app.
- [ ] Physical phone: install, camera barcode recognition, and label-photo recognition (user verification).

## Verification record
- [x] Dark pastel theme: update all screens, dialogs, focus states, PWA chrome, and icon; verify phone layout.
- Dark-theme verification: 11 existing tests pass; production build passes; Today, Foods, History, Settings, goals, and both scanner dialogs checked at 390px. No horizontal overflow. Saved goals/food/history survived service-worker updates. Scanner action text contrast fixed during visual review.
- Core red/green cycle: previous-day copy initially failed; implemented and passed.
- Storage red/green cycle: missing write/read behavior initially failed; implemented and passed.
- Offline red/green cycle: duplicate precache URLs initially failed (10 versus 6 unique URLs); deduplicated and passed.
- 11 core tests passing. Production build passes.
- Browser at 390px: goals 2200 kcal / 150g protein; 1.5 portions of 200 kcal / 20g protein yielded 300 kcal / 30g; changing to 75g of a 100g serving yielded 150 kcal / 15g. Reload, delete/undo, favorites, history, and backup round-trip verified.
- Live Open Food Facts lookup for a test barcode returned a review form with per-serving nutrition.
- Synthetic nutrition image recognized 230 kcal, 3g protein, 37g carbs, 8g fat, 4g fiber. OCR misread the serving weight, demonstrating why review is required. No photos are uploaded by the app.
- Offline installation initially failed from duplicate cache URLs; fixed and regression-tested. Offline readiness status verified, then server stopped and app/saved-food pages reloaded successfully.
- Camera recognition and physical phone installation remain pending.
- GitHub repository: https://github.com/MatthewG6/daily-fuel
- Published app: https://matthewg6.github.io/daily-fuel/
- GitHub Actions build/tests/deployment succeeded. Published app rendered successfully, reported offline readiness after reload, and showed no console errors.

- [x] Vibrant-theme refinement: saturated blue/violet actions, magenta protein card, cyan highlights, updated icon. Production build and all 11 tests pass. Phone dashboard and goal form checked at 390px without horizontal overflow.
