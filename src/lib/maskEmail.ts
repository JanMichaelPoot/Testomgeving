// An e-mail address as it may be shown on a page that anyone with the link can open: the first letter of the name and the whole domain, so the buyer can see at once whether the
// mail went to the right place (a typo in the domain, a work address instead of a private one) without the address being readable by someone else.
//   "jan.poot@arconacapital.com" -> "j***@arconacapital.com"
export function maskEmail(address: string | null | undefined): string | null {
  const m = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec((address ?? "").trim());
  return m ? `${m[1][0]}***@${m[2]}` : null;
}
