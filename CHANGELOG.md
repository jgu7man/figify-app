# Changelog

All notable changes to the Figify HTML-to-Figma layout converter project are documented in this file.

---

## [Unreleased] - 2026-07-10

### Added in Current Stage (Fases 2, 3 & Firebase)
* **Parallel Font Preloader (Phase 2):** Scans the design payload recursively, maps all unique font families and weights, and loads them in parallel using `Promise.all` before drawing begins. Emits a clean notification for any missing local/system fonts.
* **Flexbox Auto Layout Mapping (Phase 3):** Translates CSS Flexbox rules (`display: flex`, direction, padding, gap) to native Figma Auto Layout frames.
* **Auto Layout Resizing Heuristics (Phase 3):** Evaluates element width/height to automatically configure Figma's primary and counter-axis sizing modes (`HUG` / `"AUTO"` vs `"FIXED"`).
* **Child Constraints (Phase 3):** Maps `flex-grow` and `align-self` properties to Figma `layoutGrow` and `layoutAlign` properties.
* **Absolute Position inside Auto Layout (Phase 3):** Supports `layoutPositioning = "ABSOLUTE"` for absolute/fixed positioned elements, allowing them to sit exactly in absolute coordinates without disrupting layout flows.
* **Firebase App Hosting Integration:** Added `firebase.json` and `apphosting.yaml` configurations to support full-stack Angular SSR cloud deployment on Google Cloud Run.

### Added in Previous Stage (Visual Fidelity & Asset Proxy)
* **Backend Image Proxy:** Exposes GET `/api/images/proxy` and recursive `resolveNodeImages(node)` to download and embed remote images as Base64 strings, bypassing CORS restrictions.
* **Image Paint Fills:** Extracted `<img>` tags and `background-image` CSS properties and mapped them to native Figma `IMAGE` paints.
* **CSS Gradient Mappings:** Created a parser to split `linear-gradient` declarations, resolve color stops via a browser computed-style color parser, and compute 2x3 matrix translations (`gradientTransform`) for native Figma gradients.
* **Pseudo-elements Extractor:** Implemented the Mirror Element approach for `::before` and `::after` content, temporarily inserting a styled DOM `span` to get layout coordinates before removal.
* **Box Shadows Support:** Parsed computed CSS `box-shadow` strings (including rgba and hex values) to Figma drop shadows.
* **Inputs Placeholder Layer:** Automatically inserts virtual placeholder text layers for empty `<input>` and `<textarea>` nodes.
* **Side Borders Stripe:** Detects individual thicker borders and overlays them as styled highlight stripe frames.
