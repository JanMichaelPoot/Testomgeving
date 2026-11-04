// Node-only loader for the reference library data (reference-library/data/**). Used by the check/export scripts
// and the tests; the app itself never imports this.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AssociationDomain, Association, Category, Library, RefActivity } from "./types";

export const DATA_DIR = path.join(process.cwd(), "reference-library", "data");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function loadLibrary(dir: string = DATA_DIR): Library {
  const categories = readJson<Category[]>(path.join(dir, "categories.json"));
  const domains = readJson<AssociationDomain[]>(path.join(dir, "association-domains.json"));
  const associations = readJson<Association[]>(path.join(dir, "associations.json"));
  const actDir = path.join(dir, "activities");
  const activities: RefActivity[] = readdirSync(actDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => readJson<RefActivity[]>(path.join(actDir, f)));
  return { categories, domains, associations, activities };
}
