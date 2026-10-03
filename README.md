# Portuguese Tile Generator

A static web app that generates Portuguese azulejo-style square tiles as SVG, PNG, and multi-color 3MF for 3D printing.

## What It Does

- **Generate tiles:** Specify a tile size (15–200 mm), 2–4 colors with coverage percentage, and coverage target (30–90%). The engine produces a unique design with perfect D4 (four-fold rotational) symmetry, inspired by traditional Portuguese tilework.
- **Preview & report:** See the generated tile on canvas, with measurements of achieved coverage and color distribution, plus warnings if targets are missed.
- **Save assets:** Export the design as SVG (vector), PNG (raster), or 3MF (multi-color 3D model).
- **Shape limits:** every printed island of a raised color is 0.05%–35% of the tile area (base, frame band and ground fill exempt), so no specks and no giant blobs.
- **3D viewer:** after Generate 3D, orbit and zoom the real 3MF meshes in the browser (2D/3D toggle on the preview).
- **3D printing:** Choose emboss (raised details) or inlay (recessed details), set plate thickness, and export as 3MF. The sliced format includes color assignments for Bambu Studio and Orca Slicer.

## Getting Started

### Run Locally

Simply double-click `index.html` in your file manager, or open it in a browser with `file://` protocol. No server, no build step—works offline.

Alternatively, clone and open:
```bash
git clone https://github.com/emanuelmadafaka/Portuguese-Tile-Generator.git
cd Portuguese-Tile-Generator
# Double-click index.html or open in browser
```

### Parameters

**Step 1: Generate**

- **Tile size** (mm): 15–200, always square.
- **Number of colors**: 2–4 total (includes base + raised colors).
- **Colors**: Hex codes for base (non-raised background) and 1–3 raised (embossed/inlaid) colors.
- **Color %%**: Percentage of raised area per raised color; must sum to 100%. Single raised color = 100%.
- **Coverage**: Target raised area as % of tile; 30–90%. Tolerance ±5%.
- **Border frame**: On (decorative frame), Off, or Random (decided by the seed).

**Step 2: 3D Settings (optional)**

- **Emboss depth** (mm): 0–5. At 0, uses inlay (fixed 0.6 mm depth, flush with top).
- **Plate thickness** (mm): 1–10. Total height of the base slab.

All measurements are in absolute mm, so smaller tiles get fewer, bigger motifs to preserve printability (min feature 1.0 mm, min base channel 1.5 mm).

## Saving & Exporting

After generating:

1. **Save SVG**: Vector format, scalable, editable in Inkscape or Adobe Illustrator.
2. **Save PNG**: Raster preview at 1200×1200 px.
3. **Settings 3D**: Opens a dialog for emboss/inlay and plate thickness.
4. **Generate 3MF**: Creates the 3D model (appears after 3D settings).
5. **Save 3MF**: Multi-color 3D model, ready to slice and print.
6. **Save Bundle**: ZIP file with SVG + PNG + 3MF.
7. **Clear**: Reset the form and start fresh.

## 3D Printing & Slicer Notes

### Bambu Studio / Orca Slicer

The 3MF includes color metadata. Filaments are assigned automatically to each part:

1. Open `tile_*.3mf` in Bambu Studio or Orca Slicer.
2. Each part is already a separate object with a color tag.
3. Assign a physical filament to each part in the slicer.
4. Slice and print.

### PrusaSlicer / Cura

These slicers import the parts without automatic color assignment:

1. Open `tile_*.3mf`.
2. In the part list, right-click each part and assign a filament color.
3. Slice and print.

### General Notes

- **Layer height**: 0.1 or 0.15 mm recommended for detail.
- **Infill**: 100% (solid parts).
- **Support**: May be needed under fine features; preview in your slicer.
- **Print time**: Varies by tile size and emboss depth; 50 mm tiles take ~30–60 min at 0.1 mm layer height.

## Deploy to GitHub Pages

The site is ready for GitHub Pages deployment. After cloning locally:

```bash
git push origin main
```

Then, in your GitHub repo:

1. Go to **Settings → Pages**.
2. Set **Source** to `main` branch, **root** folder.
3. Save. The site will appear at `https://your-username.github.io/Portuguese-Tile-Generator/`.

## Development

### Run Tests

```bash
node test/selfcheck.js
```

Runs 8 engine cases (15–200 mm tiles, 1–3 colors, coverage 30–90%, borders on/off). Outputs:
- Achieved coverage and color distribution (vs. targets).
- Warnings for thinFeatures, thinChannels, symmetry mismatches.
- JSON dumps for preview.py inspection.

### Preview Designs (Python, dev only)

After running selfcheck, visualize the designs:

```bash
python test/preview.py
```

Requires: Python 3, PIL (Pillow), numpy, scipy. Outputs PNG previews of each test case to `test/out/`.

### Rebuild Tailwind CSS

If you edit `index.html` and add new Tailwind classes:

```bash
tools\tailwindcss.exe -i css/input.css -o css/app.css --minify
```

The standalone CLI is included in `tools/` (Windows 64-bit). For other platforms, download from [tailwindcss releases](https://github.com/tailwindlabs/tailwindcss/releases).

## Architecture

- **index.html**: Static HTML shell with form and preview canvas.
- **js/shapes.js**: Geometry primitives (petals, stars, frames, lobed shapes).
- **js/check.js**: Coverage, color, and symmetry analysis; SVG writer.
- **js/motifs.js**: Symmetric motif builders (palmettes, tulips, medallions, etc.).
- **js/engine.js**: Seeded layout engine with tuning loop for coverage/shares.
- **js/mesh3mf.js**: 3D extrusion and 3MF writer (Bambu/Orca metadata).
- **js/app.js**: UI state, form validation, preview, and file I/O.
- **js/i18n.js**: English and Portuguese strings.
- **vendor/**: Clipper (polygon boolean), earcut (triangulation), fflate (ZIP), three.js r147 + OrbitControls (3D viewer, MIT).
- **css/app.css**: Tailwind-compiled styles (prebuilt, no build step needed).

## Languages

English and Portuguese (PT). Toggle in the top-right corner. Language preference is saved to browser storage.

## Theme

Dark and light modes. Automatically matches your system setting, or toggle manually. Theme preference is saved.

## Credits

3D viewer: [three.js](https://threejs.org) r147 (MIT), vendored. Fonts Lusitana and Albert Sans (OFL).

## License

MIT, © 2026 Emanuel Moniz. See [LICENSE](LICENSE).

---

## Portuguese / Português

### O Que É

Um gerador web estático de azulejos portugueses. Especifique o tamanho, cores, cobertura e gere um padrão único com simetria perfeita. Exporte como SVG, PNG ou 3MF para impressão 3D.

### Como Usar

1. Abra `index.html` no navegador (funciona offline).
2. Configure o tamanho do azulejo, cores e cobertura.
3. Clique em **Gerar** para criar um novo padrão.
4. Visualize o resultado e o relatório.
5. Exporte como SVG, PNG ou 3MF.
6. (Opcional) Configure emboss/inlay e exporte para impressão 3D.

### Parâmetros

- **Tamanho** (mm): 15–200.
- **Cores**: 2–4 (inclui a cor base + 1–3 cores em relevo).
- **Percentagem**: Distribuição das cores em relevo; deve somar 100%.
- **Cobertura**: Percentagem de área em relevo; 30–90%.
- **Moldura**: Ativar, desativar ou aleatório.

### Impressão 3D

Abra o ficheiro `tile_*.3mf` no Bambu Studio, Orca Slicer, PrusaSlicer ou Cura. Atribua cores de filamento a cada peça conforme necessário.

Para mais detalhes, veja a seção "3D Printing & Slicer Notes" acima.

---

**Status**: Ready to use. Full documentation in English above; Portuguese summary here.
