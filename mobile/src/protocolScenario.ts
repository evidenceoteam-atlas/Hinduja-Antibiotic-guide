import { supabase } from "./supabase";
import {
  classifyProtocolQueryError,
  type ProtocolDataErrorCode as QueryErrorCode,
} from "./protocolScenarioCore";

export { classifyProtocolQueryError } from "./protocolScenarioCore";

export type ProtocolInfection = "BSI" | "UTI" | "RTI" | "IAI";
export type ProtocolLocation = "ICU" | "wards";
export type ProtocolAcquisition = "community_acquired" | "hospital_acquired";
export type ProtocolRiskType = "1" | "2" | "3";

export type ProtocolScenarioKey = {
  infectionType: ProtocolInfection;
  location: ProtocolLocation;
  acquisition: ProtocolAcquisition;
  riskType: ProtocolRiskType;
};

export type ProtocolScenarioRow = {
  dataset_release_id: string;
  release_key: string;
  guide_version: string;
  valid_through: string;
  antibiogram_sheet_id: string;
  infection_type: ProtocolInfection;
  location: ProtocolLocation;
  acquisition: ProtocolAcquisition;
  sheet_key: string;
  risk_type: ProtocolRiskType;
  sheet_title: string;
  section_notes: string[];
  availability_status: "available" | "no_source_therapy";
  therapy_id: string | null;
  empiric_therapy: string | null;
  source_value: string | null;
  source_locator: Record<string, unknown>;
  source_value_sha256: string;
  source_quote: string;
  source_filename: string;
  source_file_sha256: string;
};

export type DatasetReleaseStatus = {
  dataset_release_id: string;
  release_key: string;
  guide_version: string;
  effective_status: "pending_review" | "approved" | "active" | "expired" | "retired";
  valid_from: string | null;
  valid_through: string;
  updated_at: string;
};

export type ProtocolDataErrorCode =
  | QueryErrorCode
  | "malformed_row"
  | "missing_scenario"
  | "no_release"
  | "release_unavailable";

export type ProtocolScenarioResult =
  | { status: "found"; row: ProtocolScenarioRow }
  | { status: "no_source_therapy"; row: ProtocolScenarioRow }
  | { status: "expired"; release: DatasetReleaseStatus }
  | { status: "data_error"; code: ProtocolDataErrorCode; message: string };

const infections = new Set(["BSI", "UTI", "RTI", "IAI"]);
const locations = new Set(["ICU", "wards"]);
const acquisitions = new Set(["community_acquired", "hospital_acquired"]);
const risks = new Set(["1", "2", "3"]);

export function isProtocolScenarioKey(value: ProtocolScenarioKey): boolean {
  return (
    infections.has(value.infectionType) &&
    locations.has(value.location) &&
    acquisitions.has(value.acquisition) &&
    risks.has(value.riskType)
  );
}

function isScenarioRow(value: unknown, key: ProtocolScenarioKey): value is ProtocolScenarioRow {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Partial<ProtocolScenarioRow>;
  return (
    row.infection_type === key.infectionType &&
    row.location === key.location &&
    row.acquisition === key.acquisition &&
    row.risk_type === key.riskType &&
    (row.availability_status === "available" || row.availability_status === "no_source_therapy") &&
    typeof row.source_filename === "string" &&
    typeof row.source_file_sha256 === "string" &&
    typeof row.valid_through === "string"
  );
}

export async function loadProtocolScenario(
  key: ProtocolScenarioKey,
): Promise<ProtocolScenarioResult> {
  if (!isProtocolScenarioKey(key)) {
    return {
      status: "data_error",
      code: "malformed_row",
      message: "The selected clinical scenario is invalid. Re-enter all scenario fields.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("approved_current_protocol_scenarios_with_source")
      .select("*")
      .eq("infection_type", key.infectionType)
      .eq("location", key.location)
      .eq("acquisition", key.acquisition)
      .eq("risk_type", key.riskType)
      .maybeSingle();

    if (error) {
      return classifyProtocolQueryError(error);
    }
    if (data) {
      if (!isScenarioRow(data, key)) {
        return {
          status: "data_error",
          code: "malformed_row",
          message: "The approved protocol row failed validation. Contact support and use the institutional guide.",
        };
      }
      if (data.availability_status === "no_source_therapy") {
        if (data.empiric_therapy !== null) {
          return {
            status: "data_error",
            code: "malformed_row",
            message: "The approved protocol row is internally inconsistent. Contact support.",
          };
        }
        return { status: "no_source_therapy", row: data };
      }
      if (!data.empiric_therapy?.trim() || !data.therapy_id) {
        return {
          status: "data_error",
          code: "malformed_row",
          message: "The approved protocol row has no source-backed therapy. Contact support.",
        };
      }
      return { status: "found", row: data };
    }

    const { data: release, error: releaseError } = await supabase
      .from("approved_dataset_release_status")
      .select("*")
      .maybeSingle();
    if (releaseError) {
      return classifyProtocolQueryError(releaseError);
    }
    if (!release) {
      return {
        status: "data_error",
        code: "no_release",
        message: "No reviewed clinical dataset release is installed. Use the institutional guide.",
      };
    }
    const typedRelease = release as DatasetReleaseStatus;
    if (typedRelease.effective_status === "expired") {
      return { status: "expired", release: typedRelease };
    }
    if (typedRelease.effective_status !== "active") {
      return {
        status: "data_error",
        code: "release_unavailable",
        message: "The clinical dataset is awaiting review or activation. Use the institutional guide.",
      };
    }
    return {
      status: "data_error",
      code: "missing_scenario",
      message: "The active dataset is missing this exact scenario. Contact support and use the institutional guide.",
    };
  } catch (error) {
    return classifyProtocolQueryError(error instanceof Error ? { message: error.message } : {});
  }
}

export function protocolScenarioMessage(result: ProtocolScenarioResult): string {
  switch (result.status) {
    case "found":
      return "";
    case "no_source_therapy":
      return "No therapy is provided in the institutional source for this exact scenario. Refer to the institutional guideline or an ID specialist.";
    case "expired":
      return `The institutional guide expired on ${result.release.valid_through}. No protocol can be displayed until a revalidated release is active.`;
    case "data_error":
      return result.message;
  }
}
