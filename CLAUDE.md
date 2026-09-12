# CLAUDE.md

Guidance for Claude Code when working in this repository. See [README.md](README.md) for stack, layout, and setup.

Crux Talent CRM is a bespoke CRM/ATS covering Companies, People (Candidates/Client Contacts), Jobs, Pipeline, Documents, Interactions, and Placements & Fees.

## Architectural rules

### Single source of truth for creation

For every entity in this system (Candidate, Client Contact, Company, Job, Opportunity, Interaction, Document, Placement, etc.), there must be exactly one form/flow used to create a new record of that type, used everywhere in the app that record type can be created — never a simplified or shortcut version alongside the full one.

When adding a "create new X" action anywhere in the app (a button on a related record's page, a quick-add widget, a bulk-import flow, etc.), it must open or call the existing single form for X, optionally pre-filling context-specific fields (like a linked company or job), rather than building a new, separate, simpler version of that form.

Before building any new "add new X" entry point, check whether a form for creating X already exists elsewhere in the app, and reuse it.

A genuinely different *mode* of creation isn't a violation on its own as long as it doesn't duplicate a manual-entry form that already exists elsewhere with a simplified subset of its fields. If it does, extract the shared form and have both the manual entry point and the new pathway build on it (e.g. pre-filling values, or reusing it as a review step) rather than hand-rolling a second set of inputs.

**Documented exceptions:**

- **`CvDropCreatePanel`** (dashboard drag-a-CV-to-create-a-candidate widget) — captures a genuinely different data set than `PersonCreateForm`, not a subset of it (e.g. it fills `currentTitle`, which `PersonCreateForm` doesn't even expose, while skipping personal email/LinkedIn/address, which a CV parse can't reliably provide). This is a different creation mode, not a shortcut standing in for the real form.
- **CSV import** (`Import.tsx` / `backend/src/routes/import.ts`) — a bulk operation with no sensible per-row form equivalent; there's no way for it to "open the form" once per imported row.

**Confirmed entry points (not exceptions — same master form, just pre-filled context):**

- `PersonCreateForm`: the People page's "Add new Candidate"/"Add new Client Contact" buttons, and the Company detail page's "+ Add contact" (Contacts tab), both opening the identical form with `initialCompany` pre-filled where relevant.
- `JobCreateForm`: the Jobs page's "New job" button, and the Company detail page's "+ Add Job" (a prominent button in the header area, which switches to the Jobs tab and opens the same form pre-filled via `initialCompanyId`) and "+ Add job" (the Jobs tab's own toggle for the same form). Any future "add a job from here" entry point should follow this same pattern — open `JobCreateForm` with context pre-filled, not a new form.
- `OpportunityCreateForm`: the BD Funnel page's "New opportunity" button, the Company detail page's "+ Add opportunity" (Opportunities tab, pre-filled via `initialCompany`), and the Extract Intelligence review screen's "Create Opportunity" action on a suggested opportunity (pre-filled via `initialCompanyQuery`/`initialTitle`/`initialNotes`). The form's company field matches an existing Company if one's picked, but otherwise keeps whatever was typed as a lightweight prospect name rather than creating a Company record — see the BD prospecting layer rule below. Any future "add an opportunity from here" entry point should follow this same pattern.

### Linked Company must always be visible

Any record with a linked Company (Candidate's current employer, Client Contact's employer, or similar future relationships) must display that company clearly in the main details area, as a clickable hyperlink to the Company's record page — not buried, omitted, or shown as plain unlinked text.

This applies automatically to any future record type that gains a Company link — check for it, and add the same clearly-visible, clickable-link treatment, rather than letting the display standard drift between record types.

### Record-type colour coding

Candidates = green, Companies = blue, Client Contacts = orange, Jobs = red, applied via named theme variables (`--color-candidate`, `--color-company`, `--color-client-contact`, `--color-job`, defined in `frontend/src/index.css`, with `-bg`/`-border` tints of each for subtle badges/left-borders). Any new UI element displaying or referencing these record types (lists, badges, cards, links, icons) must use this colour scheme by default, not an arbitrary or default colour.

Keep it subtle — a coloured left-border, small dot, or tinted badge, not solid colour blocks. Use `frontend/src/lib/recordColors.ts` (the Tailwind arbitrary-value classes mapped from the variables) plus the `RecordTypeDot`/`RecordTypeBadge` components rather than hand-rolling new colour logic per file.

### Records are archived, not hard-deleted

Core business records — Company, Person (Candidate/Client Contact), Job — are never permanently deleted. A "delete" action archives instead (`archivedAt`, hidden from default views but fully reversible); GDPR erasure requests go through the separate anonymize flow (`deletedAt` plus scrubbed personal fields), which still preserves interaction/pipeline history so it stays queryable.

Hard `DELETE` calls are reserved for genuinely disposable rows with no standalone history of their own — tag links, skill assignments, a single scheduled event (interview/meeting). Any new entity that represents a first-class business record should follow the archive convention rather than introducing a new hard-delete path.

### Large record-set pickers search server-side

Any picker for choosing one record out of a potentially large set (Companies, Candidates, Client Contacts, etc.) must search server-side via a `q` query parameter (see `GET /api/companies`, `GET /api/people`) rather than loading the full table into the browser and filtering client-side.

Follow the established debounced-search-dropdown pattern (`CompanyPicker.tsx`, `CandidatePipelinePicker.tsx`, `LinkPersonModal.tsx`): a text input, a short debounce (~200-250ms) before calling the search endpoint, and a dropdown of results — nothing loads until the user types.

### Job stage vs Candidate pipeline stage

`Job.stage` (`JobStage` enum) and `JobCandidate.stage` (`CandidateStage` enum) are two separate concepts that happen to share some value names (`OFFERED`, `PLACED`, `REJECTED`): the former is the job's own overall recruitment-process stage, the latter is one candidate's position in that job's pipeline. Changing one never changes the other — don't conflate them when building new stage-aware features (filters, dashboards, automations).

### BD Opportunities vs Account Status

A BD Opportunity (`Opportunity` model, stages Identified → Researched → Contacted → Meeting Booked → Proposal Sent → Won/Lost) tracks one active new-business pursuit against a Company. It is distinct from that Company's Account Status (`Company.relationshipStatus`: Prospect / Active Client / Dormant / Do Not Contact), which is a passive flag, not a pipeline — a company can hold an open Opportunity while already an Active Client elsewhere, and can have several Opportunities over time.

Marking a BD Opportunity as Won automatically updates the linked Company's Account Status to Active Client. This is the only automatic status change tied to Opportunities — no other automatic actions occur on Won or Lost (no auto-created Job, no other field changes). Marking one Lost only requires a reason (free text or a short tag); the company's Account Status is left untouched. A Lost Opportunity is never archived or hidden — it stays visible and searchable in case it's worth revisiting later.

### Scheduled events: interviews and BD meetings share one structure

Interview scheduling (Candidates) and Meeting scheduling (BD Opportunities) share the same underlying scheduling structure (`ScheduledEvent` model / `ScheduledEventsPanel.tsx` component / `/api/scheduled-events`) and both surface on the main dashboard activity feed alongside follow-up reminders. Any future scheduled-event type should follow this same pattern rather than introducing a new, separate one.

Concretely: `ScheduledEvent` has exactly one of `jobCandidateId` (an interview) or `opportunityId` (a meeting) set, plus an optional `contactId` (the Client Contact a meeting is with — never set for an interview). Multiple rows per parent are expected and shown as a simple numbered list; nothing is stored to track a "round number" since they're numbered by `scheduledAt` order at display time. `scheduledAt` is a real `DateTime`, not free text, so this stays ready for an actual calendar sync later.

### BD prospecting layer

BD Opportunities use a lightweight prospecting layer (plain-text company name, lightweight Target Contacts) before conversion. Conversion to full Company and Client Contact records happens automatically when an Opportunity reaches the Meeting Booked stage, carrying over all logged activity. This mirrors the Lead-to-Account/Contact conversion pattern used in mainstream CRM systems.

Concretely: `Opportunity.companyId` is nullable — a new one starts with just `prospectCompanyName` (free text, no Company record). `TargetContact` is a lightweight row (name, optional job title/LinkedIn) attached to an Opportunity; `Interaction` can point at a `TargetContact` instead of a `Person` (exactly one of `personId`/`targetContactId` is set), so activity is logged and displayed identically either way — nothing about tracking activity is limited by being lightweight. Reaching Meeting Booked (or any later stage, if it's skipped straight to) for the first time runs `opportunityConversion.ts`: resolves/creates the real Company by name (the same `resolveCompanyIdByName` helper CSV import and CV parsing use) and creates a real Client Contact Person for every not-yet-converted Target Contact, re-pointing that contact's interactions onto the new Person. A Target Contact that's never converted (e.g. one of several who didn't reply) simply stays part of the Opportunity's history — nothing forces it to become a full record, and an Opportunity Lost before ever reaching Meeting Booked stays lightweight forever.

### Company Terms

New Active Clients (converted via Opportunity Won) should have Terms set up as a required onboarding step, prompted immediately on conversion. Placement Fee % defaults from the company's Terms Fee Structure. Invoicing Contact within Terms follows the single-source-of-truth Client Contact creation rule.

Concretely: `CompanyTerms` is a one-per-company row (`Company.terms`, created lazily via upsert on first save — it doesn't exist at all until something is filled in) holding `feeStructurePercentage`, free-text `feeExceptions`/`paymentTerms`/`specialTerms`, and `invoicingContactId` (a real Client Contact `Person`, creatable inline via `PersonCreateForm` pre-filled with this company exactly as everywhere else a Client Contact is created), plus a Terms of Business document via the existing Documents feature (`DocumentType.TERMS_OF_BUSINESS`). The moment an Opportunity's stage reaches Won for a company with no `CompanyTerms` row yet, `Company.needsTermsSetup` is set alongside the automatic Active Client update, and `OpportunityStageControl.tsx` reads that back off the same stage-change response to pop a "set up Terms now or later" prompt immediately — no separate polling or follow-up job. Saving Terms (even partially) clears the flag; until then it surfaces as a banner on the Company page and in the Dashboard activity feed so it isn't forgotten. A new Placement's Fee % is seeded from `feeStructurePercentage` when the placement form opens, same "default but still editable per-record" pattern as everywhere else defaults are offered in this app.

### Full-text search and skill suggestions from call notes

Candidate skills can be enriched automatically from call notes via Extract Intelligence, always shown as a reviewable suggestion, never auto-saved without approval — same principle as all other Extract Intelligence suggestions. Search covers full-text CV content (all versions) and full-text interaction notes, filterable by scope (CVs/Notes/Both).

Concretely: `DocumentVersion.extractedText` is populated at upload time (`documents.ts`, CV document types only — `CANDIDATE_CV`/`CRUX_FORMATTED_CV`) via the same `extractTextFromCv` helper CV parsing uses, so every version, not just the current one, stays searchable even after a re-upload. Both `DocumentVersion` and `Interaction` carry a generated, GIN-indexed Postgres `tsvector` column (`searchVector`, `Unsupported("tsvector")` in schema.prisma since Prisma has no native type for it — queried via `$queryRaw`), computed from `extractedText`/`notes` respectively; a Qualification Call's notes already contain every section concatenated with labeled headers (`buildQualificationCallNotes`), so full-text search covers all of them with no extra plumbing. `GET /api/search` takes a `scope` param (`cvs` | `notes` | `both`, default `both`) — `both` keeps the existing People/Company/Job/Opportunity name search and adds CV/note matches alongside it; `cvs`/`notes` narrow to just that one source. Every match reports its specific origin (a CV's version number and upload date, or an interaction's date/type and, best-effort, which Qualification Call section it fell under) plus a highlighted snippet — never just a bare record link. Skill suggestions from call notes reuse `cvExtraction.ts`'s `guessSkills` (the same fuzzy/synonym matcher CV parsing uses) against `Interaction.notes` instead of CV text, restricted to Candidates and filtered to skills not already tagged on that Person; approving one calls the same `PUT /api/people/:id/skills` endpoint every other skill assignment in the app uses.
