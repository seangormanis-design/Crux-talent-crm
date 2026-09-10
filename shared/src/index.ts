// Shared TypeScript types/enums, mirrored from backend/prisma/schema.prisma.
// Keep these in sync manually when Prisma enums change — the backend is the
// source of truth; this package exists so the frontend (and any future
// module) can import the same string-literal unions instead of redefining them.

export const JOB_STAGES = [
  "POTENTIAL_LEAD",
  "QUALIFIED",
  "SPEC_TAKEN",
  "CV_SOURCING",
  "CVS_SENT",
  "INTERVIEWING",
  "OFFERED",
  "PLACED",
  "REJECTED",
] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export const CANDIDATE_STAGES = ["SOURCED", "CV_SENT", "REJECTED", "INTERVIEWING", "OFFERED", "PLACED"] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export const INTERACTION_TYPES = [
  "PHONE_CALL",
  "VIDEO_MEETING",
  "FACE_TO_FACE",
  "QUALIFICATION_CALL",
  "LINKEDIN_MESSAGE",
  "EMAIL",
  "TEXT",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const DOCUMENT_TYPES = [
  "CANDIDATE_CV",
  "CRUX_FORMATTED_CV",
  "TERMS_OF_BUSINESS",
  "COMPANY_DOC",
  "JOB_SPEC",
  "CONTRACTOR_CORP_DOC",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type PersonType = "CANDIDATE" | "CLIENT_CONTACT";
export type CompanyType = "PARTNER" | "ISV" | "CONSULTANCY" | "END_USER";
export type RelationshipStatus = "PROSPECT" | "ACTIVE_CLIENT" | "DORMANT" | "DO_NOT_CONTACT";
export type WorkPreference = "REMOTE" | "HYBRID" | "ONSITE";
export type TaggableType = "PERSON" | "COMPANY" | "JOB" | "DOCUMENT";
