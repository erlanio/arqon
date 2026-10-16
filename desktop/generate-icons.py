"""Generate build-only desktop icons from a small, reproducible design."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

output = Path(__file__).parent / "src-tauri" / "icons"
output.mkdir(parents=True, exist_ok=True)
image = Image.new("RGBA", (512, 512), "#202a53")
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((30, 30, 482, 482), radius=110, fill="#4259ab")
draw.rounded_rectangle((64, 64, 448, 448), radius=80, fill="#f8fafc")
draw.line((148, 180, 256, 270, 360, 180), fill="#5e6fbd", width=20, joint="curve")
for x, y in ((104, 136), (214, 226), (322, 136)):
    draw.rounded_rectangle((x, y, x + 84, y + 84), radius=15, fill="#273b80")
draw.rounded_rectangle((150, 330, 362, 392), radius=20, fill="#273b80")
image.save(output / "icon.png")
image.save(output / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
image.save(output / "icon.icns")
