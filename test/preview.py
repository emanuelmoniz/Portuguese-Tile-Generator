"""Dev only: render the engine dumps test/out/*.json (written by selfcheck.js) to PNG, plus test/out/sheet.png."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageColor, ImageDraw

PX = 500
OUT = Path(__file__).parent / "out"


def render(d):
    s = PX / d["size"]
    img = Image.new("RGB", (PX, PX), d["colors"][0])
    for color, shapes in zip(d["colors"][1:], d["groups"]):
        mask = Image.new("1", (PX, PX), 0)
        for shape in shapes:
            for ring in shape:  # even-odd: xor every ring into the mask
                m = Image.new("1", (PX, PX), 0)
                ImageDraw.Draw(m).polygon([(x * s, y * s) for x, y in ring], fill=1)
                mask = ImageChops.logical_xor(mask, m)
        img.paste(ImageColor.getrgb(color), mask=mask)
    return img


files = sorted(OUT.glob("*.json"))
tiles = []
for f in files:
    d =json.loads(f.read_text())
    img = render(d)
    img.save(f.with_suffix(".png"))
    tiles.append((f.stem, img))

cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (PX + 10), rows * (PX + 30)), "#888888")
for i, (name, img) in enumerate(tiles):
    x, y = (i % cols) * (PX + 10), (i // cols) * (PX + 30)
    sheet.paste(img, (x, y + 20))
    ImageDraw.Draw(sheet).text((x + 4, y + 4), name, fill="black")
sheet.save(OUT / "sheet.png")
print(f"rendered {len(tiles)} previews + sheet.png in {OUT}")
