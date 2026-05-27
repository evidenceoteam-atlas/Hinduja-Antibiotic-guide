select
  clinical_condition,
  ama_role,
  common_pathogens,
  empirical_ama,
  alternate_ama,
  comments,
  source_image,
  source_page,
  source_quote
from public.approved_clinical_recommendations_with_source
where source_image = '1779705175121-92f99181-4a45-4e84-91de-5929d43f05f9_3.jpg'
order by source_page, clinical_condition, ama_role;
