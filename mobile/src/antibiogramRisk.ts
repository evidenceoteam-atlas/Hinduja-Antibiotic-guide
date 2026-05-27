export type AntibiogramRiskType = "Type 1" | "Type 2" | "Type 3";

export const RISK_TYPE_1: AntibiogramRiskType = "Type 1";
export const RISK_TYPE_2: AntibiogramRiskType = "Type 2";
export const RISK_TYPE_3: AntibiogramRiskType = "Type 3";
export const MANUAL_REVIEW = "manual_review";

export const HOSPITAL_CONTACT = "Hospital contact";
export const ANTIBIOTIC_EXPOSURE = "Antibiotic exposure";
export const CO_MORBIDITIES = "Co-morbidities";

export const groundTruthRiskCriteria = {
  [HOSPITAL_CONTACT]: {
    "1": "No contact with hospital in last 90 days",
    "2": "Contact with hospital in last 90 days WITHOUT invasive procedure/devices",
    "3": "Hospitalisation in last 90 days WITH invasive procedure/devices",
  },
  [ANTIBIOTIC_EXPOSURE]: {
    "1": "No antibiotics in last 90 days",
    "2": "Antibiotic therapy (oral/parenteral) in last 90 days",
    "3": "MORE THAN 2 antibiotics (oral/parenteral) in last 90 days",
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
export type AntibiogramRiskAnswers = Record<PatientCriterionLabel, string>;

export type AntibiogramRiskClassification = {
  riskType: AntibiogramRiskType | null;
  status: "classified" | "insufficient/manual_review";
  matchedCriteria: Partial<AntibiogramRiskAnswers>;
  missingCriteria: PatientCriterionLabel[];
};

export const defaultAntibiogramRiskAnswers: AntibiogramRiskAnswers = {
  [HOSPITAL_CONTACT]: groundTruthRiskCriteria[HOSPITAL_CONTACT]["2"],
  [ANTIBIOTIC_EXPOSURE]: groundTruthRiskCriteria[ANTIBIOTIC_EXPOSURE]["1"],
  [CO_MORBIDITIES]: groundTruthRiskCriteria[CO_MORBIDITIES]["1"],
};

export function classifyAntibiogramRisk(
  selectedCriteria: Partial<AntibiogramRiskAnswers>,
): AntibiogramRiskClassification {
  const normalized = Object.fromEntries(
    patientCriterionLabels.map((criterionName) => [
      criterionName,
      (selectedCriteria[criterionName] ?? "").trim(),
    ]),
  ) as AntibiogramRiskAnswers;

  const type3Matches = exactMatches(normalized, "3");
  if (Object.keys(type3Matches).length > 0) {
    return {
      riskType: RISK_TYPE_3,
      status: "classified",
      matchedCriteria: type3Matches,
      missingCriteria: [],
    };
  }

  const type2Matches = exactMatches(normalized, "2");
  if (Object.keys(type2Matches).length > 0) {
    return {
      riskType: RISK_TYPE_2,
      status: "classified",
      matchedCriteria: type2Matches,
      missingCriteria: [],
    };
  }

  const missingCriteria = patientCriterionLabels.filter(
    (criterionName) => !normalized[criterionName],
  );
  const type1Matches = exactMatches(normalized, "1");
  if (
    missingCriteria.length === 0 &&
    Object.keys(type1Matches).length === patientCriterionLabels.length
  ) {
    return {
      riskType: RISK_TYPE_1,
      status: "classified",
      matchedCriteria: type1Matches,
      missingCriteria: [],
    };
  }

  return {
    riskType: null,
    status: `insufficient/${MANUAL_REVIEW}`,
    matchedCriteria: type1Matches,
    missingCriteria,
  };
}

function exactMatches(
  selectedCriteria: AntibiogramRiskAnswers,
  typeKey: "1" | "2" | "3",
): Partial<AntibiogramRiskAnswers> {
  return Object.fromEntries(
    patientCriterionLabels
      .filter(
        (criterionName) =>
          selectedCriteria[criterionName] === groundTruthRiskCriteria[criterionName][typeKey],
      )
      .map((criterionName) => [criterionName, selectedCriteria[criterionName]]),
  );
}
