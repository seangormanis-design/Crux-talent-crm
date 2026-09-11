export function fullName(p: { firstName?: string | null; surname?: string | null }): string {
  return [p.firstName, p.surname].filter(Boolean).join(" ").trim();
}
