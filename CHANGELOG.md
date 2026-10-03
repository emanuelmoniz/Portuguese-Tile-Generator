# Changelog

All notable changes to the Portuguese Tile Generator are documented here.
The format follows [Semantic Versioning](https://semver.org/).

## [1.0.0] – 2026-10-03

Initial public release.

### Features
- **Design Engine**: Generates Portuguese azulejo-style square tiles with D4 (four-fold rotational) symmetry using a seeded, tuned layout algorithm.
- **SVG & PNG Export**: Save vector designs (SVG) and raster previews (PNG 1200×1200 px).
- **3D Export (3MF)**: Multi-color 3D models with emboss or inlay modes. Includes Bambu Studio / Orca Slicer metadata for automatic filament assignment.
- **Customization**:
  - Tile size: 15–200 mm (square).
  - 2–4 colors with independent percentage control.
  - Coverage target: 30–90% (±5% tolerance).
  - Border frame: on, off, or random.
  - 3D settings: emboss depth (0–5 mm) or inlay (0 mm, 0.6 mm depth), plate thickness (1–10 mm).
- **UI Features**:
  - Live preview on canvas.
  - Coverage & color-share report with warnings for unmet targets.
  - Seed display and regeneration within the same design.
  - Light and dark mode toggle (system setting aware, saved to localStorage).
  - EN + PT (Portuguese) language toggle (saved to localStorage).
- **Bundle Export**: ZIP file with SVG, PNG, and 3MF together.
- **Offline**: Works completely offline from `file://` or GitHub Pages; no server required.
- **Responsive Design**: Mobile-friendly layout with Tailwind CSS.

### Foundation
- Built from the Portuguese tile design vocabulary and patterns in [132_tile-coasters-set](https://github.com/emanuelmoniz/BEKKAS).
  Ported tile geometry, motif builders, and layout logic from Python to vanilla JavaScript.
- Uses vendored libraries: Clipper (polygon boolean & offset), earcut (triangulation), fflate (ZIP).
- Static site architecture: no build step for users, no framework dependencies.

### Documentation
- **README.md**: Usage guide, parameters, 3D printing notes (Bambu/Orca, PrusaSlicer, Cura), deployment.
- **CLAUDE.md**: Technical decisions and architecture notes.
- **plan.md**: Development phases P0–P5 (completed).

### Credits
- Design and implementation: Emanuel Moniz
- License: MIT, 2026
- Brand: AZSeashell (https://azseashell.com)

---

## Future Versions (P6a–P6e, planned)

### P6a – UI Polish & Branding
- Favicon and header branding (2-color tile design).
- Footer with version, date, AZSeashell link, GitHub link.
- "About" and "Instructions" sections in the UI.

### P6b – Frame Color
- User-selectable frame color (per raised color or auto).
- Engine support for pinning frame color in design generation.

### P6c – Generate/Update Flow
- New "Generate" button (new seed, full engine run).
- "Update tile" button for style-param-only changes (preserve seed, scale & recolor).
- Confirm dialog to disambiguate intent.

### P6d – Export/Import
- JSON export of tile designs (`tile_<size>mm_seed<seed>.json`).
- JSON import with deterministic regeneration and round-trip testing.
- Copy-to-clipboard feature for design sharing.

### P6e – Tests & Finalization
- Extended test suite (8+ new cases covering frame color, update tile, export/import).
- CHANGELOG maintenance directive in CLAUDE.md.
- Version 1.0.0 official release marker.

---

## Maintenance

After each commit+push to main:
1. Update the footer date in `index.html` to today's YYYY-MM-DD.
2. Increment the version in the footer if features changed (semver).
3. Add a dated entry to this file under the version with commit hash link.

See CLAUDE.md "Maintenance: Footer and Changelog" for details.
