// Which age categories the image intake offers. "Under 18" only makes sense when the window is
// a gift (for a child or teenager); someone who buys for themselves is an adult. A value that is
// already selected stays visible, so an older draft or an edit never hides its own answer.
export function ageOptionsFor<T extends { value: string }>(options: readonly T[], gift: boolean, selected: string): T[] {
  return options.filter((o) => gift || o.value !== "under18" || selected === "under18");
}
