"""Exports the WindowInto Activity Reference Library (reference-library/data) to one Excel master database.

    npm run reflib:export
    python scripts/reference-library/export-xlsx.py [output.xlsx]

Tabs: Leeswijzer, Categories, Association_Domains, Associations, Activities, Activity_Associations, Coverage.
Skills and experiences per activity are DERIVED from its links (strongest linked associations in those domains);
nothing is typed twice. Run `npm run reflib:check` first: this script does not validate.
"""
import collections
import glob
import json
import os
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
DATA = os.path.join(ROOT, "reference-library", "data")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "reference-library", "export", "WindowInto_Activity_Reference_Library_v1.0.xlsx")

RELATION = {"D": "Direct", "T": "Thematisch", "E": "Ervaringsgericht", "V": "Vaardigheidsgericht", "M": "Materiaalgericht", "O": "Ontdekkingsgericht"}
SCORE = {5: "5 kern", 4: "4 sterk", 3: "3 matig", 2: "2 zwak", 1: "1 vaag"}
SETTING = {"indoor": "binnen", "outdoor": "buiten", "both": "binnen en buiten", None: "onbekend"}
LEVEL = {0: "geen ervaring nodig", 1: "basis helpt", 2: "gevorderd", None: "onbekend"}
DURATION = {1: "< 1 uur", 2: "1-3 uur", 3: "halve dag of meer", 4: "meerdaags of doorlopend", None: "onbekend"}
COST = {0: "gratis", 1: "tot 15", 2: "15-50", 3: "boven 50", None: "onbekend"}
SAFETY = {0: "geen bijzonder risico", 1: "basisregels of uitrusting", 2: "alleen onder gekwalificeerd toezicht", None: "onbekend"}
MATCH = {"exact": "zelfde als in de app", "close": "lijkt op iets in de app", "new": "nieuw t.o.v. de app"}


def load(name):
    with open(os.path.join(DATA, name), encoding="utf8") as f:
        return json.load(f)


cats = load("categories.json")
domains = load("association-domains.json")
assocs = load("associations.json")
acts = []
for fn in sorted(glob.glob(os.path.join(DATA, "activities", "*.json"))):
    with open(fn, encoding="utf8") as f:
        acts.extend(json.load(f))

cat_by_id = {c["id"]: c for c in cats}
dom_by_slug = {d["slug"]: d for d in domains}
assoc_by_slug = {a["slug"]: a for a in assocs}


def links_of(a):
    out = []
    for s in a["links"]:
        slug, score, rel = s.split(":")
        t = assoc_by_slug[slug]
        out.append({"slug": slug, "score": int(score), "rel": rel, "assoc": t})
    return sorted(out, key=lambda l: (-l["score"], l["slug"]))


def top(links, doms, n=4):
    return ", ".join([l["assoc"]["nl"] for l in links if l["assoc"]["domain"] in doms and l["score"] >= 3][:n])


HEAD_FILL = PatternFill("solid", fgColor="3C2920")
HEAD_FONT = Font(bold=True, color="FFFFFF")
WRAP = Alignment(wrap_text=True, vertical="top")


def sheet(wb, title, headers, rows, widths):
    ws = wb.create_sheet(title)
    ws.append(headers)
    for r in rows:
        ws.append(r)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in ws[1]:
        c.fill, c.font = HEAD_FILL, HEAD_FONT
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = WRAP
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    return ws


wb = Workbook()
wb.remove(wb.active)

# --- Leeswijzer ---------------------------------------------------------------------------------------------
counts = collections.Counter(a["category"] for a in acts)
n_links = sum(len(a["links"]) for a in acts)
n_o = sum(1 for a in acts for s in a["links"] if s.endswith(":O"))
ws = wb.create_sheet("Leeswijzer")
text = [
    ("WindowInto Activity Reference Library v1.0", True),
    ("Een zelfstandige referentielaag naast de bibliotheek van de app: categorieën, activiteiten, associaties en de gewogen koppelingen daartussen.", False),
    ("", False),
    (f"Nu: {len(acts)} activiteiten in {len(counts)} van {len(cats)} categorieën, {len(assocs)} associaties in {len(domains)} domeinen, {n_links} koppelingen ({n_o} ontdekkingsgericht).", False),
    ("Alles staat op status Concept: de relevantiescores zijn redactionele inschattingen, geen metingen. Pas na menselijke review wordt iets Reviewed of Approved.", False),
    ("", False),
    ("Tabbladen", True),
    ("Categories: de 20 hoofdcategorieën met streefaantal; een activiteit heeft precies één primaire categorie.", False),
    ("Association_Domains: de 10 domeinen (gecontroleerde woordenlijst) waarin associaties zijn ingedeeld.", False),
    ("Associations: alle associaties met domein, definitie in NL en EN, en het id uit de eerste werkmap (v0_id) of de dichtstbijzijnde tag van de app.", False),
    ("Activities: de activiteiten met type, subcategorie, beschrijving NL/EN, kenmerken en de koppeling met de bibliotheek van de app (match + legacy_id). Vaardigheden en ervaringen zijn AFGELEID uit de koppelingen.", False),
    ("Activity_Associations: één rij per koppeling met score 1-5 en relatievorm; bij Ontdekkingsgericht staat de reden erbij.", False),
    ("Review: de bevindingen van de kwaliteitsronde (vier beoordelaarsrollen), wat is aangepast en wat open staat. App_Vocabulaire_Advies: voorstellen voor extra tags in de app.", False),
    ("Coverage: aantallen per categorie, relatievorm en domein.", False),
    ("", False),
    ("Relevantiescore", True),
    ("5 = kern van de activiteit · 4 = sterk · 3 = matig · 2 = zwak · 1 = vaag. Ontdekkingsgerichte koppelingen krijgen bewust hoogstens 3: ze zijn indirect.", False),
    ("", False),
    ("Relatievormen", True),
    ("Direct: de activiteit gaat er letterlijk over. Thematisch: zelfde thema. Ervaringsgericht: het gevoel dat het geeft. Vaardigheidsgericht: de vaardigheid die je gebruikt. Materiaalgericht: het materiaal. Ontdekkingsgericht: een niet voor de hand liggend maar redelijk pad dat een nieuwe richting opent, met een opgeschreven reden.", False),
    ("", False),
    ("Herkenning en ontdekking", True),
    ("Herkenning = hoge scores op Direct, Materiaal en Vaardigheid (wat iemand al kent). Ontdekking = de Ontdekkingsgerichte koppelingen en verwante associaties van andere activiteiten (wat iemand nog niet bedacht).", False),
    ("", False),
    ("Kenmerken", True),
    ("Binnen/buiten, sociale vorm, niveau, duur, kosten en veiligheid gebruiken dezelfde schalen als de app. Bij een activiteit die ook in de app staat zijn de waarden van de app overgenomen (bron: app); bij nieuwe activiteiten zijn ze door ons ingeschat (bron: authored). Onbekend blijft leeg en wordt nooit verzonnen.", False),
    ("", False),
    ("Bronnen en licenties", True),
    ("ICATUS, ESCO en WHO ICF zijn alleen als inspiratie voor volledigheid gebruikt; er is geen inhoud overgenomen. Controleer de licentie voordat je dat wel doet.", False),
]
for line, bold in text:
    ws.append([line])
    ws.cell(ws.max_row, 1).font = Font(bold=bold, size=14 if bold and ws.max_row == 1 else 11)
    ws.cell(ws.max_row, 1).alignment = Alignment(wrap_text=True, vertical="top")
ws.column_dimensions["A"].width = 130

# --- Categories -----------------------------------------------------------------------------------------------
sheet(wb, "Categories", ["category_id", "slug", "categorie (NL)", "category (EN)", "streefaantal", "nu", "bereik (NL)", "scope (EN)"],
      [[c["id"], c["slug"], c["nl"], c["en"], c["target"], counts.get(c["id"], 0), c["scope"]["nl"], c["scope"]["en"]] for c in cats],
      [12, 14, 44, 44, 12, 8, 60, 60])

sheet(wb, "Association_Domains", ["slug", "domein (NL)", "domain (EN)", "toelichting (NL)", "note (EN)", "associaties"],
      [[d["slug"], d["nl"], d["en"], d["note"]["nl"], d["note"]["en"], sum(1 for a in assocs if a["domain"] == d["slug"])] for d in domains],
      [16, 22, 22, 60, 60, 12])

sheet(wb, "Associations", ["association_id", "slug", "domein", "naam (NL)", "name (EN)", "definitie (NL)", "definition (EN)", "afbakening (NL)", "scope (EN)", "id in eerste werkmap", "app-tag", "aantal activiteiten"],
      [[a["id"], a["slug"], dom_by_slug[a["domain"]]["nl"], a["nl"], a["en"], a["def"]["nl"], a["def"]["en"], a.get("scope", {}).get("nl", ""), a.get("scope", {}).get("en", ""), a.get("v0_id", ""), a.get("app_tag", ""),
        sum(1 for x in acts for s in x["links"] if s.split(":")[0] == a["slug"])] for a in assocs],
      [14, 16, 22, 24, 24, 50, 50, 50, 50, 14, 14, 12])

# --- Activities -----------------------------------------------------------------------------------------------
rows = []
for a in acts:
    L = links_of(a)
    f = a["facets"]
    rows.append([
        a["id"], a["slug"], a["nl"], a["en"], cat_by_id[a["category"]]["nl"], a["sub"]["nl"], a["sub"]["en"], "/".join(a["types"]),
        a["desc"]["nl"], a["desc"]["en"],
        top(L, ["skills"]), top(L, ["experiences", "senses", "aesthetics"]),
        SETTING[f["setting"]], ", ".join(f["social_formats"] or []) or "onbekend", LEVEL[f["level"]], DURATION[f["duration"]], COST[f["cost"]], SAFETY[f["safety_tier"]], f["source"],
        MATCH[a["match"]], a.get("legacy_id") or "", a.get("v0_id", ""), len(L), sum(1 for l in L if l["rel"] == "O"), a["status"],
        ("ronde %d, %s" % (a["qa"]["round"], "aangepast" if a["qa"]["result"] == "adjusted" else "gecontroleerd")) if a.get("qa") else "",
        " | ".join(a.get("qa_notes", [])),
    ])
sheet(wb, "Activities",
      ["activity_id", "slug", "naam (NL)", "name (EN)", "primaire categorie", "subcategorie (NL)", "subcategory (EN)", "type", "beschrijving (NL)", "description (EN)",
       "vaardigheden (afgeleid)", "ervaringen (afgeleid)", "binnen/buiten", "sociale vorm", "niveau", "duur", "kosten", "veiligheid", "bron kenmerken",
       "vergelijking met app", "app-id (legacy_id)", "id in eerste werkmap", "koppelingen", "waarvan ontdekking", "status", "kwaliteitscontrole", "opmerkingen kwaliteitscontrole"],
      rows, [11, 28, 38, 38, 36, 24, 24, 10, 60, 60, 44, 44, 16, 26, 20, 22, 12, 28, 12, 24, 22, 14, 11, 11, 10, 22, 70])

# --- Activity_Associations --------------------------------------------------------------------------------------
rows = []
for a in acts:
    for l in links_of(a):
        t = l["assoc"]
        why = a["why"].get(l["slug"]) if l["rel"] == "O" else None
        rows.append([a["id"], a["nl"], t["id"], t["nl"], dom_by_slug[t["domain"]]["nl"], l["score"], SCORE[l["score"]], RELATION[l["rel"]],
                     why["nl"] if why else "", why["en"] if why else "", a["status"]])
sheet(wb, "Activity_Associations",
      ["activity_id", "activiteit", "association_id", "associatie", "domein", "score", "score (uitleg)", "relatievorm", "reden ontdekking (NL)", "reason for discovery (EN)", "status"],
      rows, [11, 36, 14, 24, 22, 8, 12, 22, 70, 70, 10])

# --- Review ---------------------------------------------------------------------------------------------------
review_path = os.path.join(DATA, "..", "review", "findings.json")
if os.path.exists(review_path):
    with open(review_path, encoding="utf8") as f:
        rv = json.load(f)
    pn = {p["id"]: p["nl"] for p in rv["panel"]}
    STATUS = {"fixed": "opgelost", "confirmed": "bevestigd", "noted": "genoteerd", "recommended": "advies", "open": "open"}
    sheet(wb, "Review", ["rol", "onderwerp", "bevinding", "actie", "status"],
          [[pn[x["persona"]], x["area"], x["finding"], x["action"], STATUS.get(x["status"], x["status"])] for x in rv["findings"]],
          [34, 18, 90, 70, 12])
    sheet(wb, "App_Vocabulaire_Advies", ["associatie", "voorgestelde app-tag", "waarom"],
          [[x["association"], x["proposed_app_tag"], x["why"]] for x in rv["app_vocabulary_recommendations"]], [20, 24, 90])

# --- Coverage --------------------------------------------------------------------------------------------------
rel_counts = collections.Counter(s.split(":")[2] for a in acts for s in a["links"])
dom_counts = collections.Counter(assoc_by_slug[s.split(":")[0]]["domain"] for a in acts for s in a["links"])
match_counts = collections.Counter(a["match"] for a in acts)
rows = [["categorie", c["nl"], counts.get(c["id"], 0), c["target"]] for c in cats]
rows += [["relatievorm", RELATION[r], rel_counts.get(r, 0), ""] for r in "DTEVMO"]
rows += [["associatiedomein", d["nl"], dom_counts.get(d["slug"], 0), ""] for d in domains]
rows += [["vergelijking met app", MATCH[m], match_counts.get(m, 0), ""] for m in ("exact", "close", "new")]
sheet(wb, "Coverage", ["soort", "waarde", "aantal", "streef"], rows, [24, 48, 10, 10])

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print(f"wrote {OUT}: {len(acts)} activities, {sum(len(a['links']) for a in acts)} links")
