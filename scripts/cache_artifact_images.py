#!/usr/bin/env python3
"""Cache correctly attributed Wikimedia Commons photographs into this repository.

The generated JPG/PNG files are a build asset, not hand-edited originals.
See assets/image-manifest.json for source titles, authors and licenses.
"""
from __future__ import annotations
import hashlib
import json
import pathlib
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "assets" / "image-manifest.json"
TARGET = ROOT / "assets" / "images"
STATUS = ROOT / "assets" / "image-status.json"
AGENT = "GuoboGuide/1.1 (https://github.com/TempleHao/ashsilent; educational image caching)"
MAX_BYTES = 15 * 1024 * 1024

def urls(filename, width=640):
    name = unicodedata.normalize("NFC", filename.replace(" ", "_"))
    digest = hashlib.md5(name.encode("utf-8")).hexdigest()
    folder = digest[0] + "/" + digest[:2] + "/"
    quoted = urllib.parse.quote(name, safe="-_.()!")
    base = "https://upload.wikimedia.org/wikipedia/commons/"
    original = base + folder + quoted
    size = min(width, 480) if name in ("Houmuwu_Ding_or_Simuwu_Ding.jpg", "利簋.jpg") else width
    thumbnail = base + "thumb/" + folder + quoted + "/" + str(size) + "px-" + quoted
    commons = "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + quoted + "?width=" + str(size)
    return [thumbnail, commons, original]

def fetch(url):
    request = urllib.request.Request(url, headers={
        "User-Agent": AGENT, "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*",
    })
    with urllib.request.urlopen(request, timeout=18) as r:
        length = int(r.headers.get("Content-Length", "0") or 0)
        if length > MAX_BYTES:
            raise ValueError("remote image too large")
        payload = r.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise ValueError("download exceeded safety limit")
        if payload.startswith(b"\\xff\\xd8\\xff"):
            return payload, ".jpg"
        if payload.startswith(b"\\x89PNG\\r\\n\\x1a\\n"):
            return payload, ".png"
        if payload.startswith(b"RIFF") and payload[8:12] == b"WEBP":
            return payload, ".webp"
        raise ValueError("response is not a recognized bitmap: " + repr(payload[:32]))

def main():
    catalog = json.loads(MANIFEST.read_text(encoding="utf-8"))
    TARGET.mkdir(parents=True, exist_ok=True)
    report = {"photographs": {}, "failed": {}}
    for key, item in catalog.items():
        ext = pathlib.Path(item["file"]).suffix.lower()
        prev = next((TARGET / (key + e) for e in (".jpg", ".png", ".webp") if (TARGET / (key + e)).exists()), None)
        if prev and prev.stat().st_size > 1500:
            report["photographs"][key] = {"path": str(prev.relative_to(ROOT)), "bytes": prev.stat().st_size, "source": item["file"], "cached": True}
            print("CACHED", key, flush=True)
            continue
        errors = []
        for url in urls(item["file"], 1120 if key == "hero" else 640):
            for attempt in range(2):
                try:
                    data, actual_ext = fetch(url)
                    target = TARGET / (key + actual_ext)
                    target.write_bytes(data)
                    report["photographs"][key] = {"path": str(target.relative_to(ROOT)), "bytes": len(data), "source": item["file"], "cached": True}
                    print("OK", key, len(data), target.name, flush=True)
                    break
                except Exception as exc:
                    errors.append(str(exc)[:160])
                    if attempt == 0:
                        time.sleep(0.8)
            if key in report["photographs"]:
                break
        else:
            report["failed"][key] = errors[-3:]
            print("FAILED", key, errors[-1] if errors else "no response", flush=True)
        time.sleep(0.35)
    report["total"] = len(catalog)
    report["cached"] = len(report["photographs"])
    STATUS.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("COMPLETE", report["cached"], "/", report["total"], flush=True)
    # An incomplete catalog should not silently publish as a full-picture guide.
    if report["cached"] < 20:
        sys.exit("Could not acquire 20 reference photos; inspect reported failures.")

if __name__ == "__main__":
    main()
