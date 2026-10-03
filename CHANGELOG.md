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
- Footer: Date | Version (v1.1.0) | "by AZSeashell" link | GitHub link. Centered, subtle border-top, dark-aware.
- New sections: "About" (description) + "Instructions" (workflow bullets), EN+PT via i18n.
- CSS: Added `mb-6`, `leading-relaxed`, `underline`, `text-slate-3xx`, hover states for footer links.
- Footer init: app.js sets date (YYYY-MM-DD) and version on page load.
- [15f901a](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/15f901a)

---

## [1.2.0] – 2026-10-03 (Phase P6b – Frame Color)

**User-selectable frame color in designs.**

- "Frame color" form field: Auto, Raised 1, Raised 2, Raised 3 (enabled when border on).
- Engine: pins frame group to chosen color in color-assignment search.
- Tests: frame ring entirely in chosen color's group.
- Warning `frameColorConflict` when the pinned frame color misses its share.
- [2026-10-03] P6b: frame color parameter, form selector, engine support. [f873be8](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/f873be8)

---

## [1.3.0] – *Planned* (Phase P6c – Generate/Update Flow)

**Preserve designs while changing size/colors.**

- "Generate" button: new seed, full engine run.
- "Update tile" button: style-param-only (size/colors), scales & recolors without regenerating.
- Confirm dialog: "Generate new / Update tile / Cancel" when switching intent.
- Tests: polygon count/coverage preserved under scale+recolor.

---

## [1.4.0] – *Planned* (Phase P6d – Export/Import)

**Share and restore tile designs via JSON.**

- JSON format: `{format, version, engineVersion, seed, shapeParams, generatedSizeMm, sizeMm, colors}`.
- UI: "Export design" button (JSON file + copy-to-clipboard).
- "Generate from export" section: textarea + file picker → import & regenerate.
- Tests: export→import round-trip gives identical SVG.

---

## [1.5.0] – *Planned* (Phase P6e – Tests & Finalization)

**Comprehensive testing, documentation, version 1.5.0 release.**

- Extended test suite: 8+ new cases (frame color, update tile, export/import).
- Updated docs: CLAUDE.md user flow, CHANGELOG maintenance notes.
- Version bump: ready for major v2.0.0 after all P6 phases.

---

## [2.0.0] – *Planned* (After P6e)

**P6 complete.** Minor features + quality refinements → major version.

---

## Maintenance

**After each commit+push to main:**
1. Update `index.html` footer: date (YYYY-MM-DD), version (semver).
2. Update `CHANGELOG.md`: add entry under the current version.
   - Format: `- [YYYY-MM-DD] description. [commit](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/HASH)`
   - Example: `- [2026-10-05] P6a: footer, favicon, branding. [aef4027](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/aef4027)`

Keep footer date, version, and changelog synchronized. See CLAUDE.md "Maintenance" for details.
