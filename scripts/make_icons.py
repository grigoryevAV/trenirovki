"""Иконки PWA из art/icon-source.png (рисунок владелицы: варварка с огненными волосами).

У исходника светлые углы за скруглённой рамкой — заливаются фоном, затем кадр кадрируется так,
чтобы лицо и кулак попадали в центральные 80 % (Android обрезает maskable-иконку до круга).
Запуск из папки проекта: python scripts/make_icons.py
"""
import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "icon-source.png"
ICONS = ROOT / "public" / "icons"
BG = (0, 0, 0)
# кадр в координатах исходника 1254×1254 (может выходить за край — там фон): центр между лицом и кулаком,
# чтобы оба попали в круг Android
CROP = (60, -100, 1060, 900)
TARGETS = [("icon-192.png", 192), ("icon-512.png", 512), ("icon-maskable-512.png", 512), ("apple-touch-icon.png", 180)]


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    # углы за скруглённой рамкой исходника — светлые; закрасить всё, что вне скруглённого квадрата
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((22, 22, w - 23, h - 23), radius=int(w * 0.17), fill=255)
    base = Image.new("RGB", (w, h), BG)
    base.paste(im, (0, 0), mask)
    l, t, r, b = CROP
    art = Image.new("RGB", (r - l, b - t), BG)
    art.paste(base, (-l, -t))
    for name, size in TARGETS:
        art.resize((size, size), Image.LANCZOS).save(ICONS / name, optimize=True)
        print("готово:", name)
    # SVG-иконка (favicon): тот же рисунок, встроенный PNG 128×128
    buf = io.BytesIO()
    art.resize((128, 128), Image.LANCZOS).save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    (ICONS / "icon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 128 128">'
        f'<image width="128" height="128" href="data:image/png;base64,{b64}"/></svg>\n',
        encoding="utf-8",
    )
    print("готово: icon.svg")


if __name__ == "__main__":
    main()
