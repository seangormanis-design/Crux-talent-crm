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

### Linked Company must always be visible

Any record with a linked Company (Candidate's current employer, Client Contact's employer, or similar future relationships) must display that company clearly in the main details area, as a clickable hyperlink to the Company's record page — not buried, omitted, or shown as plain unlinked text.

This applies automatically to any future record type that gains a Company link — check for it, and add the same clearly-visible, clickable-link treatment, rather than letting the display standard drift between record types.
