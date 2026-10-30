"""Rasterises three pages of the example Idea Book PDFs into public/examples/spreads/ for the homepage sample section.

  npx tsx scripts/generate-example-idea-book.ts     # first: re-render the example PDFs with the current renderer
  python scripts/make-sample-spreads.py              # then: cut the spreads (needs PyMuPDF: pip install pymupdf)

Pages (1-based): the cover, and two idea pages. The overview (page 3) and the profile page (page 2) are left out for now: in the
current layout they are half empty, which sells the book short; the Phase 3 layout rework should bring them back (edit PAGES).
"""
import os
import pymupdf

PAGES = {1: "cover", 4: "idea-1", 7: "idea-2"}
WIDTH = 1000

root = os.path.join(os.path.dirname(__file__), "..", "public", "examples")
os.makedirs(os.path.join(root, "spreads"), exist_ok=True)
for loc in ("nl", "en"):
    doc = pymupdf.open(os.path.join(root, f"idea-book-{loc}.pdf"))
    for number, name in PAGES.items():
        page = doc[number - 1]
        zoom = WIDTH / page.rect.width
        out = os.path.join(root, "spreads", f"{loc}-{name}.jpg")
        page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(out, jpg_quality=78)
        print(out, os.path.getsize(out) // 1024, "KB")
