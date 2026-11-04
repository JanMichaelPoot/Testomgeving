"""Builds a self-contained HTML sampling sheet for a human review of the reference library.

usage: python scripts/reference-library/make-review-sheet.py [--n 30] [--seed 1] [--out reference-library/review/steekproef-ronde-1.html]

The sample is stratified: at least one activity per category, the rest drawn at random, with a guaranteed mix of
activities that are new to the app and activities with safety tier 2. Same seed = same sample.
"""
import argparse, glob, json, os, random, html

ap = argparse.ArgumentParser()
ap.add_argument("--n", type=int, default=30)
ap.add_argument("--seed", type=int, default=1)
ap.add_argument("--out", default="reference-library/review/steekproef-ronde-1.html")
args = ap.parse_args()

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
D = os.path.join(ROOT, "reference-library", "data")
cats = json.load(open(os.path.join(D, "categories.json"), encoding="utf8"))
assocs = {a["slug"]: a for a in json.load(open(os.path.join(D, "associations.json"), encoding="utf8"))}
domains = {d["slug"]: d for d in json.load(open(os.path.join(D, "association-domains.json"), encoding="utf8"))}
acts = []
for f in sorted(glob.glob(os.path.join(D, "activities", "*.json"))):
    acts += json.load(open(f, encoding="utf8"))
cat_by_id = {c["id"]: c for c in cats}

rng = random.Random(args.seed)
chosen = []
for c in cats:  # one per category
    pool = [a for a in acts if a["category"] == c["id"]]
    chosen.append(rng.choice(pool))
rest = [a for a in acts if a not in chosen]
rng.shuffle(rest)
need_new = max(0, 8 - sum(1 for a in chosen if a["match"] == "new"))
need_t2 = max(0, 3 - sum(1 for a in chosen if a["facets"]["safety_tier"] == 2))
for a in list(rest):
    if len(chosen) >= args.n:
        break
    if need_new and a["match"] == "new":
        chosen.append(a); need_new -= 1; rest.remove(a)
    elif need_t2 and a["facets"]["safety_tier"] == 2:
        chosen.append(a); need_t2 -= 1; rest.remove(a)
for a in rest:
    if len(chosen) >= args.n:
        break
    chosen.append(a)
rng.shuffle(chosen)

SET = {"indoor": "binnen", "outdoor": "buiten", "both": "binnen en buiten"}
DUR = {1: "onder een uur", 2: "1-3 uur", 3: "een halve dag of meer", 4: "meerdaags of doorlopend"}
COST = {0: "gratis", 1: "tot €15", 2: "€15-50", 3: "boven €50"}
SAFE = {0: "geen bijzonder risico", 1: "basisregels of uitrusting", 2: "alleen onder deskundig toezicht"}
LEVEL = {0: "geen ervaring nodig", 1: "basis helpt", 2: "gevorderd"}
REL = {"D": "direct", "T": "thema", "E": "ervaring", "V": "vaardigheid", "M": "materiaal", "O": "ontdekking"}


def fac(a):
    f = a["facets"]
    def v(m, k):
        return m.get(f[k], "onbekend") if f[k] is not None else "onbekend"
    return {
        "Plek": v(SET, "setting") if f["setting"] else "onbekend",
        "Duur": DUR.get(f["duration"], "onbekend"),
        "Kosten": COST.get(f["cost"], "onbekend"),
        "Niveau": LEVEL.get(f["level"], "onbekend"),
        "Veiligheid": SAFE.get(f["safety_tier"], "onbekend"),
        "Bron kenmerken": "overgenomen uit de app" if f["source"] == "app" else "door mij ingeschat",
    }


items = []
for a in chosen:
    links = []
    for l in a["links"]:
        s, sc, rel = l.split(":")
        links.append((int(sc), rel, s))
    strong = sorted([x for x in links if x[1] != "O"], key=lambda x: -x[0])[:6]
    disc = [x for x in links if x[1] == "O"]
    items.append({
        "id": a["id"], "nl": a["nl"], "en": a["en"], "cat": cat_by_id[a["category"]]["nl"], "desc": a["desc"]["nl"],
        "new": a["match"] == "new", "fac": fac(a),
        "strong": [{"slug": s, "nl": assocs[s]["nl"], "sc": sc, "rel": REL[rel], "def": assocs[s]["def"]["nl"]} for sc, rel, s in strong],
        "disc": [{"slug": s, "nl": assocs[s]["nl"], "why": a["why"][s]["nl"], "sc": sc} for sc, rel, s in disc],
        "notes": a.get("qa_notes", []),
    })

TEMPLATE = open(os.path.join(os.path.dirname(__file__), "review-sheet.template.html"), encoding="utf8").read()
out = TEMPLATE.replace("/*DATA*/[]", json.dumps(items, ensure_ascii=False)).replace("{{N}}", str(len(items)))
path = os.path.join(ROOT, args.out)
open(path, "w", encoding="utf8", newline="\n").write(out)
print("wrote", os.path.abspath(path), len(items), "records:", sum(1 for i in items if i["new"]), "new to the app,",
      sum(1 for a in chosen if a["facets"]["safety_tier"] == 2), "tier 2")
