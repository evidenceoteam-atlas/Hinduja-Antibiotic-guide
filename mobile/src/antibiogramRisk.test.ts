import {
  ANTIBIOTIC_EXPOSURE,
  CO_MORBIDITIES,
  HOSPITAL_CONTACT,
  classifyAntibiogramRisk,
  defaultAntibiogramRiskAnswers,
  groundTruthRiskCriteria,
} from "./antibiogramRisk";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  Object.values(defaultAntibiogramRiskAnswers).every((value) => value === null),
  "risk answers must start unselected",
);

const partialType3 = classifyAntibiogramRisk({
  [HOSPITAL_CONTACT]: groundTruthRiskCriteria[HOSPITAL_CONTACT]["3"],
  [ANTIBIOTIC_EXPOSURE]: null,
  [CO_MORBIDITIES]: null,
});
assert(partialType3.riskType === null, "partial Type 3 input must fail closed");
assert(partialType3.missingCriteria.length === 2, "missing criteria must be reported");

const completeType2 = classifyAntibiogramRisk({
  [HOSPITAL_CONTACT]: groundTruthRiskCriteria[HOSPITAL_CONTACT]["2"],
  [ANTIBIOTIC_EXPOSURE]: groundTruthRiskCriteria[ANTIBIOTIC_EXPOSURE]["1"],
  [CO_MORBIDITIES]: groundTruthRiskCriteria[CO_MORBIDITIES]["1"],
});
assert(completeType2.riskType === "Type 2", "complete exact Type 2 input must classify");

const unknown = classifyAntibiogramRisk({
  [HOSPITAL_CONTACT]: "unknown",
  [ANTIBIOTIC_EXPOSURE]: groundTruthRiskCriteria[ANTIBIOTIC_EXPOSURE]["1"],
  [CO_MORBIDITIES]: groundTruthRiskCriteria[CO_MORBIDITIES]["1"],
});
assert(unknown.riskType === null, "unknown criterion must fail closed");
assert(unknown.invalidCriteria[0] === HOSPITAL_CONTACT, "invalid criterion must be named");
