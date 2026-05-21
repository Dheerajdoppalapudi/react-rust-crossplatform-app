"""
Export router — converts HTML slide presentations to PPTX.

Uses Playwright to screenshot each slide (navigating via #btn-next),
then assembles the screenshots into a python-pptx file (16:9 widescreen).
"""

import logging
import os
import tempfile
from io import BytesIO

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class PptxExportRequest(BaseModel):
    html: str
    title: str = "Presentation"


@router.post("/api/export/pptx")
async def export_to_pptx(payload: PptxExportRequest, request: Request):
    """
    Convert an HTML slide presentation to a PPTX file.

    Playwright opens the HTML, screenshots each slide by clicking #btn-next,
    then python-pptx assembles the screenshots into a 16:9 widescreen deck.
    """
    try:
        pptx_bytes = await _render_pptx(payload.html, payload.title)
    except Exception as exc:
        logger.error("PPTX export failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"PPTX generation failed: {exc}")

    safe = "".join(c for c in payload.title if c.isalnum() or c in " _-")[:50].strip()
    filename = f"{safe.replace(' ', '_') or 'presentation'}.pptx"

    return StreamingResponse(
        BytesIO(pptx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _render_pptx(html: str, title: str) -> bytes:
    from playwright.async_api import async_playwright
    from pptx import Presentation
    from pptx.util import Inches

    # Write HTML to a temp file so Playwright can load it as file://
    with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html)
        tmp_path = f.name

    screenshots: list[bytes] = []
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page(viewport={"width": 1280, "height": 720})
            await page.goto(f"file://{tmp_path}")
            await page.wait_for_timeout(600)  # let transitions settle

            # Determine slide count from data-count attribute or .slide count
            slide_count = await page.evaluate("""
                () => {
                    const deck = document.getElementById('deck');
                    if (deck) {
                        const n = parseInt(deck.getAttribute('data-count'), 10);
                        if (n > 0) return n;
                    }
                    return document.querySelectorAll('.slide').length || 1;
                }
            """)
            slide_count = max(1, min(int(slide_count), 50))  # safety clamp

            for i in range(slide_count):
                img = await page.screenshot(type="png", full_page=False)
                screenshots.append(img)
                if i < slide_count - 1:
                    try:
                        await page.click("#btn-next")
                        await page.wait_for_timeout(450)  # slide transition
                    except Exception:
                        break

            await browser.close()
    finally:
        os.unlink(tmp_path)

    # Build PPTX (16:9 widescreen)
    prs = Presentation()
    prs.slide_width  = Inches(13.33)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6]  # blank

    for screenshot in screenshots:
        slide = prs.slides.add_slide(blank_layout)
        slide.shapes.add_picture(
            BytesIO(screenshot),
            Inches(0), Inches(0),
            Inches(13.33), Inches(7.5),
        )

    buf = BytesIO()
    prs.save(buf)
    return buf.getvalue()
