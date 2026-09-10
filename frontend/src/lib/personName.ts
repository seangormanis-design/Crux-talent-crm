export interface NameParts {
  firstName?: string | null;
  surname?: string | null;
}

// Every list/detail view combines these for display — the split only
// matters for data entry and matching, not for how a name reads on screen.
export function fullName(p: NameParts): string {
  return [p.firstName, p.surname].filter(Boolean).join(" ").trim();
}
