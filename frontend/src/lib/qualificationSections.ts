// The 7-section Qualification Call template — shared between the "Log an
// interaction" form and the extraction review panel so both work off the
// same field/label list. `field` matches the Interaction model's qc*
// columns directly (see backend/src/lib/qualificationSections.ts).
export type QcSectionField =
  | "qcPresent"
  | "qcPast"
  | "qcFuture"
  | "qcAob"
  | "qcThreats"
  | "qcLeads"
  | "qcPersonalInfo";

export const QC_SECTION_FIELDS: { field: QcSectionField; label: string; hint: string }[] = [
  { field: "qcPresent", label: "Present", hint: "Thoughts, feelings, pulse" },
  { field: "qcPast", label: "Past", hint: "Experience, projects, skills, CV" },
  { field: "qcFuture", label: "Future", hint: "Motivations, plans, desires, what matters most" },
  { field: "qcAob", label: "AOB", hint: "Salary, notice period, visa status" },
  {
    field: "qcThreats",
    label: "Threats",
    hint: "Life-changing moments, other job offers, promotions, projects — anything that could derail a placement",
  },
  { field: "qcLeads", label: "Leads", hint: "Names of other people worth targeting, market intel, company signals" },
  { field: "qcPersonalInfo", label: "Personal info", hint: "Hobbies, family, personal context worth remembering" },
];
