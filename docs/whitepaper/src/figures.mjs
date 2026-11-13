// Registry of all figures. `landscape` figures get a landscape page in the PDF and DOCX.
import * as A from "./figs-a.mjs";
import * as B from "./figs-b.mjs";
import * as C from "./figs-c.mjs";

const reg = {};
const add = (id, svg, landscape = false) => {
  reg[id] = { svg: svg(), landscape };
};

add("overview", A.figOverview);
add("distance", A.figDistance);
add("journey", A.figJourney, true);
add("swimlane", A.figSwimlane, true);
add("inputs", A.figInputs);
add("audience", A.figAudienceTree);

add("windows7", B.figWindows7);
add("assoc", B.figAssocModel);
add("choices", B.figChoices);
add("taxonomy", B.figTaxonomy);
add("chain", B.figChain);
add("algo", B.figAlgoFlow, true);
add("slots", B.figSlotsTree);
add("dataflow", B.figDataFlow, true);

add("concrete", C.figConcrete);
add("arch", C.figArchitecture);
add("timeline", C.figTimeline, true);
add("scA", () => C.figScenario("A"));
add("scB", () => C.figScenario("B"));
add("scC", () => C.figScenario("C"));
add("cost", C.figCost);

export function allFigures() {
  return reg;
}
