-- Emergency fail-closed rollback. This makes all current protocol views empty.
-- It does not re-enable clinical_recommendations or any fuzzy selection path.
select public.enter_clinical_dataset_maintenance(
  'Emergency maintenance: active clinical dataset disabled pending review.'
);
