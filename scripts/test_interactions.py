#!/usr/bin/env python3
"""Run real Chromium click/typing regression tests for the published guide's sources.

Loads the exact HTML/CSS/JS in Chromium without external network requests.
Exits nonzero on initialization exceptions or broken interactive controls.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def verify(page, action):
    errors = page.evaluate("window.__test_errors || []")
    if errors:
        raise AssertionError(f"{action}: unhandled browser errors: {errors}")
    print("PASS:", action, flush=True)


def run_viewport(browser, mobile):
    context = browser.new_context(
        viewport={"width": 390 if mobile else 1440, "height": 844 if mobile else 900},
        is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1,
        reduced_motion="reduce",
    )
    page = context.new_page()
    page.set_default_timeout(10000)
    page.add_init_script(
        'window.__test_errors=[];'
        'window.addEventListener("error",e=>window.__test_errors.push(e.message));'
        'window.addEventListener("unhandledrejection",e=>window.__test_errors.push(String(e.reason)));'
    )

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<script[^>]*src=["\x27][^"\x27]+["\x27][^>]*></script>', "", html)
    html = re.sub(
        r'<link[^>]*(?:href=["\x27]https?://|rel=["\x27]stylesheet["\x27])[^>]*>',
        "", html,
    )
    page.set_content(html, wait_until="domcontentloaded")
    page.add_style_tag(content=(ROOT / "style.css").read_text(encoding="utf-8"))
    page.add_script_tag(content=(ROOT / "data.js").read_text(encoding="utf-8"))
    photos = ROOT / "assets" / "image-map.js"
    if photos.exists():
        page.add_script_tag(content=photos.read_text(encoding="utf-8"))
    page.add_script_tag(content=(ROOT / "app.js").read_text(encoding="utf-8"))

    page.locator("#itinerary .route-stop").first.wait_for()
    page.locator("#eraNav .era-tab").first.wait_for()
    verify(page, "page initialization on " + ("mobile" if mobile else "desktop"))

    previous = page.locator("#routeTotal").inner_text()
    page.locator('button[data-mode="quick"]').click()
    assert page.locator('button[data-mode="quick"]').get_attribute("aria-pressed") == "true"
    assert page.locator("#routeTotal").inner_text() != previous
    verify(page, "route mode selection")

    page.locator("#startTime").select_option("10:30")
    assert "10:30" in page.locator("#routeTotal").inner_text()
    verify(page, "entry time selection")

    page.locator("#itinerary .stop-trigger").first.click()
    assert page.locator("#itinerary .stop-trigger").first.get_attribute("aria-expanded") == "true"
    verify(page, "route step expansion")

    page.locator("#tab-qinhan").click()
    assert page.locator("#tab-qinhan").get_attribute("aria-selected") == "true"
    assert "秦汉时期" in page.locator("#eraContent").inner_text()
    verify(page, "historical period tab")

    page.locator('button[data-filter="late"]').click()
    assert page.locator('button[data-filter="late"]').evaluate("el => el.classList.contains('active')")
    assert page.locator(".treasure-card").count() > 0
    verify(page, "artifact category filtering")

    page.locator(".treasure-card .check-btn").first.click()
    assert "已看过" in page.locator(".treasure-card .check-btn").first.inner_text()
    verify(page, "artifact visit check-in")

    page.locator("#searchToggle").click()
    assert not page.locator("#searchModal").is_hidden()
    page.locator("#searchInput").fill("青铜")
    assert page.locator("#searchResults button").count() > 0
    page.locator("#searchClose").click()
    assert page.locator("#searchModal").is_hidden()
    verify(page, "search dialog and search results")

    page.locator(".essay-toggle").first.click()
    assert "expand" in page.locator(".essay").first.get_attribute("class")
    verify(page, "historical essay expansion")

    page.locator('.end-section a[href="#top"]').click()
    page.wait_for_timeout(150)
    assert page.evaluate("window.scrollY") <= 5
    verify(page, "return-to-top button")

    if mobile:
        page.locator("#menuToggle").click()
        assert page.locator("#menuToggle").get_attribute("aria-expanded") == "true"
        page.locator('#mobileNav a[href="#treasures"]').click()
        assert page.locator("#menuToggle").get_attribute("aria-expanded") == "false"
        verify(page, "mobile navigation")

    context.close()


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=shutil.which("chromium") or None,
            args=["--no-sandbox"],
        )
        try:
            run_viewport(browser, False)
            run_viewport(browser, True)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
