export type ReviewStatus = "draft" | "in_review" | "approved" | "retired";
export type AppRole = "doctor" | "reviewer" | "admin";

export type DoctorProfile = {
  id: string;
  full_name: string;
  email: string;
  hospital: string;
  department: string | null;
  designation: string | null;
  role: AppRole;
};

export type Reference = {
  id: string;
  title: string;
  citation: string;
  url: string | null;
  publisher: string | null;
  publication_year: number | null;
  last_reviewed_at: string | null;
  review_status: ReviewStatus;
};

export type Antibiotic = {
  id: string;
  name: string;
  generic_name: string | null;
  class_name: string | null;
  spectrum_summary: string | null;
  stewardship_level: string;
  black_box_warning: string | null;
  review_status: ReviewStatus;
  last_reviewed_at: string | null;
};

export type Infection = {
  id: string;
  code: string;
  name: string;
  body_site: string | null;
  description: string | null;
  review_status: ReviewStatus;
  last_reviewed_at: string | null;
};

export type GuidelineAntibiotic = {
  id: string;
  role: "first_line" | "alternative" | "culture_directed" | "avoid";
  rank: number;
  route: string | null;
  dose_text: string | null;
  duration_text: string | null;
  conditions: string | null;
  review_status: ReviewStatus;
  last_reviewed_at: string | null;
  antibiotic: Antibiotic | null;
  source_reference: Reference | null;
};

export type TreatmentGuideline = {
  id: string;
  infection_id: string;
  title: string;
  setting: string;
  acquisition: string;
  severity: string;
  age_group: "adult" | "pediatric" | "neonate";
  pregnancy_applicable: boolean;
  summary: string | null;
  escalation_note: string | null;
  deescalation_note: string | null;
  specialist_review_triggers: string[];
  warning_flags: string[];
  strength_of_recommendation: string | null;
  review_status: ReviewStatus;
  last_reviewed_at: string | null;
  infection: Infection | null;
  source_reference: Reference | null;
  guideline_antibiotics?: GuidelineAntibiotic[];
};

export type RiskFactor = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  weight: number;
  review_status: ReviewStatus;
};

export type RenalAdjustment = {
  id: string;
  adjustment_text: string;
  monitoring_text: string | null;
  egfr_min: number | null;
  egfr_max: number | null;
  crcl_min: number | null;
  crcl_max: number | null;
  antibiotic: Antibiotic | null;
  source_reference: Reference | null;
  review_status: ReviewStatus;
};

export type SafetyItem = {
  id: string;
  pregnancy_status?: string;
  lactation_status?: string;
  trimester_notes?: string | null;
  lactation_notes?: string | null;
  contraindication?: string;
  severity?: string;
  action_text?: string;
  allergy_class?: string;
  risk_text?: string;
  antibiotic: Antibiotic | null;
  source_reference: Reference | null;
  review_status: ReviewStatus;
};

export type RecommendationInput = {
  infectionId: string | null;
  setting: string;
  acquisition: string;
  severity: string;
  ageGroup: "adult" | "pediatric" | "neonate";
  pregnancyStatus: "not_pregnant" | "pregnant" | "unknown";
  egfr: string;
  hepaticImpairment: string;
  allergyClass: string;
  riskAnswers: Record<string, boolean>;
};

export type RecommendationResult = {
  status: "ok" | "insufficient";
  message: string;
  guideline: TreatmentGuideline | null;
  firstLine: GuidelineAntibiotic[];
  alternatives: GuidelineAntibiotic[];
  warnings: string[];
  sources: Reference[];
};
