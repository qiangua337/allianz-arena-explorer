import hashlib
import json
from pathlib import Path

from PIL import Image


def main():
    asset_dir = Path(__file__).resolve().parents[1] / "dist" / "assets" / "pbr"
    sources = json.loads((asset_dir / "manifest.json").read_text(encoding="utf-8"))
    output_dir = asset_dir / "mobile"
    output_dir.mkdir(exist_ok=True)
    output = {"resolution": 512, "maps": {}}

    for asset in sources["assets"].values():
        for kind, entry in asset["maps"].items():
            source = Path(entry["file"])
            if source.suffix != ".jpg":
                continue

            target = output_dir / source.with_suffix(".webp")
            with Image.open(asset_dir / source) as image:
                channel_mode = "L" if kind == "rough" else "RGB"
                resized = image.convert(channel_mode).resize((512, 512), Image.Resampling.LANCZOS)
                resized.save(target, "WEBP", lossless=kind == "normal", quality=88, method=6)

            data = target.read_bytes()
            output["maps"][source.name] = {
                "file": target.name,
                "bytes": len(data),
                "md5": hashlib.md5(data).hexdigest(),
            }

    (output_dir / "manifest.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
