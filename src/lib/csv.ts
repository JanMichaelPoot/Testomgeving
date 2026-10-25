/**
 * One CSV cell. Quotes are doubled, and a leading = + - @ is neutralised with an apostrophe so a spreadsheet
 * never runs a formula somebody typed into a free-text answer.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
