import type {
  GuidelineAntibiotic,
  RecommendationInput,
  RecommendationResult,
  Reference,
  TreatmentGuideline,
} from "./types";

const insufficientMessage =
  "Insufficient validated data available. Please refer to institutional guideline / ID specialist.";

const matchesDimension = (actual: string, expected: string) =>
  actual === "Any" || actual.toLowerCase() === expected.toLowerCase();

const addSource = (sources: Reference[], source: Reference | null) => {
  if (!source || sources.some((item) => item.id === source.id)) {
    return;
  }

  sources.push(source);
};

export function evaluateRecommendation(
  input: RecommendationInput,
  guidelines: TreatmentGuideline[],
): RecommendationResult {
  if (!input.infectionId) {
    return {
      status: "insufficient",
      message: insufficientMessage,
      guideline: null,
      firstLine: [],
      alternatives: [],
      warnings: ["Select an approved infection record before requesting therapy."],
      sources: [],
    };
  }

  const guideline =
    guidelines.find(
      (item) =>
        item.review_status === "approved" &&
        item.infection_id === input.infectionId &&
        matchesDimension(item.setting, input.setting) &&
        matchesDimension(item.acquisition, input.acquisition) &&
        matchesDimension(item.severity, input.severity) &&
        item.age_group === input.ageGroup,
    ) ?? null;

  const approvedOptions = (guideline?.guideline_antibiotics ?? []).filter(
    (item) => item.review_status === "approved" && item.antibiotic?.review_status === "approved",
  );

  const firstLine = approvedOptions
    .filter((item) => item.role === "first_line")
    .sort((left, right) => left.rank - right.rank);
  const alternatives = approvedOptions
    .filter((item) => item.role === "alternative")
    .sort((left, right) => left.rank - right.rank);

  if (!guideline || firstLine.length === 0 || !guideline.source_reference) {
    return {
      status: "insufficient",
      message: insufficientMessage,
      guideline,
      firstLine: [],
      alternatives: [],
      warnings: [
        "No approved, source-linked first-line recommendation matched every selected input.",
      ],
      sources: guideline?.source_reference ? [guideline.source_reference] : [],
    };
  }

  const warnings = [...guideline.warning_flags];
  if (input.pregnancyStatus === "pregnant" && !guideline.pregnancy_applicable) {
    warnings.push("Selected guideline is not approved for pregnancy.");
  }
  if (input.allergyClass.trim()) {
    warnings.push("Allergy history present: check contraindication and cross-reactivity screens.");
  }
  if (input.egfr.trim()) {
    warnings.push("Renal function provided: verify renal adjustment screen before prescribing.");
  }
  if (input.hepaticImpairment !== "none") {
    warnings.push("Hepatic impairment selected: verify hepatic adjustment data before prescribing.");
  }

  const sources: Reference[] = [];
  addSource(sources, guideline.source_reference);
  firstLine.forEach((item) => addSource(sources, item.source_reference));
  alternatives.forEach((item) => addSource(sources, item.source_reference));

  return {
    status: "ok",
    message: "Approved guideline match found. Clinical judgment remains required.",
    guideline,
    firstLine,
    alternatives,
    warnings,
    sources,
  };
}

export { insufficientMessage };
