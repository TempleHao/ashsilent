#!/usr/bin/env python3
"""Build a locally hosted, licensed photo set for the Guobo museum guide.

Downloads real photographs from their individually checked Wikimedia Commons
file pages. Pages serves our resized WebP copies: browsers do not depend on
third-party image hosts. This runs at site build time, not in visitors' browsers.
"""
from __future__ import annotations

import hashlib
import io
import json
import pathlib
import time
import unicodedata
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = ROOT / "assets" / "image-manifest.json"
IMAGE_DIR = ROOT / "assets" / "images"
STATUS = ROOT / "assets" / "image-status.json"
ASSET_MAP = ROOT / "assets" / "image-map.js"
AGENT = "GuoboGuide/1.1 (https://github.com/TempleHao/ashsilent; educational image caching)"
LIMIT = 24 * 1024 * 1024

def get_urls(filename: str, size: int):
    name = unicodedata.normalize("NFC", filename.replace(" ", "_"))
    h = hashlib.md5(name.encode("utf-8")).hexdigest()
    part = h[0] + "/" + h[:2] + "/"
    quoted = urllib.parse.quote(name, safe="-_.()!")
    base = "https://upload.wikimedia.org/wikipedia/commons/"
    # Small originals (e.g. the Li gui photograph) have no 640px thumbnail.
    width = 320 if filename == "利簋.jpg" else size
    thumb = base + "thumb/" + part + quoted + "/" + str(width) + "px-" + quoted
    original = base + part + quoted
    redirect = "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + quoted + "?width=" + str(width)
    return [thumb, redirect, original]

def request_image(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": AGENT,
        "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*",
    })
    with urllib.request.urlopen(req, timeout=24) as resp:
        length = int(resp.headers.get("Content-Length", "0") or 0)
        if length > LIMIT:
            raise ValueError("remote file exceeds download limit")
        data = resp.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError("remote file exceeds download limit")
    with Image.open(io.BytesIO(data)) as raw:
        raw.verify()
    with Image.open(io.BytesIO(data)) as raw:
        im = ImageOps.exif_transpose(raw)
        im.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=83, method=5)
        result = buf.getvalue()
    with Image.open(io.BytesIO(result)) as check:
        check.verify()
    if len(result) < 1200:
        raise ValueError("unreasonably small image")
    return result

def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    registered, failed = {}, {}
    for key, item in catalog.items():
        target = IMAGE_DIR / (key + ".webp")
        reasons = []
        # A pre-existing image may come from a repository cache or an Actions cache.
        if target.is_file() and target.stat().st_size > 1200:
            registered[key] = target
            print("CACHED", key, target.stat().st_size, flush=True)
            continue
        for url in get_urls(item["file"], 1000 if key == "hero" else 720):
            try:
                content = request_image(url)
                target.write_bytes(content)
                registered[key] = target
                print("OK", key, len(content), url.split("/")[2], flush=True)
                break
            except Exception as exc:
                reasons.append(str(exc)[:160])
        if key not in registered:
            failed[key] = reasons
            print("FAILED", key, " | ".join(reasons[-3:]), flush=True)
        time.sleep(0.18)
    result = {}
    for key, target in registered.items():
        meta = catalog[key]
        result[key] = {
            "src": "assets/images/" + target.name,
            "file": meta["file"],
            "author": meta["author"],
            "license": meta["license"],
            "caption": meta["caption"],
            "representative": bool(meta.get("representative", False)),
            "source": "https://commons.wikimedia.org/wiki/File:" +
                urllib.parse.quote(meta["file"].replace(" ", "_"), safe="-_.()!"),
        }
    ASSET_MAP.write_text(
        "/* Generated at deploy time: validated, locally hosted museum photos. */\n" +
        "window.IMAGE_ASSETS = " + json.dumps(result, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8"
    )
    STATUS.write_text(json.dumps({
        "expected": len(catalog),
        "cached": len(registered),
        "failed": failed,
        "images": {k: v["src"] for k, v in result.items()},
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("PHOTO AUDIT", len(registered), "/", len(catalog), "cached,",
          len(failed), "failed", flush=True)
    # Do not quietly publish a website that is missing most of its images.
    if len(registered) < 22:
        raise SystemExit("Photo coverage below minimum: inspect the FAILED lines above")

if __name__ == "__main__":
    main()
