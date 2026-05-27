import { supabase } from "./supabase";

type JsonObject = Record<string, unknown>;

export type SourceBackedRow = {
  id: string;
  source_quote: string;
  source_page: number | null;
  source_section: string | null;
  source_span_page_number?: number | null;
  source_span_section_heading?: string | null;
  source_span_quote?: string | null;
  source_filename?: string | null;
  source_file_sha256?: string | null;
};

export type IcmrGuidelineRow = SourceBackedRow & {
  clinical_condition: string;
  common_pathogens: string | null;
  empirical_ama: string | null;
  alternate_ama: string | null;
  comments: string | null;
};

export type DurationGuidelineRow = SourceBackedRow & {
  infection: string;
  duration: string;
  remarks: string | null;
};

export type AntibiogramSheet = SourceBackedRow & {
  infection_type: string;
  location: string;
  acquisition: string;
  sheet_title: string;
  surveillance: string | null;
  type_totals: JsonObject;
  section_notes: string[];
};

export type AntibiogramPathogenRow = SourceBackedRow & {
  sheet_key: string;
  risk_type: string;
  sno: number | null;
  pathogen_name: string;
  isolate_count: number | null;
  has_footnote_marker: boolean;
  prevalence_pct: number | null;
  sensitivities: Record<string, number>;
  raw_sensitivity_text: string | null;
};

export type AntibiogramEmpiricTherapy = SourceBackedRow & {
  sheet_key: string;
  risk_type: string;
  empiric_therapy: string;
};

export type StewardshipPearl = SourceBackedRow & {
  section_name: string;
  pearl_text: string;
  sort_order: number;
};

export type PerioperativeRecommendation = SourceBackedRow & {
  procedure: string;
  preferred_drug: string;
};

export type PerioperativeAntibioticDosing = SourceBackedRow & {
  drug: string;
  standard_dose: string | null;
  weight_based_dose: string | null;
  bolus_or_infusion_duration: string | null;
};

export type PerioperativeNote = SourceBackedRow & {
  note_type: string;
  note_text: string;
  sort_order: number;
};

export type AntibiogramDetails = {
  sheets: AntibiogramSheet[];
  pathogenRows: AntibiogramPathogenRow[];
  empiricTherapy: AntibiogramEmpiricTherapy[];
};

export type PerioperativeGuidelines = {
  recommendations: PerioperativeRecommendation[];
  antibioticDosing: PerioperativeAntibioticDosing[];
  notes: PerioperativeNote[];
};

const asArray = <T>(data: T[] | null): T[] => data ?? [];

export async function loadIcmrGuidelines(): Promise<IcmrGuidelineRow[]> {
  try {
    const { data, error } = await supabase
      .from("approved_icmr_guideline_rows_with_source")
      .select("*")
      .order("clinical_condition", { ascending: true });

    if (error) {
      return [];
    }
    return asArray(data as IcmrGuidelineRow[] | null);
  } catch {
    return [];
  }
}

export async function loadDurationGuidelines(): Promise<DurationGuidelineRow[]> {
  try {
    const { data, error } = await supabase
      .from("approved_duration_guideline_rows_with_source")
      .select("*")
      .order("infection", { ascending: true });

    if (error) {
      return [];
    }
    return asArray(data as DurationGuidelineRow[] | null);
  } catch {
    return [];
  }
}

export async function loadAntibiogramSheets(
  infectionType?: string,
): Promise<AntibiogramSheet[]> {
  try {
    let query = supabase
      .from("approved_antibiogram_sheets_with_source")
      .select("*")
      .order("infection_type", { ascending: true })
      .order("location", { ascending: true })
      .order("acquisition", { ascending: true });

    if (infectionType) {
      query = query.ilike("infection_type", infectionType);
    }

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return asArray(data as AntibiogramSheet[] | null);
  } catch {
    return [];
  }
}

export async function loadAntibiogramDetails(
  infectionType?: string,
): Promise<AntibiogramDetails> {
  try {
    const sheets = await loadAntibiogramSheets(infectionType);
    const sheetKeys = sheets.map((sheet) =>
      [sheet.infection_type, sheet.location, sheet.acquisition].join("."),
    );

    if (sheetKeys.length === 0) {
      return { sheets: [], pathogenRows: [], empiricTherapy: [] };
    }

    const [
      { data: pathogenRows, error: pathogenError },
      { data: therapyRows, error: therapyError },
    ] = await Promise.all([
      supabase
        .from("approved_antibiogram_pathogen_rows_with_source")
        .select("*")
        .in("sheet_key", sheetKeys)
        .order("sheet_key", { ascending: true })
        .order("risk_type", { ascending: true })
        .order("sno", { ascending: true }),
      supabase
        .from("approved_antibiogram_empiric_therapy_with_source")
        .select("*")
        .in("sheet_key", sheetKeys)
        .order("sheet_key", { ascending: true })
        .order("risk_type", { ascending: true }),
    ]);

    return {
      sheets,
      pathogenRows: pathogenError
        ? []
        : asArray(pathogenRows as AntibiogramPathogenRow[] | null),
      empiricTherapy: therapyError
        ? []
        : asArray(therapyRows as AntibiogramEmpiricTherapy[] | null),
    };
  } catch {
    return { sheets: [], pathogenRows: [], empiricTherapy: [] };
  }
}

export async function loadStewardshipPearls(): Promise<StewardshipPearl[]> {
  try {
    const { data, error } = await supabase
      .from("approved_stewardship_pearl_rows_with_source")
      .select("*")
      .order("section_name", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      return [];
    }
    return asArray(data as StewardshipPearl[] | null);
  } catch {
    return [];
  }
}

export async function loadPerioperativeGuidelines(): Promise<PerioperativeGuidelines> {
  try {
    const [
      { data: recommendations, error: recommendationsError },
      { data: antibioticDosing, error: dosingError },
      { data: notes, error: notesError },
    ] = await Promise.all([
      supabase
        .from("approved_perioperative_procedure_recommendations_with_source")
        .select("*")
        .order("procedure", { ascending: true }),
      supabase
        .from("approved_perioperative_antibiotic_dosing_with_source")
        .select("*")
        .order("drug", { ascending: true }),
      supabase
        .from("approved_perioperative_notes_with_source")
        .select("*")
        .order("note_type", { ascending: true })
        .order("sort_order", { ascending: true }),
    ]);

    return {
      recommendations: recommendationsError
        ? []
        : asArray(recommendations as PerioperativeRecommendation[] | null),
      antibioticDosing: dosingError
        ? []
        : asArray(antibioticDosing as PerioperativeAntibioticDosing[] | null),
      notes: notesError ? [] : asArray(notes as PerioperativeNote[] | null),
    };
  } catch {
    return {
      recommendations: [],
      antibioticDosing: [],
      notes: [],
    };
  }
}
