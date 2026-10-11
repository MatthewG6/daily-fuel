# Daily Fuel

## Product intent
A personal, phone-first calorie and protein tracker hosted on MatthewG6's GitHub Pages. The primary job is to make daily food logging quick and understandable. It has no account system and no cloud database.

## Experience and visual direction
Premium, quiet, and tactile. Use warm ivory (#f6f5ef), deep forest green (#244e3c), pale sage, and a muted apricot accent. A large serif headline brings warmth; a legible system sans-serif handles controls and numbers. Generous spacing, fine borders, softly rounded cards, tabular numbers, and subtle motion make the app feel considered. Respect reduced-motion preferences. No stock imagery is needed for a functional food log.

The phone layout uses four bottom-navigation destinations: Today, Foods, History, and Settings. The main daily view presents the date, calorie progress, protein progress, compact secondary macros, quick actions, and meals. On larger screens the same hierarchy uses a centered, spacious layout. Touch targets are at least 44px, inputs at least 16px, and dialogs fit the viewport with scrollable content.

## Data and persistence
Use the existing water tracker's device-local model: one namespaced, versioned localStorage record for goals, foods, and meal entries. Ask for navigator.storage.persist() and show the browser's actual response; do not imply guaranteed persistence. The app works without this grant. Data survives app closure and ordinary reloads. Browser history and website data are distinct; explicit deletion of website data can erase the log. Home-screen installation is encouraged, and export/import is always available.

The local record is the source of truth. Write it successfully before reporting a mutation as saved. On storage errors, preserve the existing record and tell the user. Invalid stored data must not be silently replaced. Imports are validated, previewed, and confirmed before replacement; export a safety backup before applying an import. Data is never placed in the Git repository or pushed to GitHub.

Records:
- Goals: calories, protein, carbs, fat, fiber; zero is allowed for optional gram targets.
- Saved food: ID, name, serving description, optional serving grams, nutrients, favorite, optional barcode/brand/source.
- Meal entry: ID, local calendar date, meal, food snapshot, positive serving multiplier.
- Unknown nutrients remain unknown, not invented zero values. Dashboard sums known values and identifies incomplete nutrition.
- An edited saved food does not retroactively change historical food snapshots.

## Food entry and scanning
Manual entry is always available. All nutrition values refer to the stated serving. Quantity can be entered in servings or grams when serving weight is known. Show calculated nutrition before saving. Allow edits to quantity, meal, date, and nutrition.

Barcode scanning uses @zxing/browser with the back camera where available. Start camera only after user action and stop it on success, dismissal, or page backgrounding. Offer typed barcode fallback. Look up only the barcode in Open Food Facts over HTTPS, then show an editable serving/nutrition review. Unknown products and incomplete nutrition must have a useful manual fallback. Store reviewed foods on the device for offline reuse. Attribute Open Food Facts and link its database license.

Nutrition-label scanning uses Tesseract.js in the browser. The image is processed on the device, not uploaded to an AI service. Initial OCR model/runtime downloads require internet and can be large. Parse calories and gram-based macros, leaving uncertain/missing values blank. Show recognized text and editable values; require the user to check serving size and values before logging. Label scanning is a convenience, not a source of guaranteed accuracy.

## Offline behavior
Precache app shell and built assets. Saved food entry, goal changes, history, and backup work offline. New product lookup needs internet; OCR may require internet for initial model downloads. Service-worker scope stays inside the calorie tracker's repository path. App updates never clear food records.

## Acceptance criteria
1. Opening for the first time shows an honest zero-entry dashboard and a clear goal-setting prompt; example foods are not logged as real meals.
2. Changing goals immediately updates progress, survives reload, and accepts zero for optional macro goals.
3. Logging 1.5 servings of a 200 kcal / 20g protein food adds 300 kcal / 30g protein.
4. A 75g portion of a food defined per 100g uses multiplier 0.75.
5. Meal/date filtering uses the phone's local calendar and handles month/year transitions.
6. Remove and undo restore the original food snapshot and totals.
7. Product data per 100g and per serving are mapped without mixing units; kJ can convert to kcal.
8. Barcode and OCR results are reviewed before saving; an unknown nutrient stays blank.
9. Invalid or incompatible backups do not alter saved data. Valid exports round-trip.
10. History separates unlogged days from logged zero-calorie days; averages describe their denominator.
11. The layout fits a 390px phone viewport and supports keyboard navigation and labeled inputs.
12. Installed app shell and saved foods work offline after installation is complete.

## Delivery
Source repository: a new `daily-fuel` repository on MatthewG6's GitHub. Static production build with Vite; GitHub Actions deploys to GitHub Pages. No API secrets or personal food records are included. Repository visibility must permit the chosen Pages plan; public code is acceptable under the requested GitHub-hosted website scope. Verify deployment before calling it live.

## TDD workflow
Test core behaviors using node:test before implementing changes. First capture a failure for unimplemented behavior, then make the test pass. Browser QA complements core tests for storage, dialogs, offline behavior, and responsive rendering. Camera quality and actual phone installation require physical-device verification and remain explicitly pending until tested.
