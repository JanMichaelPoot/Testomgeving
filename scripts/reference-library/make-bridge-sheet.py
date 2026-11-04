"""Builds an HTML sheet with only discovery bridges, for a quick human check (about 15 minutes).

usage:
  python scripts/reference-library/make-bridge-sheet.py [--n 50] [--seed 2] [--round 2]
      [--exclude-from FILE ...] [--extra-pairs pairs.json --n-extra 10] [--out FILE]

Bridges are spread over the associations used most as a bridge, one per activity. Activities that appeared in the
files given with --exclude-from are left out. With --extra-pairs, a second group (for example bridges that were
written in the previous round) is mixed in; the group of each bridge is written to <out>.key.json, never to the sheet.
Same seed = same sheet.
"""
import argparse, collections, glob, json, os, random, re

ap = argparse.ArgumentParser()
ap.add_argument("--n", type=int, default=50)
ap.add_argument("--seed", type=int, default=2)
ap.add_argument("--round", default="2")
ap.add_argument("--exclude-from", nargs="*", default=["reference-library/review/steekproef-ronde-1.html"])
ap.add_argument("--extra-pairs", default=None, help="json list of [activity id, association slug] to mix in as group B")
ap.add_argument("--n-extra", type=int, default=0)
ap.add_argument("--out", default="reference-library/review/bruggen-ronde-2.html")
args = ap.parse_args()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
D = os.path.join(ROOT, "reference-library", "data")
assocs = {a["slug"]: a for a in json.load(open(os.path.join(D, "associations.json"), encoding="utf8"))}
acts = {}
for f in sorted(glob.glob(os.path.join(D, "activities", "*.json"))):
    for a in json.load(open(f, encoding="utf8")):
        acts[a["id"]] = a
seen = set()
for ex in args.exclude_from:
    path = os.path.join(ROOT, ex)
    if os.path.exists(path):
        seen |= set(re.findall(r"RA-\d{3}", open(path, encoding="utf8").read()))
extra = [tuple(x) for x in json.load(open(os.path.join(ROOT, args.extra_pairs)))] if args.extra_pairs else []
extra_set = set(extra)
rng = random.Random(args.seed)

by_assoc = collections.defaultdict(list)
for i, a in acts.items():
    if i in seen:
        continue
    for l in a["links"]:
        s, sc, rel = l.split(":")
        if rel == "O" and (i, s) not in extra_set:
            by_assoc[s].append((i, s))
for s in by_assoc:
    rng.shuffle(by_assoc[s])
order = sorted(by_assoc, key=lambda s: -len(by_assoc[s]))
picked, used = [], set()
for _ in range(8):
    for s in order:
        if len(picked) >= args.n:
            break
        for i, slug in list(by_assoc[s]):
            by_assoc[s].remove((i, slug))
            if i not in used:
                picked.append((i, slug, "A"))
                used.add(i)
                break
extra_pool = [p for p in extra if p[0] in acts and p[0] not in used]
rng.shuffle(extra_pool)
for i, slug in extra_pool[: args.n_extra]:
    picked.append((i, slug, "B"))
rng.shuffle(picked)

items, key = [], {}
for i, s, g in picked:
    a = acts[i]
    items.append({"id": i, "act": a["nl"], "desc": a["desc"]["nl"], "assoc": assocs[s]["nl"], "why": a["why"][s]["nl"], "slug": s})
    key[f"{i}|{s}"] = g
template = open(os.path.join(HERE, "bridge-sheet.template.html"), encoding="utf8").read()
out = template.replace("/*DATA*/[]", json.dumps(items, ensure_ascii=False)).replace("{{ROUND}}", str(args.round))
path = os.path.join(ROOT, args.out)
open(path, "w", encoding="utf8", newline="\n").write(out)
json.dump(key, open(path.replace(".html", ".key.json"), "w"), indent=1)
print("wrote", os.path.abspath(path), len(items), "bridges:", collections.Counter(key.values()), "over", len({i['slug'] for i in items}), "associations")
