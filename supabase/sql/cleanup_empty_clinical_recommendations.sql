-- Remove previously imported source-linked recommendation rows that contain no
-- structured clinical content. This deletes empty approved/pending rows only;
-- it does not affect reviewed rows that contain any populated clinical field.
--
-- Run manually with admin/service-role privileges after taking a database backup.

begin;

delete from public.clinical_recommendations
where syndrome is null
  and infection_site is null
  and setting is null
  and acquisition is null
  and risk_type is null
  and severity_category is null
  and organism is null
  and pathogen is null
  and drug is null
  and dose is null
  and route is null
  and frequency is null
  and duration is null
  and renal_adjustment is null
  and hepatic_adjustment is null
  and pregnancy_lactation_caution is null
  and allergy_warning is null
  and contraindication is null
  and stewardship_note is null
  and id_consult_trigger is null;

delete from public.clinical_source_spans spans
where not exists (
  select 1
  from public.clinical_recommendations recommendations
  where recommendations.source_span_id = spans.id
);

delete from public.clinical_source_files files
where not exists (
  select 1
  from public.clinical_source_spans spans
  where spans.source_file_id = files.id
);

commit;
