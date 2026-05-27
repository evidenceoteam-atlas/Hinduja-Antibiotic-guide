-- Verify approved ground-truth Hinduja Antibiotic Guide imports.
--
-- Read-only. Run only against the intended Supabase project after an approved
-- import has been explicitly requested and completed.
--
-- The count labels below match the Phase 3C audit checklist. Some labels are
-- shortened aliases for the actual approved view names created by the schema
-- migration, e.g. approved_duration_rows_with_source queries
-- public.approved_duration_guideline_rows_with_source.

with approved_counts as (
  select
    'approved_icmr_guideline_rows_with_source' as approved_view,
    25 as expected_count,
    (select count(*) from public.approved_icmr_guideline_rows_with_source) as actual_count
  union all
  select
    'approved_duration_rows_with_source' as approved_view,
    22 as expected_count,
    (select count(*) from public.approved_duration_guideline_rows_with_source) as actual_count
  union all
  select
    'approved_antibiogram_sheets_with_source' as approved_view,
    16 as expected_count,
    (select count(*) from public.approved_antibiogram_sheets_with_source) as actual_count
  union all
  select
    'approved_synergy_rows_with_source' as approved_view,
    2 as expected_count,
    (select count(*) from public.approved_synergy_testing_rows_with_source) as actual_count
  union all
  select
    'approved_perioperative_procedure_recommendations_with_source' as approved_view,
    11 as expected_count,
    (select count(*) from public.approved_perioperative_procedure_recommendations_with_source) as actual_count
  union all
  select
    'approved_perioperative_antibiotic_dosing_with_source' as approved_view,
    4 as expected_count,
    (select count(*) from public.approved_perioperative_antibiotic_dosing_with_source) as actual_count
)
select
  approved_view,
  expected_count,
  actual_count,
  case when actual_count = expected_count then 'PASS' else 'FAIL' end as status
from approved_counts
order by approved_view;

with expected_icmr(clinical_condition) as (
  values
    ('CAP'),
    ('HCAP / Early onset VAP'),
    ('HCAP / Late onset VAP'),
    ('Lung abscess'),
    ('Susceptible host (Nocardia spp., Actinomyces spp., Burkholderia pseudomallei)'),
    ('Native Valve / Late Prosthetic Valve Infective Endocarditis (>1yr)'),
    ('Prosthetic Valve Infective Endocarditis (<1yr)'),
    ('Cellulitis / Pyomyositis'),
    ('Diabetic foot infection'),
    ('Necrotizing fasciitis'),
    ('Urosepsis / Pyelonephritis'),
    ('Severe PN / Emphysematous PN / Perinephric abscess'),
    ('Intra-abdominal sepsis'),
    ('Catheter related bloodstream infection'),
    ('Community acquired meningitis'),
    ('Post neurosurgical meningitis / Shunt infection'),
    ('Brain abscess'),
    ('Invasive candidiasis'),
    ('Febrile neutropenia'),
    ('Malignant otitis externa'),
    ('Deep neck space infection (peritonsillar, parapharyngeal, retropharyngeal etc.)'),
    ('Acute Osteomyelitis / Septic arthritis / Prosthetic Joint Infection / Implant associated infections'),
    ('Enteric fever'),
    ('Dysentery'),
    ('Liver abscess')
),
actual_icmr as (
  select clinical_condition
  from public.approved_icmr_guideline_rows_with_source
)
(select 'missing_icmr_guideline_rows' as mismatch_type, clinical_condition
from expected_icmr
except
select 'missing_icmr_guideline_rows' as mismatch_type, clinical_condition
from actual_icmr)
union all
(select 'extra_icmr_guideline_rows' as mismatch_type, clinical_condition
from actual_icmr
except
select 'extra_icmr_guideline_rows' as mismatch_type, clinical_condition
from expected_icmr)
order by mismatch_type, clinical_condition;

with expected_duration(infection) as (
  values
    ('CAP'),
    ('HCAP / VAP'),
    ('Lung Abscess'),
    ('Native Valve Endocarditis'),
    ('Prosthetic Valve Endocarditis'),
    ('Cellulitis'),
    ('Pyomyositis'),
    ('Diabetic Foot'),
    ('Necrotizing fasciitis'),
    ('Urosepsis / Pyelonephritis'),
    ('Emphysematous PN / Perinephric abscess'),
    ('Intra-abdominal sepsis'),
    ('CRBSI'),
    ('Community acquired meningitis'),
    ('Nosocomial / post-surgical meningitis'),
    ('Brain abscess'),
    ('Invasive Candidiasis'),
    ('Febrile Neutropenia'),
    ('Deep Neck space infection'),
    ('Acute Osteomyelitis, Native joint septic arthritis'),
    ('Prosthetic Joint / Implant associated infection'),
    ('Liver Abscess')
),
actual_duration as (
  select infection
  from public.approved_duration_guideline_rows_with_source
)
(select 'missing_duration_rows' as mismatch_type, infection
from expected_duration
except
select 'missing_duration_rows' as mismatch_type, infection
from actual_duration)
union all
(select 'extra_duration_rows' as mismatch_type, infection
from actual_duration
except
select 'extra_duration_rows' as mismatch_type, infection
from expected_duration)
order by mismatch_type, infection;

with expected_sheets(infection_type, location, acquisition) as (
  values
    ('BSI', 'ICU', 'community_acquired'),
    ('BSI', 'ICU', 'hospital_acquired'),
    ('BSI', 'wards', 'community_acquired'),
    ('BSI', 'wards', 'hospital_acquired'),
    ('UTI', 'ICU', 'community_acquired'),
    ('UTI', 'ICU', 'hospital_acquired'),
    ('UTI', 'wards', 'community_acquired'),
    ('UTI', 'wards', 'hospital_acquired'),
    ('RTI', 'ICU', 'community_acquired'),
    ('RTI', 'ICU', 'hospital_acquired'),
    ('RTI', 'wards', 'community_acquired'),
    ('RTI', 'wards', 'hospital_acquired'),
    ('IAI', 'ICU', 'community_acquired'),
    ('IAI', 'ICU', 'hospital_acquired'),
    ('IAI', 'wards', 'community_acquired'),
    ('IAI', 'wards', 'hospital_acquired')
),
actual_sheets as (
  select infection_type, location, acquisition
  from public.approved_antibiogram_sheets_with_source
)
(select 'missing_antibiogram_sheets' as mismatch_type, infection_type, location, acquisition
from expected_sheets
except
select 'missing_antibiogram_sheets' as mismatch_type, infection_type, location, acquisition
from actual_sheets)
union all
(select 'extra_antibiogram_sheets' as mismatch_type, infection_type, location, acquisition
from actual_sheets
except
select 'extra_antibiogram_sheets' as mismatch_type, infection_type, location, acquisition
from expected_sheets)
order by mismatch_type, infection_type, location, acquisition;

with expected_synergy(organism) as (
  values
    ('E. coli'),
    ('K. pneumoniae')
),
actual_synergy as (
  select organism
  from public.approved_synergy_testing_rows_with_source
)
(select 'missing_synergy_rows' as mismatch_type, organism
from expected_synergy
except
select 'missing_synergy_rows' as mismatch_type, organism
from actual_synergy)
union all
(select 'extra_synergy_rows' as mismatch_type, organism
from actual_synergy
except
select 'extra_synergy_rows' as mismatch_type, organism
from expected_synergy)
order by mismatch_type, organism;

with expected_perioperative_procedures(procedure) as (
  values
    ('Clean surgeries (e.g. elective hernia repair, breast surgeries)'),
    ('Neurosurgery'),
    ('Ophthalmic Surgery'),
    ('Head and Neck and ENT surgery'),
    ('Gastroduodenal'),
    ('Appendicular / Colorectal surgery'),
    ('Biliary'),
    ('Abdominal / Vaginal hysterectomy / Caesarean section'),
    ('Urologic surgery'),
    ('Orthopaedic Surgery'),
    ('Cardiovascular / Vascular Surgery')
),
actual_perioperative_procedures as (
  select procedure
  from public.approved_perioperative_procedure_recommendations_with_source
)
(select 'missing_perioperative_procedure_rows' as mismatch_type, procedure
from expected_perioperative_procedures
except
select 'missing_perioperative_procedure_rows' as mismatch_type, procedure
from actual_perioperative_procedures)
union all
(select 'extra_perioperative_procedure_rows' as mismatch_type, procedure
from actual_perioperative_procedures
except
select 'extra_perioperative_procedure_rows' as mismatch_type, procedure
from expected_perioperative_procedures)
order by mismatch_type, procedure;

with expected_perioperative_dosing(drug) as (
  values
    ('Cefazolin'),
    ('Cefuroxime'),
    ('Metronidazole'),
    ('Vancomycin')
),
actual_perioperative_dosing as (
  select drug
  from public.approved_perioperative_antibiotic_dosing_with_source
)
(select 'missing_perioperative_dosing_rows' as mismatch_type, drug
from expected_perioperative_dosing
except
select 'missing_perioperative_dosing_rows' as mismatch_type, drug
from actual_perioperative_dosing)
union all
(select 'extra_perioperative_dosing_rows' as mismatch_type, drug
from actual_perioperative_dosing
except
select 'extra_perioperative_dosing_rows' as mismatch_type, drug
from expected_perioperative_dosing)
order by mismatch_type, drug;
