# Mobile Runtime Flow

## Architecture decision

The current mobile application reads Supabase directly. It does not call the FastAPI protocol, case, report, or sharing services.

1. The app restores optional doctor profile details from local device storage; this is personalization, not authentication or authorization.
2. The unauthenticated client reads `approved_current_patient_risk_criteria_with_source` through approved-content-only Supabase policies.
3. All three patient criteria must be selected exactly; incomplete or unknown values require manual review.
4. The app builds the canonical key `(infection_type, location, acquisition, risk_type)`.
5. `loadProtocolScenario` queries `approved_current_protocol_scenarios_with_source` with four strict `.eq(...)` filters.
6. A result is one of `found`, `no_source_therapy`, `expired`, or `data_error`.
7. Protocol details, save, local PDF export, and device sharing are available only for `found`.
8. Changing any scenario dimension clears the previous result before a new query runs.

`supabase/migrations/20260619_zz_public_approved_clinical_read.sql` grants the `anon` role read-only access to approved rows from the active, non-expired release and to only the provenance referenced by those rows. It grants no insert, update, delete, review, or draft access.

Saved cases currently live in React state until the app is closed. PDF export uses Expo Print. Sharing uses device/web sharing mechanisms. These are local client actions, not persistence or messaging APIs.

## Retired endpoints

`POST /api/v1/protocols/evaluate` and `GET /api/v1/protocols/result/{case_id}` return HTTP 410. They used a weighted risk model that contradicted CSV 01 and had no treatment matrix. They must not be restored unless they delegate to the same exact current database view and reviewed risk criteria.

## Fail-closed messages

The app distinguishes:

- an intentional blank source therapy (`no_source_therapy`);
- an expired guide;
- no installed/reviewed release;
- a missing exact scenario in an otherwise active release;
- permission denial;
- network failure;
- schema/query failure; and
- malformed or internally inconsistent rows.
