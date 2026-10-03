# Changelog

All notable changes to the Portuguese Tile Generator are documented here.
Format: [Semantic Versioning](https://semver.org/) — v[major].[minor].[patch].

---

## [1.0.0] – 2026-10-03

**Initial public release** (Phases P0–P5 complete).

### Core Features
- **Design Engine**: Generates Portuguese azulejo-style square tiles with D4 (four-fold rotational) symmetry via seeded, tuned layout algorithm.
- **Multi-format Export**: SVG (vector), PNG (1200×1200 px raster), 3MF (multi-color 3D).
- **3D Modes**: Emboss (raised 0–5 mm) or inlay (recessed 0.6 mm, flush).
- **Customization**: Tile size (15–200 mm), 2–4 colors with % control, coverage (30–90%), border (on/off/random), 3D thickness (1–10 mm).
- **UI**: Live canvas preview, coverage report with warnings, seed display, light/dark toggle, EN+PT language toggle, localStorage persistence.
- **3D Printing**: 3MF includes Bambu Studio / Orca Slicer auto-color metadata; PrusaSlicer / Cura manual assignment.
- **Bundles**: ZIP export with SVG + PNG + 3MF.
- **Offline**: Works offline from `file://` or GitHub Pages; no server required.

### Architecture
- Vanilla JS, no framework, no build step for users.
- Vendored: Clipper (polygon ops), earcut (triangulation), fflate (ZIP).
- Tailwind CSS, prebuilt into `css/app.css`.
- Node.js + Python dev-only (tests, preview).

### Credits
- Design & implementation: Emanuel Moniz
- Pattern source: [132_tile-coasters-set](https://github.com/emanuelmoniz/BEKKAS)
- License: MIT, 2026
- Brand: AZSeashell (https://azseashell.com)

---

## [1.1.0] – 2026-10-03 (Phase P6a – UI Polish & Branding)

**Favicon, header branding, footer, About/Instructions sections.**

- Favicon: 2-color (#1d4e9e + white) tile SVG, linked in `<head>`.
- Header: Tile SVG logo (48px) next to title.
- Footer: Year | Version (v1.1.0) | "by AZSeashell" link | GitHub link. Centered, subtle border-top, dark-aware.
- New sections: "About" (description) + "Instructions" (workflow bullets), EN+PT via i18n.
- CSS: Added `mb-6`, `leading-relaxed`, `underline`, `text-slate-3xx`, hover states for footer links.
- Footer init: app.js sets the current year and version on page load.
- [1f70952](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/1f70952)

---

## [1.2.0] – 2026-10-03 (Phase P6b – Frame Color)

**User-selectable frame color in designs.**

- "Frame color" form field: Auto, Raised 1, Raised 2, Raised 3 (enabled when border on).
- Engine: pins frame group to chosen color in color-assignment search.
- Tests: frame ring entirely in chosen color's group.
- Warning `frameColorConflict` when the pinned frame color misses its share.
- [2026-10-03] P6b: frame color parameter, form selector, engine support. [4cdec77](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/4cdec77)

---

## [1.3.0] – 2026-10-03 (Phase P6c – Generate/Update Flow)

**Preserve designs while changing size/colors.**

- "Generate" button: new seed, full engine run.
- "Update tile" button: style-param-only (size/colors), scales & recolors without regenerating.
- Confirm dialog: "Generate new / Update tile / Cancel" when switching intent.
- Tests: polygon count/coverage preserved under scale+recolor; Update-enable state logic.
- [2026-10-03] P6c: Generate/Update flow, confirm dialog, state tracking. [b1329a6](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/b1329a6)
- [2026-10-03] Frame color change is a style update: only the frame moves to the new color, shapes kept. [017fac9](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/017fac9)

---

## [1.4.0] – 2026-10-03 (Phase P6d – Export/Import)

**Share and restore tile designs via JSON.**

- JSON format: `{format, version, engineVersion, seed, shapeParams, generatedSizeMm, sizeMm, colors}`.
- UI: "Export design" button (JSON file + copy-to-clipboard).
- "Generate from export" section: textarea + file picker → import & regenerate.
- Tests: export→import round-trip gives identical SVG.
- [2026-10-03] P6d: JSON export/import, design sharing, round-trip testing. [28f9445](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/28f9445)

---

## [1.5.0] – 2026-10-03 (Phase P6e – Tests & Finalization)

**P6a–P6e complete. Next: v2.0.0 after stabilization.**

- Test suite: 10 new cases (frame color 1/2/3 within ±5%, update-tile style vs shape params, export/import round trips across sizes, color counts, frameColor).
- Docs: CLAUDE.md user flow updated for P6 features.
- engineVersion and footer bumped to 1.5.0.
- Based on Portuguese tile patterns from the source project (132_tile-coasters-set).
- [2026-10-03] P6e: comprehensive test suite, version 1.5.0, P6 finalization. [3494a92](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/3494a92)

---

## [2.0.0] – 2026-10-03 (P6 complete)

**P6a–P6e complete.** Branding, frame color, Generate/Update flow, JSON export/import, and the full test suite.

- [2026-10-03] Version bump to 2.0.0 (footer, engineVersion). [3b1d3b1](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/3b1d3b1)

---

## [2.1.0] – 2026-10-03 (Phase P7a – Shape-size limits)

- Every printed island of a raised color is kept between a min and a max % of the tile area (defaults 0.05% / 35%); the base, the frame band and the ground fill are exempt. The report shows the shape count and range, with warnings when a shape still breaks a limit.
- Temporary dev panel (min / max shape %) to tune the limits.
- Fix: some designs failed 3MF generation ("mesh not watertight").
- Engine 2.1.0: designs from older exports may differ.
- [2026-10-03] P7a: shape-size limits (min/max island %), dev panel. [1debb3e](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/1debb3e)

---

## [2.1.1] – 2026-10-03

- New **Complexity** option (Auto / 1–4, default 2) sets how many motifs a tile gets; Auto picks it from the tile size, as before. It is saved in the export; older exports import as Auto.
- Filled-background layouts are tried first from 50% coverage (was 45%).
- Thin-shape warnings now say the design is not suited for 3D printing and suggest a bigger tile or a lower complexity.
- Shape-size limits fixed at 0.05% / 35%; the dev panel is removed.
- Fix: two raised colors could overlap in rare designs.
- [2026-10-03] Complexity option, final shape limits, dev panel removed. [7dcfb54](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/7dcfb54)

---

## Maintenance

**After each commit+push to main:**
1. Update `index.html` footer version (semver; the year is automatic).
2. Update `CHANGELOG.md`: add entry under the current version.
   - Format: `- [YYYY-MM-DD] description. [commit](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/[3494a92](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/3494a92))`
   - Example: `- [2026-10-05] P6a: footer, favicon, branding. [1f3cb22](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/1f3cb22)`

Keep footer version and changelog synchronized. See CLAUDE.md "Maintenance" for details.
