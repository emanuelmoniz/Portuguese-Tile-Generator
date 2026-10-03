# Portuguese Tile Generator – notes for Claude

A static web app that generates Portuguese azulejo-style square tiles as SVG + PNG,
and turns them into a multi-color 3MF for 3D printing.

- `plan.md` holds the architecture, the phases (P0-P5), and the prompt for each phase.
  Work on ONE phase per conversation. When a phase is done, set its status in the
  `plan.md` phase table and commit.
- The source project this app is derived from:
  `C:\Users\emanu\OneDrive\Work\BEKKAS\3D\projects\132_tile-coasters-set`
  (`01_designs/` = Python design scripts + `CLAUDE.md` with style/symmetry rules,
  `03_blender/coasters.py` = the 3MF writer reference). Read only the files a phase prompt names.

## Decisions (fixed, do not re-ask)

### Tech
- Static site, vanilla JS, classic `<script>` tags (no ES modules, so it works from `file://`).
  Deploys unchanged to GitHub Pages. No framework, no build step for users, no DB, no server.
- Vendored libraries in `vendor/`: clipper-lib (polygon boolean + offset), earcut (triangulation),
  fflate (zip).
- Styling: Tailwind, prebuilt into `css/app.css` with the Tailwind standalone CLI
  (dev-only exe in `tools/`, gitignored). The site works offline.
  Dark/light toggle (default = system setting), remembered in `localStorage`.
- i18n: EN + PT, one dictionary in `js/i18n.js`, `data-i18n` attributes, language toggle remembered.
- JS files end with `if (typeof module !== 'undefined') module.exports = ...` so Node can load them for tests.
- Node.js = dev-only (`node test/selfcheck.js`). Python + PIL = dev-only (`test/preview.py`, PNGs for Claude to inspect).
- License MIT. Public GitHub repo `Portuguese-Tile-Generator`.

### Step 1 params (SVG)
- Tile size 15-200 mm, always square. The design is generated in real mm.
- 2-4 colors INCLUDING the base: base color + 1-3 raised colors, all hex.
- Color % = share of the raised area per raised color, must sum to 100 (1 raised color = 100).
- Coverage 30-90% (raised area / tile area). Tolerance ±5% for coverage and for each share.
- Border frame: on / off / random.
- Complexity 1-4 or Auto (user option, default 2): which and how many motifs the layout uses. Auto takes it
  from the tile size (< 30 mm: 1, < 70: 2, < 140: 3, else 4); exports made before v2.1.1 import as Auto.
- Ground modes are tried first from 50% coverage (and when the motifs alone cannot reach it).
- Shape-size limits: every printed island of a raised color is 0.05%-35% of the tile area (base, frame band
  and ground fill exempt).
- Seed is shown, plus a "Regenerate" button (new seed, same params). No style picker.
- Min raised feature 1.0 mm, min base-color channel 1.5 mm, in absolute mm, so small tiles get
  fewer and bigger motifs. If targets can't be met, show achieved vs target + a warning, never fail silently.
- Full square (D4) symmetry and padrão style, per the source project's `01_designs/../CLAUDE.md`.

### 3D params (dialog, then back to the main view)
- Emboss 0-5 mm (0 = inlay: fixed depth 0.6 mm, flush with the top). Plate thickness 1-10 mm.
- Corner radius fixed at 1 mm.
- Output 3MF: one object, one part per color; core-spec `basematerials` displaycolor per part
  + Bambu/Orca extruder metadata (other slicers ignore it). Base = slab (+ perforated top layer when inlay).
- Every mesh must be watertight (each edge used exactly twice) with positive volume.

### User flow
1. Set params (incl. frame color, optional, default "Auto") → Generate (new seed) or Update tile (style params only: size, colors, frame color)
2. A confirm dialog may appear when switching between Update and Generate
3. Preview (PNG drawn on canvas) + report (coverage, shares, warnings)
4. Save SVG / PNG, or export the design (JSON)
5. "Generate 3D" button → 3D settings dialog → Generate 3MF (emboss/inlay) → main view switches to the 3D viewer
6. Save 3MF, or save bundle (.zip with SVG + PNG + 3MF)
7. Import an export (paste or upload JSON) to regenerate a previous design
8. Clear all and start fresh

Save buttons stay disabled until their file exists. 3D viewer: three.js r147 (vendored), shows the generated 3MF meshes, orbit/zoom, 2D/3D toggle on the preview.

### Rebuild css
After adding Tailwind classes: `tools\tailwindcss.exe -i css/input.css -o css/app.css --minify`
(standalone CLI v4 from github.com/tailwindlabs/tailwindcss/releases, `tailwindcss-windows-x64.exe` saved as `tools/tailwindcss.exe`).

### Maintenance: Footer and Changelog
**Versioning strategy:** Semantic versioning (major.minor.patch). Each phase bumps the minor version:
- v1.0.0: P0–P5 (initial release, complete).
- v1.1.0 – v1.5.0: P6a–P6e (one per phase).
- v2.0.0: P6 complete (released).
- v2.1.0-v2.3.0: P7a-P7c (shape limits, 3D viewer, redesign).
- v3.0.0: P7 complete.

After each commit+push to main:
1. Update `index.html` footer: 
   - Year: the current year, set automatically by `js/app.js` (never edit by hand).
   - Version: bump minor (e.g., 1.0.0 → 1.1.0 for P6a) if a phase is complete; otherwise keep it.
2. Update `CHANGELOG.md`: add an entry under the current version with today's date and commit link.
   Format: `- [YYYY-MM-DD] description of change(s). [commit](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/HASH)`
   Example: `- [2026-10-05] P6a: favicon, footer, branding. [aef4027](https://github.com/emanuelmoniz/Portuguese-Tile-Generator/commit/aef4027)`

Keep the footer version and CHANGELOG.md synchronized. Phase prompts in `plan_v2.md` specify exact version bumps.
