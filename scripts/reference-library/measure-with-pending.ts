// Runs one of the measuring scripts as if the activities imported from the reference library (provenance RL, still image_pending)
// were visible, so their effect on the selection can be measured before their photos are paid for. Nothing is written.
//
//   SHOW_PENDING=1 npx tsx scripts/reference-library/measure-with-pending.ts ../discovery-variety.ts 300
//   SHOW_PENDING=1 npx tsx scripts/reference-library/measure-with-pending.ts ../discovery-shadow.ts --profile associations --overrides --n 300
//   (without SHOW_PENDING=1 it measures the library as it is shown today, for the comparison)
import { ALL_ACTIVITIES } from "../../src/lib/discovery/library";

if (process.env.SHOW_PENDING === "1") for (const a of ALL_ACTIVITIES) if (a.provenance?.source_id === "RL") delete a.image_pending;
const script = process.argv[2];
process.argv.splice(2, 1);
void import(script);
