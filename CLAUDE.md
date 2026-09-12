# CLAUDE.md

Guidance for Claude Code when working in this repository. See [README.md](README.md) for stack, layout, and setup.

Crux Talent CRM is a bespoke CRM/ATS covering Companies, People (Candidates/Client Contacts), Jobs, Pipeline, Documents, Interactions, and Placements & Fees.

## Architectural rules

### Single source of truth for creation

For every entity in this system (Candidate, Client Contact, Company, Job, Interaction, Document, Placement, etc.), there must be exactly one form/flow used to create a new record of that type, used everywhere in the app that record type can be created — never a simplified or shortcut version alongside the full one.

When adding a "create new X" action anywhere in the app (a button on a related record's page, a quick-add widget, a bulk-import flow, etc.), it must open or call the existing single form for X, optionally pre-filling context-specific fields (like a linked company or job), rather than building a new, separate, simpler version of that form.

Before building any new "add new X" entry point, check whether a form for creating X already exists elsewhere in the app, and reuse it.

A genuinely different *mode* of creation isn't a violation on its own as long as it doesn't duplicate a manual-entry form that already exists elsewhere with a simplified subset of its fields. If it does, extract the shared form and have both the manual entry point and the new pathway build on it (e.g. pre-filling values, or reusing it as a review step) rather than hand-rolling a second set of inputs.

**Documented exceptions:**

- **`CvDropCreatePanel`** (dashboard drag-a-CV-to-create-a-candidate widget) — captures a genuinely different data set than `PersonCreateForm`, not a subset of it (e.g. it fills `currentTitle`, which `PersonCreateForm` doesn't even expose, while skipping personal email/LinkedIn/address, which a CV parse can't reliably provide). This is a different creation mode, not a shortcut standing in for the real form.
- **CSV import** (`Import.tsx` / `backend/src/routes/import.ts`) — a bulk operation with no sensible per-row form equivalent; there's no way for it to "open the form" once per imported row.

**Confirmed entry points (not exceptions — same master form, just pre-filled context):**

- `PersonCreateForm`: the People page's "Add new Candidate"/"Add new Client Contact" buttons, and the Company detail page's "+ Add contact" (Contacts tab), both opening the identical form with `initialCompany` pre-filled where relevant.
- `JobCreateForm`: the Jobs page's "New job" button, and the Company detail page's "+ Add Job" (a prominent button in the header area, which switches to the Jobs tab and opens the same form pre-filled via `initialCompanyId`) and "+ Add job" (the Jobs tab's own toggle for the same form). Any future "add a job from here" entry point should follow this same pattern — open `JobCreateForm` with context pre-filled, not a new form.

### Linked Company must always be visible

Any record with a linked Company (Candidate's current employer, Client Contact's employer, or similar future relationships) must display that company clearly in the main details area, as a clickable hyperlink to the Company's record page — not buried, omitted, or shown as plain unlinked text.

This applies automatically to any future record type that gains a Company link — check for it, and add the same clearly-visible, clickable-link treatment, rather than letting the display standard drift between record types.

### Record-type colour coding

Candidates = green, Companies = blue, Client Contacts = orange, applied via named theme variables (`--color-candidate`, `--color-company`, `--color-client-contact`, defined in `frontend/src/index.css`, with `-bg`/`-border` tints of each for subtle badges/left-borders). Any new UI element displaying or referencing these record types (lists, badges, cards, links, icons) must use this colour scheme by default, not an arbitrary or default colour.

Keep it subtle — a coloured left-border, small dot, or tinted badge, not solid colour blocks. Use `frontend/src/lib/recordColors.ts` (the Tailwind arbitrary-value classes mapped from the variables) plus the `RecordTypeDot`/`RecordTypeBadge` components rather than hand-rolling new colour logic per file.

### Records are archived, not hard-deleted

Core business records — Company, Person (Candidate/Client Contact), Job — are never permanently deleted. A "delete" action archives instead (`archivedAt`, hidden from default views but fully reversible); GDPR erasure requests go through the separate anonymize flow (`deletedAt` plus scrubbed personal fields), which still preserves interaction/pipeline history so it stays queryable.

Hard `DELETE` calls are reserved for genuinely disposable rows with no standalone history of their own — tag links, skill assignments, a single interview record. Any new entity that represents a first-class business record should follow the archive convention rather than introducing a new hard-delete path.

### Large record-set pickers search server-side

Any picker for choosing one record out of a potentially large set (Companies, Candidates, Client Contacts, etc.) must search server-side via a `q` query parameter (see `GET /api/companies`, `GET /api/people`) rather than loading the full table into the browser and filtering client-side.

Follow the established debounced-search-dropdown pattern (`CompanyPicker.tsx`, `CandidatePipelinePicker.tsx`, `LinkPersonModal.tsx`): a text input, a short debounce (~200-250ms) before calling the search endpoint, and a dropdown of results — nothing loads until the user types.

### Job stage vs Candidate pipeline stage

`Job.stage` (`JobStage` enum) and `JobCandidate.stage` (`CandidateStage` enum) are two separate concepts that happen to share some value names (`OFFERED`, `PLACED`, `REJECTED`): the former is the job's own overall recruitment-process stage, the latter is one candidate's position in that job's pipeline. Changing one never changes the other — don't conflate them when building new stage-aware features (filters, dashboards, automations).
