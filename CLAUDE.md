# CLAUDE.md

Guidance for Claude Code when working in this repository. See [README.md](README.md) for stack, layout, and setup.

Crux Talent CRM is a bespoke CRM/ATS covering Companies, People (Candidates/Client Contacts), Jobs, Pipeline, Documents, Interactions, and Placements & Fees.

## Architectural rules

### Single source of truth for creation

For every entity in this system (Candidate, Client Contact, Company, Job, Interaction, Document, Placement, etc.), there must be exactly one form/flow used to create a new record of that type, used everywhere in the app that record type can be created — never a simplified or shortcut version alongside the full one.

When adding a "create new X" action anywhere in the app (a button on a related record's page, a quick-add widget, a bulk-import flow, etc.), it must open or call the existing single form for X, optionally pre-filling context-specific fields (like a linked company or job), rather than building a new, separate, simpler version of that form.

Before building any new "add new X" entry point, check whether a form for creating X already exists elsewhere in the app, and reuse it.

A genuinely different *mode* of creation — CV-driven autofill, bulk CSV import — isn't a violation on its own as long as it doesn't duplicate a manual-entry form that already exists elsewhere with a simplified subset of its fields. If it does, extract the shared form and have both the manual entry point and the new pathway build on it (e.g. pre-filling values, or reusing it as a review step) rather than hand-rolling a second set of inputs.
