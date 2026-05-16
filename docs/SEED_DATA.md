# Seed Data

The app must not ship static antibiotic recommendations as seed data.

The remaining `rules/hinduja_protocols.json` file contains only non-treatment
risk scoring configuration used to classify the workflow state. It intentionally
contains no antibiotic names, doses, durations, organisms, renal adjustments, or
fallback treatment pathways.

Clinical recommendation rows must be imported from source guide files through
the source-ingestion workflow in `docs/SOURCE_INGESTION.md`. Imported rows start
as `pending_review`, must preserve their source quote, and are hidden from the
doctor-facing app until a clinician approves them.

For UI testing, use unapproved rows labelled `NON-CLINICAL DEMO`; they must not
be promoted to `approved` unless they are replaced with source-verified clinical
content.
