export type AntibiogramRiskType = "Type 1" | "Type 2" | "Type 3";

export const RISK_TYPE_1: AntibiogramRiskType = "Type 1";
export const RISK_TYPE_2: AntibiogramRiskType = "Type 2";
export const RISK_TYPE_3: AntibiogramRiskType = "Type 3";
export const MANUAL_REVIEW = "manual_review";

export const HOSPITAL_CONTACT = "Hospital contact";
export const ANTIBIOTIC_EXPOSURE = "Antibiotic exposure";
export const CO_MORBIDITIES = "Co-morbidities";

export const groundTruthRiskCriteria = {
  // Verbatim from Hindujacsv/01_Patient_Risk_Stratification.csv; kept byte-identical
  // to the source (and to the Python GROUND_TRUTH_RISK_CRITERIA) so these fallback
  // defaults are not a normalized paraphrase of the reviewed criteria.
  [HOSPITAL_CONTACT]: {
    "1": "No contact with hospital in last 90 days",
    "2": "Contact with hospital in last 90 days WITHOUT invasive procedure/devices",
    "3": "Hospitalisation in last 90 days with invasive procedure/devices",
  },
  [ANTIBIOTIC_EXPOSURE]: {
    "1": "No antibiotics in last 90 days",
    "2": "Antibiotic therapy (oral / parenteral) in last 90 days",
    "3": "MORE THAN 2 antibiotics (oral/ parenteral) in last 90 days",
  },
  [CO_MORBIDITIES]: {
    "1": "No co-morbid conditions",
    "2": "Patient with 2 or less co-morbidities",
    "3": "Greater than 2 co-morbidities (e.g. DM, HT, COPD) or Immunodeficiency",
  },
} as const;

export const patientCriterionLabels = [
  HOSPITAL_CONTACT,
  ANTIBIOTIC_EXPOSURE,
  CO_MORBIDITIES,
] as const;

export type PatientCriterionLabel = (typeof patientCriterionLabels)[number];
export type AntibiogramRiskAnswers = Record<PatientCriterionLabel, string | null>;
export type AntibiogramRiskCriteria = Record<
  PatientCriterionLabel,
  Record<"1" | "2" | "3", string>
>;

export type AntibiogramRiskClassification = {
  riskType: AntibiogramRiskType | null;
  status: "classified" | "insufficient/manual_review";
  matchedCriteria: Partial<AntibiogramRiskAnswers>;
  missingCriteria: PatientCriterionLabel[];
  invalidCriteria: PatientCriterionLabel[];
};

export const defaultAntibiogramRiskAnswers: AntibiogramRiskAnswers = {
  [HOSPITAL_CONTACT]: null,
  [ANTIBIOTIC_EXPOSURE]: null,
  [CO_MORBIDITIES]: null,
};

export function classifyAntibiogramRisk(
  selectedCriteria: Partial<AntibiogramRiskAnswers>,
  riskCriteria: AntibiogramRiskCriteria = groundTruthRiskCriteria,
): AntibiogramRiskClassification {
  const normalized = Object.fromEntries(
    patientCriterionLabels.map((criterionName) => [
      criterionName,
      (selectedCriteria[criterionName] ?? "").trim(),
    ]),
  ) as Record<PatientCriterionLabel, string>;

  const missingCriteria = patientCriterionLabels.filter(
    (criterionName) => !normalized[criterionName],
  );
  const invalidCriteria = patientCriterionLabels.filter(
    (criterionName) =>
      Boolean(normalized[criterionName]) &&
      !(["1", "2", "3"] as const).some(
        (typeKey) =>
          normalized[criterionName] === riskCriteria[criterionName][typeKey],
      ),
  );
  if (missingCriteria.length > 0 || invalidCriteria.length > 0) {
    return {
      riskType: null,
      status: `insufficient/${MANUAL_REVIEW}`,
      matchedCriteria: {},
      missingCriteria,
      invalidCriteria,
    };
  }

  const type3Matches = exactMatches(normalized, riskCriteria, "3");
  if (Object.keys(type3Matches).length > 0) {
    return {
      riskType: RISK_TYPE_3,
      status: "classified",
      matchedCriteria: type3Matches,
      missingCriteria: [],
      invalidCriteria: [],
    };
  }

  const type2Matches = exactMatches(normalized, riskCriteria, "2");
  if (Object.keys(type2Matches).length > 0) {
    return {
      riskType: RISK_TYPE_2,
      status: "classified",
      matchedCriteria: type2Matches,
      missingCriteria: [],
      invalidCriteria: [],
    };
  }

  const type1Matches = exactMatches(normalized, riskCriteria, "1");
  if (
    missingCriteria.length === 0 &&
    Object.keys(type1Matches).length === patientCriterionLabels.length
  ) {
    return {
      riskType: RISK_TYPE_1,
      status: "classified",
      matchedCriteria: type1Matches,
      missingCriteria: [],
      invalidCriteria: [],
    };
  }

  return {
    riskType: null,
    status: `insufficient/${MANUAL_REVIEW}`,
    matchedCriteria: type1Matches,
    missingCriteria,
    invalidCriteria,
  };
}

function exactMatches(
  selectedCriteria: Record<PatientCriterionLabel, string>,
  riskCriteria: AntibiogramRiskCriteria,
  typeKey: "1" | "2" | "3",
): Partial<AntibiogramRiskAnswers> {
  return Object.fromEntries(
    patientCriterionLabels
      .filter(
        (criterionName) =>
          selectedCriteria[criterionName] === riskCriteria[criterionName][typeKey],
      )
      .map((criterionName) => [criterionName, selectedCriteria[criterionName]]),
  );
}
