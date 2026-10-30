"""Rasterises three pages of the example Idea Book PDFs into public/examples/spreads/ for the homepage sample section.

  npx tsx scripts/generate-example-idea-book.ts     # first: re-render the example PDFs with the current renderer
  python scripts/make-sample-spreads.py              # then: cut the spreads (needs PyMuPDF: pip install pymupdf)

Pages (1-based): the cover, the profile page (profile and the four doors on one page since Phase 3) and two idea pages.
"""
import os
import pymupdf

PAGES = {1: "cover", 2: "profile", 3: "idea-1", 5: "idea-2"}
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
