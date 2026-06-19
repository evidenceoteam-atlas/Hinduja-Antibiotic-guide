import { StatusBar } from "expo-status-bar";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import {
  classifyAntibiogramRisk,
  defaultAntibiogramRiskAnswers,
  patientCriterionLabels,
  type AntibiogramRiskAnswers,
  type AntibiogramRiskCriteria,
} from "./antibiogramRisk";
import {
  loadAntibiogramDetails,
  loadAntifungalSusceptibilityRows,
  loadAntimicrobialPearlPoints,
  loadDurationGuidelines,
  loadGuideMetadata,
  loadIcmrGuidelines,
  loadCurrentPatientRiskCriteria,
  loadPerioperativeGuidelines,
  loadStewardshipPearls,
  loadSynergyAntifungalNotes,
  loadSynergyTestingRows,
  type AntibiogramDetails,
  type AntibiogramEmpiricTherapy,
  type AntibiogramFootnote,
  type AntibiogramPathogenRow,
  type AntibiogramRiskCriterion,
  type AntibiogramSheet,
  type AntifungalSusceptibilityRow,
  type AntimicrobialPearlPoint,
  type DurationGuidelineRow,
  type GuideDocumentMetadata,
  type IcmrGuidelineRow,
  type CurrentPatientRiskCriterion,
  type PerioperativeAntibioticDosing,
  type PerioperativeGuidelines,
  type PerioperativeNote,
  type PerioperativeRecommendation,
  type StewardshipPearl,
  type SynergyAntifungalNote,
  type SynergyTestingRow,
} from "./clinicalData";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  loadProtocolScenario,
  protocolScenarioMessage,
  type ProtocolScenarioKey,
  type ProtocolScenarioResult,
} from "./protocolScenario";

declare const __DEV__: boolean | undefined;

type AppIconName =
  | "shield"
  | "search"
  | "home"
  | "book"
  | "clock"
  | "alert"
  | "user"
  | "droplet"
  | "activity"
  | "wind"
  | "lungs"
  | "bladder"
  | "brain"
  | "skin"
  | "abdomen"
  | "neck"
  | "gi"
  | "fungus"
  | "ear"
  | "heart"
  | "joint"
  | "immunity"
  | "clipboard"
  | "medical"
  | "community"
  | "hospital"
  | "icu"
  | "ward"
  | "monitor"
  | "bed"
  | "pill"
  | "risk-low"
  | "risk-medium"
  | "risk-high"
  | "clinician"
  | "layers"
  | "cpu"
  | "thermometer"
  | "chevron-left"
  | "chevron-right"
  | "menu"
  | "edit"
  | "save"
  | "file"
  | "share"
  | "mail"
  | "download"
  | "printer"
  | "info"
  | "check"
  | "plus";

type Screen =
  | "doctorDetails"
  | "dashboard"
  | "guidelines"
  | "guidelineSection"
  | "duration"
  | "antibiogram"
  | "alerts"
  | "profile"
  | "editProfile"
  | "infectionSite"
  | "setting"
  | "acquisition"
  | "riskSelection"
  | "riskAssessment"
  | "classification"
  | "protocolResult"
  | "protocolDetails"
  | "actions"
  | "savedCases"
  | "reports"
  | "shareView"
  | "stewardshipAlert"
  | "caseReport";

type RiskType = "Type 1" | "Type 2" | "Type 3";

type InfectionSite = {
  code: string;
  label: string;
  icon: AppIconName;
  tone: string;
};

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  icon: AppIconName;
  site?: InfectionSite;
  tone?: string;
  target:
    | "setting"
    | "riskSelection"
    | "protocolResult"
    | "protocolDetails"
    | "guidelineSection"
    | "duration"
    | "antibiogram";
  guidelineSection?: GuidelineSectionKey;
  sectionSearchText?: string;
  riskType?: RiskType;
  detailTab?: ProtocolDetailTab;
  keywords: string;
};

type SourceRecommendation = {
  id: string;
  syndrome: string | null;
  infection_site: string | null;
  setting: string | null;
  acquisition: string | null;
  risk_type: string | null;
  severity_category: string | null;
  organism: string | null;
  pathogen: string | null;
  drug: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  renal_adjustment: string | null;
  hepatic_adjustment: string | null;
  pregnancy_lactation_caution: string | null;
  allergy_warning: string | null;
  contraindication: string | null;
  stewardship_note: string | null;
  id_consult_trigger: string | null;
  clinical_condition: string | null;
  common_pathogens: string | null;
  empirical_ama: string | null;
  alternate_ama: string | null;
  comments: string | null;
  ama_role: "empirical" | "alternate" | null;
  source_image: string | null;
  source_page: number | null;
  review_status: "approved";
  source_filename: string;
  page_number: number | null;
  section_heading: string | null;
  source_quote: string;
  extracted_at: string;
};

type ProtocolDrugDisplay = {
  key: string;
  name: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  optional: boolean;
};

type ProtocolOptionDisplay = {
  key: string;
  optionNumber: number;
  relationship: "SINGLE" | "AND" | "OPTIONAL" | "MIXED";
  drugs: ProtocolDrugDisplay[];
};

type Palette = {
  bg: string;
  card: string;
  soft: string;
  text: string;
  muted: string;
  border: string;
  blue: string;
  blue2: string;
  red: string;
  orange: string;
  green: string;
  shadow: string;
};

const sites: InfectionSite[] = [
  {
    code: "BSI",
    label: "Blood Stream Infection (BSI)",
    icon: "droplet",
    tone: "#D9267D",
  },
  {
    code: "UTI",
    label: "Urinary Tract Infection (UTI)",
    icon: "bladder",
    tone: "#2563EB",
  },
  {
    code: "RTI",
    label: "Respiratory Tract Infection (RTI)",
    icon: "lungs",
    tone: "#0284C7",
  },
  {
    code: "IAI",
    label: "Intra-abdominal Infection",
    icon: "abdomen",
    tone: "#DC5656",
  },
  { code: "CNS", label: "CNS Infection", icon: "brain", tone: "#1698B8" },
  {
    code: "SSTI",
    label: "Skin & Soft Tissue Infection (SSTI)",
    icon: "skin",
    tone: "#2BAA72",
  },
  { code: "FN", label: "Febrile Neutropenia", icon: "thermometer", tone: "#7C3AED" },
];

type BottomTab =
  | "Home"
  | "Guidelines"
  | "Duration"
  | "Antibiogram"
  | "Alerts"
  | "Profile";
type AntibiogramInfectionFilter = "BSI" | "UTI" | "RTI" | "IAI";
type AntibiogramLocationFilter = "ICU" | "wards";
type AntibiogramAcquisitionFilter = "community_acquired" | "hospital_acquired";
type AntibiogramRiskFilter = "1" | "2" | "3";
type ProtocolDetailTab = "Notes" | "Warnings" | "ID Consult";
type DrawerMenuItem = {
  label: string;
  icon: AppIconName;
  action: () => void;
  danger?: boolean;
};
type OtpTarget = {
  value: string;
  name?: string;
};
type GuidelineSectionKey =
  | "icmr"
  | "stewardshipPearls"
  | "pearlPoints"
  | "synergyTesting"
  | "antifungalSusceptibility"
  | "perioperative"
  | "empiric"
  | "renal"
  | "carbapenem";
type GuidelineSectionItem = {
  key: GuidelineSectionKey;
  title: string;
  subtitle: string;
  icon: AppIconName;
};
type PearlContentRow = {
  id: string;
  section_name: string;
  pearl_text: string;
  sort_order: number;
  source_page: number | null;
  source_quote: string;
};
type PearlSectionGroup<T extends PearlContentRow> = {
  sectionName: string;
  rows: T[];
};

type DoctorProfile = {
  name: string;
  email: string;
  employeeId: string;
  contactNumber: string;
};

const DOCTOR_PROFILE_STORAGE_KEY = "hinduja-doctor-profile-v1";

const emptyDoctorProfile = (): DoctorProfile => ({
  name: "",
  email: "",
  employeeId: "",
  contactNumber: "",
});

const parseStoredDoctorProfile = (value: string | null): DoctorProfile => {
  if (!value) {
    return emptyDoctorProfile();
  }

  try {
    const parsed = JSON.parse(value) as Partial<DoctorProfile>;
    return {
      name: typeof parsed.name === "string" ? parsed.name.trim() : "",
      email: typeof parsed.email === "string" ? parsed.email.trim() : "",
      employeeId:
        typeof parsed.employeeId === "string" ? parsed.employeeId.trim() : "",
      contactNumber:
        typeof parsed.contactNumber === "string"
          ? parsed.contactNumber.trim()
          : "",
    };
  } catch {
    return emptyDoctorProfile();
  }
};

const hasCompleteDoctorProfile = (profile: DoctorProfile) =>
  Boolean(profile.name && profile.employeeId && profile.contactNumber);

type SavedClinicalCase = {
  id: string;
  infectionSite: string;
  setting: string;
  acquisition: string;
  riskLevel: string;
  riskType: RiskType | null;
  recommendations: SourceRecommendation[];
  warningRecommendations: SourceRecommendation[];
  consultRecommendations: SourceRecommendation[];
  savedAt: string;
  doctorName: string;
  doctorEmail: string;
};

const bottomTabs: BottomTab[] = [
  "Home",
  "Guidelines",
  "Duration",
  "Antibiogram",
  "Alerts",
  "Profile",
];

const antibiogramInfectionFilters: AntibiogramInfectionFilter[] = [
  "BSI",
  "UTI",
  "RTI",
  "IAI",
];
const antibiogramLocationFilters: AntibiogramLocationFilter[] = ["ICU", "wards"];
const antibiogramAcquisitionFilters: AntibiogramAcquisitionFilter[] = [
  "community_acquired",
  "hospital_acquired",
];
const antibiogramRiskFilters: AntibiogramRiskFilter[] = ["1", "2", "3"];

const guidelineSections: GuidelineSectionItem[] = [
  {
    key: "icmr",
    title: "Site Based ICMR Antibiotic Guidelines",
    subtitle: "Approved guide rows with source page and quote",
    icon: "book",
  },
  {
    key: "stewardshipPearls",
    title: "Antimicrobial Stewardship Pearls",
    subtitle: "Approved stewardship pearls grouped by section",
    icon: "shield",
  },
  {
    key: "pearlPoints",
    title: "Antimicrobial Pearl Points",
    subtitle: "Approved antimicrobial pearl points grouped by section",
    icon: "check",
  },
  {
    key: "synergyTesting",
    title: "Synergy Testing",
    subtitle: "Approved ceftazidime-avibactam and aztreonam synergy rows",
    icon: "layers",
  },
  {
    key: "antifungalSusceptibility",
    title: "Antifungal Susceptibility",
    subtitle: "Approved Aspergillus and Candida susceptibility rows",
    icon: "fungus",
  },
  {
    key: "perioperative",
    title: "Perioperative Antimicrobial Guidelines",
    subtitle: "Approved procedure, dosing, and perioperative notes",
    icon: "clipboard",
  },
  {
    key: "empiric",
    title: "Empiric therapy by infection site",
    subtitle: "Approved source-based treatment summaries",
    icon: "activity",
  },
  {
    key: "renal",
    title: "Renal dose adjustment",
    subtitle: "Approved kidney-function dosing guidance",
    icon: "droplet",
  },
  {
    key: "carbapenem",
    title: "Carbapenem stewardship policy",
    subtitle: "Approved restricted-antibiotic stewardship notes",
    icon: "shield",
  },
];

const bottomTabIcons: Record<BottomTab, AppIconName> = {
  Home: "home",
  Guidelines: "book",
  Duration: "clock",
  Antibiogram: "activity",
  Alerts: "alert",
  Profile: "user",
};

const tabRoutes: Record<BottomTab, Screen> = {
  Home: "dashboard",
  Guidelines: "guidelines",
  Duration: "duration",
  Antibiogram: "antibiogram",
  Alerts: "alerts",
  Profile: "profile",
};

const infectionAliases: Record<string, string[]> = {
  BSI: ["bloodstream", "blood stream", "bacteremia", "sepsis", "blood culture"],
  UTI: ["urinary", "urine", "pyelonephritis", "urosepsis", "cystitis"],
  RTI: ["respiratory", "pneumonia", "cap", "hap", "vap", "lung"],
  IAI: ["intra abdominal", "abdomen", "peritonitis", "appendicitis", "biliary"],
  CNS: ["meningitis", "encephalitis", "brain", "csf", "central nervous system"],
  SSTI: ["skin", "soft tissue", "cellulitis", "abscess", "diabetic foot"],
  FN: ["febrile", "neutropenia", "neutropenic fever", "oncology", "anc"],
};

const antibiogramFilterLabel = (value: string) => {
  if (value === "wards") {
    return "Wards";
  }
  if (value === "community_acquired") {
    return "Community-acquired";
  }
  if (value === "hospital_acquired") {
    return "Hospital-acquired";
  }
  if (value === "1" || value === "2" || value === "3") {
    return `Type ${value}`;
  }
  return value;
};

const antibiogramSheetKey = (
  infectionType: string,
  location: string,
  acquisitionValue: string,
) => [infectionType, location, acquisitionValue].join(".");

const paletteFor = (_dark: boolean): Palette => ({
  bg: "#F7FBFF",
  card: "#FFFFFF",
  soft: "#EEF6FF",
  text: "#0B2850",
  muted: "#5C6F86",
  border: "#DDEAF7",
  blue: "#0057B8",
  blue2: "#004AA3",
  red: "#D93A3A",
  orange: "#F28C28",
  green: "#1E9D61",
  shadow: "#174B7C",
});

const AppIcon = ({
  name,
  size = 36,
  color = "#0057B8",
  style,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const stroke = Math.max(2, Math.min(3, Math.round(size / 17)));
  const root = {
    width: size,
    height: size,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  const line = {
    position: "absolute" as const,
    height: stroke,
    borderRadius: stroke,
    backgroundColor: color,
  };
  const vline = {
    position: "absolute" as const,
    width: stroke,
    borderRadius: stroke,
    backgroundColor: color,
  };
  const outline = {
    position: "absolute" as const,
    borderWidth: stroke,
    borderColor: color,
    backgroundColor: "transparent",
  };

  const Line = ({ style: lineStyle }: { style?: StyleProp<ViewStyle> }) => (
    <View style={[line, lineStyle]} />
  );
  const VLine = ({ style: lineStyle }: { style?: StyleProp<ViewStyle> }) => (
    <View style={[vline, lineStyle]} />
  );
  const Circle = ({
    scale = 0.5,
    left,
    right,
    top,
    style: circleStyle,
  }: {
    scale?: number;
    left?: number;
    right?: number;
    top?: number;
    style?: StyleProp<ViewStyle>;
  }) => (
    <View
      style={[
        outline,
        {
          width: size * scale,
          height: size * scale,
          borderRadius: (size * scale) / 2,
          left: typeof left === "number" ? size * left : undefined,
          right: typeof right === "number" ? size * right : undefined,
          top: typeof top === "number" ? size * top : undefined,
        },
        circleStyle,
      ]}
    />
  );
  const RoundedBox = ({
    width,
    height,
    radius,
    left,
    right,
    top,
    style: boxStyle,
  }: {
    width: number;
    height: number;
    radius?: number;
    left?: number;
    right?: number;
    top?: number;
    style?: StyleProp<ViewStyle>;
  }) => (
    <View
      style={[
        outline,
        {
          width: size * width,
          height: size * height,
          borderRadius: size * (radius ?? Math.min(width, height) / 2),
          left: typeof left === "number" ? size * left : undefined,
          right: typeof right === "number" ? size * right : undefined,
          top: typeof top === "number" ? size * top : undefined,
        },
        boxStyle,
      ]}
    />
  );
  const Pill = ({
    width,
    left,
    right,
    top,
    rotate,
  }: {
    width: number;
    left?: number;
    right?: number;
    top?: number;
    rotate?: string;
  }) => (
    <Line
      style={{
        width: size * width,
        left: typeof left === "number" ? size * left : undefined,
        right: typeof right === "number" ? size * right : undefined,
        top: typeof top === "number" ? size * top : undefined,
        transform: rotate ? [{ rotate }] : undefined,
      }}
    />
  );

  const content = (() => {
    switch (name) {
      case "search":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.55,
                  height: size * 0.55,
                  borderRadius: size * 0.28,
                  left: size * 0.16,
                  top: size * 0.12,
                },
              ]}
            />
            <Line
              style={{
                width: size * 0.32,
                left: size * 0.58,
                top: size * 0.66,
                transform: [{ rotate: "45deg" }],
              }}
            />
          </>
        );
      case "home":
        return (
          <>
            <Line
              style={{
                width: size * 0.44,
                left: size * 0.17,
                top: size * 0.32,
                transform: [{ rotate: "-38deg" }],
              }}
            />
            <Line
              style={{
                width: size * 0.44,
                right: size * 0.17,
                top: size * 0.32,
                transform: [{ rotate: "38deg" }],
              }}
            />
            <View
              style={[
                outline,
                {
                  width: size * 0.54,
                  height: size * 0.42,
                  borderTopWidth: 0,
                  borderRadius: stroke * 2,
                  left: size * 0.23,
                  top: size * 0.45,
                },
              ]}
            />
          </>
        );
      case "book":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.36,
                  height: size * 0.62,
                  borderRadius: stroke * 2,
                  left: size * 0.13,
                  top: size * 0.18,
                },
              ]}
            />
            <View
              style={[
                outline,
                {
                  width: size * 0.36,
                  height: size * 0.62,
                  borderRadius: stroke * 2,
                  right: size * 0.13,
                  top: size * 0.18,
                },
              ]}
            />
            <VLine style={{ height: size * 0.58, top: size * 0.2 }} />
          </>
        );
      case "clock":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.72,
                  height: size * 0.72,
                  borderRadius: size * 0.36,
                },
              ]}
            />
            <VLine style={{ height: size * 0.22, top: size * 0.27 }} />
            <Line style={{ width: size * 0.2, left: size * 0.49, top: size * 0.5 }} />
          </>
        );
      case "alert":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.68,
                  height: size * 0.68,
                  borderRadius: size * 0.34,
                },
              ]}
            />
            <Text
              style={{
                color,
                fontSize: size * 0.58,
                lineHeight: size * 0.64,
                fontWeight: "900",
              }}
            >
              !
            </Text>
          </>
        );
      case "user":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.32,
                  height: size * 0.32,
                  borderRadius: size * 0.16,
                  top: size * 0.14,
                },
              ]}
            />
            <View
              style={[
                outline,
                {
                  width: size * 0.62,
                  height: size * 0.32,
                  borderRadius: size * 0.16,
                  borderTopLeftRadius: size * 0.28,
                  borderTopRightRadius: size * 0.28,
                  top: size * 0.56,
                },
              ]}
            />
          </>
        );
      case "shield":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.66,
                  height: size * 0.54,
                  borderBottomWidth: 0,
                  borderTopLeftRadius: size * 0.22,
                  borderTopRightRadius: size * 0.22,
                  borderRadius: size * 0.12,
                  top: size * 0.14,
                },
              ]}
            />
            <Line
              style={{
                width: size * 0.38,
                left: size * 0.2,
                top: size * 0.67,
                transform: [{ rotate: "42deg" }],
              }}
            />
            <Line
              style={{
                width: size * 0.38,
                right: size * 0.2,
                top: size * 0.67,
                transform: [{ rotate: "-42deg" }],
              }}
            />
          </>
        );
      case "droplet":
        return (
          <>
            <Circle scale={0.58} top={0.32} />
            <Pill width={0.48} left={0.17} top={0.24} rotate="-50deg" />
            <Pill width={0.48} right={0.17} top={0.24} rotate="50deg" />
          </>
        );
      case "bladder":
        return (
          <>
            <RoundedBox width={0.52} height={0.42} top={0.38} />
            <Pill width={0.18} left={0.34} top={0.34} rotate="46deg" />
            <Pill width={0.18} right={0.34} top={0.34} rotate="-46deg" />
            <Pill width={0.2} left={0.22} top={0.18} rotate="64deg" />
            <Pill width={0.2} right={0.22} top={0.18} rotate="-64deg" />
            <VLine style={{ height: size * 0.18, top: size * 0.78 }} />
          </>
        );
      case "lungs":
        return (
          <>
            <VLine style={{ height: size * 0.6, top: size * 0.12 }} />
            <Pill width={0.28} left={0.28} top={0.34} rotate="-35deg" />
            <Pill width={0.28} right={0.28} top={0.34} rotate="35deg" />
            <RoundedBox width={0.34} height={0.5} left={0.11} top={0.36} radius={0.18} />
            <RoundedBox width={0.34} height={0.5} right={0.11} top={0.36} radius={0.18} />
          </>
        );
      case "brain":
        return (
          <>
            <RoundedBox width={0.72} height={0.58} top={0.14} radius={0.28} />
            <VLine style={{ height: size * 0.5, top: size * 0.18 }} />
            <Pill width={0.2} left={0.26} top={0.34} />
            <Pill width={0.2} right={0.26} top={0.48} />
            <VLine style={{ height: size * 0.14, top: size * 0.68 }} />
          </>
        );
      case "skin":
        return (
          <>
            <RoundedBox width={0.74} height={0.52} top={0.24} radius={0.14} />
            <Line style={{ width: size * 0.6, top: size * 0.44 }} />
            <Line style={{ width: size * 0.5, top: size * 0.6 }} />
            <Circle scale={0.12} left={0.6} top={0.32} />
          </>
        );
      case "abdomen":
        return (
          <>
            <RoundedBox width={0.68} height={0.58} top={0.2} radius={0.26} />
            <Pill width={0.4} left={0.3} top={0.35} />
            <Pill width={0.4} right={0.3} top={0.5} />
            <Pill width={0.4} left={0.3} top={0.65} />
          </>
        );
      case "activity":
        return (
          <>
            <Line style={{ width: size * 0.18, left: size * 0.08, top: size * 0.52 }} />
            <Line
              style={{
                width: size * 0.22,
                left: size * 0.24,
                top: size * 0.44,
                transform: [{ rotate: "-58deg" }],
              }}
            />
            <Line
              style={{
                width: size * 0.28,
                left: size * 0.42,
                top: size * 0.48,
                transform: [{ rotate: "58deg" }],
              }}
            />
            <Line style={{ width: size * 0.24, right: size * 0.08, top: size * 0.52 }} />
          </>
        );
      case "wind":
        return (
          <>
            <Line style={{ width: size * 0.72, left: size * 0.12, top: size * 0.28 }} />
            <Line style={{ width: size * 0.56, left: size * 0.24, top: size * 0.5 }} />
            <Line style={{ width: size * 0.42, left: size * 0.16, top: size * 0.72 }} />
          </>
        );
      case "layers":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.58,
                  height: size * 0.3,
                  borderRadius: stroke * 2,
                  top: size * 0.16,
                },
              ]}
            />
            <View
              style={[
                outline,
                {
                  width: size * 0.58,
                  height: size * 0.3,
                  borderRadius: stroke * 2,
                  top: size * 0.36,
                  left: size * 0.17,
                },
              ]}
            />
            <View
              style={[
                outline,
                {
                  width: size * 0.58,
                  height: size * 0.3,
                  borderRadius: stroke * 2,
                  top: size * 0.56,
                  left: size * 0.11,
                },
              ]}
            />
          </>
        );
      case "neck":
        return (
          <>
            <Circle scale={0.32} top={0.08} />
            <Pill width={0.24} left={0.35} top={0.44} rotate="72deg" />
            <Pill width={0.24} right={0.35} top={0.44} rotate="-72deg" />
            <RoundedBox width={0.68} height={0.24} top={0.66} radius={0.12} />
          </>
        );
      case "gi":
        return (
          <>
            <RoundedBox width={0.66} height={0.58} top={0.2} radius={0.2} />
            <Pill width={0.4} top={0.36} left={0.25} />
            <Pill width={0.4} top={0.5} right={0.25} />
            <Pill width={0.4} top={0.64} left={0.25} />
          </>
        );
      case "fungus":
        return (
          <>
            <Circle scale={0.42} top={0.22} />
            <Circle scale={0.14} left={0.18} top={0.18} />
            <Circle scale={0.14} right={0.18} top={0.24} />
            <Circle scale={0.12} left={0.26} top={0.66} />
            <Pill width={0.2} left={0.2} top={0.5} rotate="-22deg" />
            <Pill width={0.2} right={0.2} top={0.5} rotate="22deg" />
          </>
        );
      case "ear":
        return (
          <>
            <RoundedBox width={0.44} height={0.62} left={0.26} top={0.14} radius={0.22} />
            <RoundedBox width={0.2} height={0.28} left={0.39} top={0.3} radius={0.1} />
            <Pill width={0.2} left={0.45} top={0.72} rotate="-35deg" />
          </>
        );
      case "heart":
        return (
          <>
            <Circle scale={0.28} left={0.22} top={0.18} />
            <Circle scale={0.28} right={0.22} top={0.18} />
            <Pill width={0.36} left={0.24} top={0.54} rotate="45deg" />
            <Pill width={0.36} right={0.24} top={0.54} rotate="-45deg" />
            <Pill width={0.32} top={0.49} />
            <VLine style={{ height: size * 0.24, top: size * 0.38 }} />
          </>
        );
      case "joint":
        return (
          <>
            <Circle scale={0.26} left={0.18} top={0.22} />
            <Circle scale={0.26} right={0.18} top={0.5} />
            <Pill width={0.42} left={0.31} top={0.5} rotate="35deg" />
          </>
        );
      case "immunity":
        return (
          <>
            <Circle scale={0.34} left={0.1} top={0.16} />
            <RoundedBox width={0.54} height={0.26} left={0.02} top={0.6} radius={0.13} />
            <RoundedBox width={0.32} height={0.28} right={0.08} top={0.28} radius={0.1} style={{ borderBottomWidth: 0 }} />
            <Pill width={0.2} right={0.14} top={0.58} rotate="42deg" />
            <Pill width={0.2} right={0.05} top={0.58} rotate="-42deg" />
          </>
        );
      case "clipboard":
        return (
          <>
            <RoundedBox width={0.58} height={0.72} top={0.16} radius={0.08} />
            <RoundedBox width={0.34} height={0.16} top={0.08} radius={0.06} />
            <Pill width={0.3} top={0.48} />
            <VLine style={{ height: size * 0.3, top: size * 0.34 }} />
          </>
        );
      case "medical":
        return (
          <>
            <Circle scale={0.72} />
            <Pill width={0.42} />
            <VLine style={{ height: size * 0.42 }} />
          </>
        );
      case "community":
        return (
          <>
            <Pill width={0.42} left={0.18} top={0.34} rotate="-38deg" />
            <Pill width={0.42} right={0.18} top={0.34} rotate="38deg" />
            <RoundedBox width={0.56} height={0.42} left={0.22} top={0.46} radius={0.06} />
            <RoundedBox width={0.14} height={0.22} left={0.43} top={0.66} radius={0.03} />
          </>
        );
      case "hospital":
        return (
          <>
            <RoundedBox width={0.62} height={0.66} left={0.19} top={0.2} radius={0.06} />
            <Pill width={0.28} top={0.36} />
            <VLine style={{ height: size * 0.28, top: size * 0.22 }} />
            {[0.3, 0.58].map((left) => (
              <View
                key={`hospital-window-${left}`}
                style={{
                  position: "absolute",
                  width: stroke,
                  height: stroke,
                  borderRadius: stroke,
                  backgroundColor: color,
                  left: size * left,
                  top: size * 0.58,
                }}
              />
            ))}
            <RoundedBox width={0.16} height={0.18} left={0.42} top={0.68} radius={0.02} />
          </>
        );
      case "icu":
      case "monitor":
        return (
          <>
            <RoundedBox width={0.72} height={0.46} left={0.14} top={0.18} radius={0.08} />
            <Pill width={0.16} left={0.22} top={0.42} />
            <Pill width={0.14} left={0.36} top={0.37} rotate="-58deg" />
            <Pill width={0.18} left={0.47} top={0.4} rotate="58deg" />
            <Pill width={0.16} right={0.22} top={0.42} />
            <VLine style={{ height: size * 0.16, top: size * 0.64 }} />
            <Pill width={0.42} top={0.82} />
          </>
        );
      case "ward":
      case "bed":
        return (
          <>
            <RoundedBox width={0.72} height={0.24} left={0.14} top={0.48} radius={0.06} />
            <RoundedBox width={0.2} height={0.18} left={0.18} top={0.34} radius={0.05} />
            <Pill width={0.74} left={0.13} top={0.72} />
            <VLine style={{ height: size * 0.18, left: size * 0.18, top: size * 0.72 }} />
            <VLine style={{ height: size * 0.18, right: size * 0.18, top: size * 0.72 }} />
          </>
        );
      case "pill":
        return (
          <>
            <RoundedBox
              width={0.68}
              height={0.3}
              left={0.16}
              top={0.36}
              radius={0.15}
              style={{ transform: [{ rotate: "-28deg" }] }}
            />
            <Pill width={0.28} left={0.36} top={0.5} rotate="-28deg" />
          </>
        );
      case "risk-low":
        return (
          <>
            <View style={[outline, { width: size * 0.58, height: size * 0.48, borderBottomWidth: 0, borderTopLeftRadius: size * 0.16, borderTopRightRadius: size * 0.16, top: size * 0.18 }]} />
            <Pill width={0.28} left={0.26} top={0.58} rotate="45deg" />
            <Pill width={0.42} left={0.42} top={0.52} rotate="-45deg" />
            <Pill width={0.28} left={0.26} top={0.7} rotate="42deg" />
            <Pill width={0.28} right={0.26} top={0.7} rotate="-42deg" />
          </>
        );
      case "risk-medium":
        return (
          <>
            <Circle scale={0.68} />
            <Text style={{ color, fontSize: size * 0.5, lineHeight: size * 0.56, fontWeight: "800" }}>
              !
            </Text>
          </>
        );
      case "risk-high":
        return (
          <>
            <Pill width={0.66} top={0.28} rotate="60deg" />
            <Pill width={0.66} top={0.28} rotate="-60deg" />
            <Pill width={0.58} top={0.76} />
            <Text style={{ color, fontSize: size * 0.42, lineHeight: size * 0.46, fontWeight: "800", top: size * 0.08 }}>
              !
            </Text>
          </>
        );
      case "clinician":
        return (
          <>
            <Circle scale={0.28} left={0.18} top={0.16} />
            <RoundedBox width={0.48} height={0.24} left={0.08} top={0.58} radius={0.12} />
            <Pill width={0.28} right={0.12} top={0.42} />
            <VLine style={{ height: size * 0.28, right: size * 0.26, top: size * 0.28 }} />
          </>
        );
      case "cpu":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.54,
                  height: size * 0.54,
                  borderRadius: stroke * 2,
                },
              ]}
            />
            {[0.24, 0.5, 0.76].map((offset) => (
              <View key={`cpu-h-${offset}`}>
                <Line style={{ width: size * 0.12, left: 0, top: size * offset }} />
                <Line style={{ width: size * 0.12, right: 0, top: size * offset }} />
              </View>
            ))}
            {[0.24, 0.5, 0.76].map((offset) => (
              <View key={`cpu-v-${offset}`}>
                <VLine style={{ height: size * 0.12, top: 0, left: size * offset }} />
                <VLine style={{ height: size * 0.12, bottom: 0, left: size * offset }} />
              </View>
            ))}
          </>
        );
      case "thermometer":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.28,
                  height: size * 0.66,
                  borderRadius: size * 0.14,
                  top: size * 0.07,
                },
              ]}
            />
            <VLine
              style={{
                width: stroke * 1.35,
                height: size * 0.48,
                top: size * 0.2,
              }}
            />
            <View
              style={[
                outline,
                {
                  width: size * 0.4,
                  height: size * 0.4,
                  borderRadius: size * 0.2,
                  top: size * 0.56,
                },
              ]}
            />
            <Pill width={0.16} right={0.25} top={0.28} />
            <Pill width={0.12} right={0.27} top={0.43} />
          </>
        );
      case "chevron-left":
      case "chevron-right": {
        const direction = name === "chevron-left" ? -1 : 1;
        return (
          <>
            <Line
              style={{
                width: size * 0.42,
                top: size * 0.36,
                transform: [{ rotate: `${direction * 42}deg` }],
              }}
            />
            <Line
              style={{
                width: size * 0.42,
                top: size * 0.62,
                transform: [{ rotate: `${direction * -42}deg` }],
              }}
            />
          </>
        );
      }
      case "menu":
        return (
          <>
            <Line style={{ width: size * 0.72, top: size * 0.25 }} />
            <Line style={{ width: size * 0.72, top: size * 0.5 }} />
            <Line style={{ width: size * 0.72, top: size * 0.75 }} />
          </>
        );
      case "edit":
        return (
          <>
            <Line
              style={{
                width: size * 0.62,
                top: size * 0.48,
                transform: [{ rotate: "-42deg" }],
              }}
            />
            <View
              style={[
                outline,
                {
                  width: size * 0.56,
                  height: size * 0.34,
                  borderRadius: stroke * 2,
                  top: size * 0.5,
                },
              ]}
            />
          </>
        );
      case "save":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.66,
                  height: size * 0.66,
                  borderRadius: stroke * 2,
                },
              ]}
            />
            <Line style={{ width: size * 0.38, top: size * 0.28 }} />
            <View
              style={[
                outline,
                {
                  width: size * 0.36,
                  height: size * 0.18,
                  borderRadius: stroke,
                  top: size * 0.58,
                },
              ]}
            />
          </>
        );
      case "file":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.56,
                  height: size * 0.7,
                  borderRadius: stroke * 2,
                },
              ]}
            />
            <Line style={{ width: size * 0.34, top: size * 0.42 }} />
            <Line style={{ width: size * 0.34, top: size * 0.56 }} />
          </>
        );
      case "mail":
        return (
          <>
            <View
              style={[
                outline,
                {
                  width: size * 0.72,
                  height: size * 0.48,
                  borderRadius: stroke * 2,
                },
              ]}
            />
            <Line
              style={{
                width: size * 0.38,
                left: size * 0.18,
                top: size * 0.47,
                transform: [{ rotate: "32deg" }],
              }}
            />
            <Line
              style={{
                width: size * 0.38,
                right: size * 0.18,
                top: size * 0.47,
                transform: [{ rotate: "-32deg" }],
              }}
            />
          </>
        );
      case "share":
        return (
          <>
            {[{ left: 0.18, top: 0.22 }, { left: 0.64, top: 0.42 }, { left: 0.22, top: 0.68 }].map(
              (dot, index) => (
                <View
                  key={`share-dot-${index}`}
                  style={[
                    outline,
                    {
                      width: size * 0.18,
                      height: size * 0.18,
                      borderRadius: size * 0.09,
                      left: size * dot.left,
                      top: size * dot.top,
                    },
                  ]}
                />
              ),
            )}
            <Line style={{ width: size * 0.42, left: size * 0.28, top: size * 0.38, transform: [{ rotate: "20deg" }] }} />
            <Line style={{ width: size * 0.42, left: size * 0.28, top: size * 0.62, transform: [{ rotate: "-22deg" }] }} />
          </>
        );
      case "download":
        return (
          <>
            <VLine style={{ height: size * 0.48, top: size * 0.12 }} />
            <Line style={{ width: size * 0.28, top: size * 0.52, transform: [{ rotate: "45deg" }] }} />
            <Line style={{ width: size * 0.28, top: size * 0.52, transform: [{ rotate: "-45deg" }] }} />
            <Line style={{ width: size * 0.62, top: size * 0.82 }} />
          </>
        );
      case "printer":
        return (
          <>
            <View style={[outline, { width: size * 0.56, height: size * 0.3, top: size * 0.12, borderRadius: stroke }]} />
            <View style={[outline, { width: size * 0.72, height: size * 0.42, top: size * 0.38, borderRadius: stroke * 2 }]} />
            <Line style={{ width: size * 0.44, top: size * 0.7 }} />
          </>
        );
      case "info":
        return (
          <>
            <View style={[outline, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35 }]} />
            <Text style={{ color, fontSize: size * 0.52, lineHeight: size * 0.58, fontWeight: "900" }}>
              i
            </Text>
          </>
        );
      case "check":
        return (
          <>
            <Line style={{ width: size * 0.3, left: size * 0.18, top: size * 0.56, transform: [{ rotate: "45deg" }] }} />
            <Line style={{ width: size * 0.56, left: size * 0.37, top: size * 0.48, transform: [{ rotate: "-45deg" }] }} />
          </>
        );
      case "plus":
        return (
          <>
            <Line style={{ width: size * 0.62 }} />
            <VLine style={{ height: size * 0.62 }} />
          </>
        );
      default:
        return (
          <>
            <View style={[outline, { width: size * 0.64, height: size * 0.64, borderRadius: stroke * 2 }]} />
          </>
        );
    }
  })();

  return <View style={[root, style]}>{content}</View>;
};

const initialsForName = (name: string, email: string) => {
  const label = name.trim() || email.trim();
  const parts = label
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "DR";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const normalizeMatchText = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchStopWords = new Set([
  "infection",
  "infections",
  "clinical",
  "guideline",
  "guidelines",
  "protocol",
  "protocols",
  "therapy",
  "treatment",
  "tract",
]);

const splitMatchTokens = (value: string | null | undefined) =>
  normalizeMatchText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !matchStopWords.has(token));

const hasSharedToken = (left: string, right: string) => {
  const leftTokens = new Set(splitMatchTokens(left));
  return splitMatchTokens(right).some((token) => leftTokens.has(token));
};

type InfectionCategory =
  | "BSI"
  | "UTI"
  | "RTI"
  | "CNS"
  | "SSTI"
  | "IAI"
  | "FN";

const infectionCategorySynonyms: Record<InfectionCategory, string[]> = {
  BSI: [
    "BSI",
    "Blood Stream Infection",
    "Bloodstream Infection",
    "Blood stream infection bsi",
    "Bacteremia",
    "Bacteraemia",
    "Sepsis",
  ],
  UTI: ["UTI", "Urinary Tract Infection", "Urinary infection", "Urosepsis"],
  RTI: [
    "RTI",
    "Respiratory Tract Infection",
    "Respiratory infection",
    "Pneumonia",
    "CAP",
    "HCAP",
    "VAP",
    "HAP",
    "Lung abscess",
  ],
  CNS: [
    "CNS",
    "CNS Infection",
    "Central Nervous System Infection",
    "Meningitis",
    "Encephalitis",
    "Brain abscess",
  ],
  SSTI: [
    "SSTI",
    "Skin and Soft Tissue Infection",
    "Skin & Soft Tissue Infection",
    "Skin Soft Tissue Infection",
    "Cellulitis",
    "Pyomyositis",
    "Necrotizing fasciitis",
    "Diabetic foot infection",
  ],
  IAI: [
    "IAI",
    "Intra-abdominal",
    "Intra abdominal",
    "Intra-abdominal Infection",
    "Intra abdominal infection",
    "Intra-abdominal sepsis",
    "Intra abdominal sepsis",
    "Liver abscess",
  ],
  FN: [
    "FN",
    "Febrile Neutropenia",
    "Febrile neutropenic",
    "Neutropenic fever",
  ],
};

const synonymMatchesText = (synonym: string, normalizedText: string) => {
  const normalizedSynonym = normalizeMatchText(synonym);

  return (
    normalizedSynonym.length > 0 &&
    (normalizedText.includes(normalizedSynonym) ||
      normalizedSynonym.includes(normalizedText) ||
      hasSharedToken(normalizedSynonym, normalizedText))
  );
};

const canonicalInfectionCategory = (
  value: string | null | undefined,
): InfectionCategory | null => {
  const normalizedValue = normalizeMatchText(value);

  if (!normalizedValue) {
    return null;
  }

  const exactCode = normalizedValue.toUpperCase() as InfectionCategory;
  if (Object.keys(infectionCategorySynonyms).includes(exactCode)) {
    return exactCode;
  }

  const orderedCategories: InfectionCategory[] = [
    "BSI",
    "UTI",
    "RTI",
    "CNS",
    "SSTI",
    "IAI",
    "FN",
  ];

  return (
    orderedCategories.find((category) =>
      infectionCategorySynonyms[category].some((synonym) =>
        synonymMatchesText(synonym, normalizedValue),
      ),
    ) ?? null
  );
};

function isRiskTypedInfection(infection: string): boolean {
  const category = canonicalInfectionCategory(infection);
  const normalized = normalizeMatchText(infection);

  return (
    category === "BSI" ||
    category === "UTI" ||
    category === "RTI" ||
    category === "IAI" ||
    [
      "bsi",
      "blood stream infection",
      "bloodstream infection",
      "blood stream infections",
      "uti",
      "urinary tract infection",
      "urinary tract infections",
      "rti",
      "respiratory tract infection",
      "respiratory tract infections",
      "pneumonia",
      "cap",
      "hap",
      "vap",
      "iai",
      "intra abdominal infection",
      "intra abdominal infections",
    ].some((value) => normalized === normalizeMatchText(value))
  );
}

const iconForInfection = (value: string | null | undefined): AppIconName => {
  const normalized = normalizeMatchText(value);

  switch (canonicalInfectionCategory(value)) {
    case "BSI":
      return "droplet";
    case "UTI":
      return "bladder";
    case "RTI":
      return "lungs";
    case "IAI":
      return "abdomen";
    case "CNS":
      return "brain";
    case "SSTI":
      return "skin";
    case "FN":
      return "thermometer";
    default:
      if (normalized.includes("neck") || normalized.includes("throat")) {
        return "neck";
      }
      if (
        normalized.includes("dysentery") ||
        normalized.includes("diarrhea") ||
        normalized.includes("gastro") ||
        normalized.includes("intestinal") ||
        normalized.includes("colitis")
      ) {
        return "gi";
      }
      if (
        normalized.includes("candida") ||
        normalized.includes("candidiasis") ||
        normalized.includes("fungal") ||
        normalized.includes("fungemia")
      ) {
        return "fungus";
      }
      if (
        normalized.includes("otitis") ||
        normalized.includes("ear") ||
        normalized.includes("mastoid")
      ) {
        return "ear";
      }
      if (
        normalized.includes("endocarditis") ||
        normalized.includes("valve") ||
        normalized.includes("cardiac")
      ) {
        return "heart";
      }
      if (
        normalized.includes("joint") ||
        normalized.includes("prosthetic") ||
        normalized.includes("implant") ||
        normalized.includes("orthopedic")
      ) {
        return "joint";
      }
      if (
        normalized.includes("host") ||
        normalized.includes("immun") ||
        normalized.includes("susceptible")
      ) {
        return "immunity";
      }
      if (
        normalized.includes("empiric") ||
        normalized.includes("therapy") ||
        normalized.includes("protocol")
      ) {
        return "clipboard";
      }
      return "medical";
  }
};

const toneForInfection = (value: string | null | undefined) => {
  switch (canonicalInfectionCategory(value)) {
    case "BSI":
      return "#D9267D";
    case "UTI":
      return "#2563EB";
    case "RTI":
      return "#0284C7";
    case "IAI":
      return "#DC5656";
    case "CNS":
      return "#1698B8";
    case "SSTI":
      return "#2BAA72";
    case "FN":
      return "#7C3AED";
    default:
      return "#0057B8";
  }
};

const titleCaseClinicalName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());

const cleanInfectionName = (value: string | null | undefined) => {
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? "";

  if (!trimmed) {
    return "";
  }

  const normalized = normalizeMatchText(trimmed);
  const blocked = new Set([
    "therapy",
    "dose",
    "duration",
    "recommendation",
    "recommendations",
    "suspected",
    "aerobic",
    "antibiotic",
    "antibiotics",
  ]);

  if (
    blocked.has(normalized) ||
    normalized.length < 3 ||
    /^\d+$/.test(normalized)
  ) {
    return "";
  }

  const category = canonicalInfectionCategory(trimmed);
  const defaultSite = category
    ? sites.find((site) => site.code === category)?.label
    : undefined;

  return defaultSite ?? titleCaseClinicalName(trimmed);
};

const meaninglessDrugFragments = new Set([
  "therapy",
  "dose",
  "suspected",
  "aerobic",
  "units sd followed by",
  "units ld followed by",
  "doses followed by",
  "followed by",
  "site based icmr antibiotic",
  "antibiotic",
  "antibiotics",
  "treatment",
  "empiric therapy",
  "clavulanate",
  "antitoxin effect in",
]);

const meaningfulDrugPattern =
  /(amoxicillin|amoxyclav|co-amox|coamox|clavulanate|cef|azithro|doxy|mero|imipenem|doripenem|piperacillin|pip|tazobactam|tazo|vancomycin|teicoplanin|linezolid|daptomycin|aztreonam|metronidazole|clindamycin|colistin|polymyxin|fosfomycin|tigecycline|ampicillin|sulbactam|gentamicin|penicillin|cefazolin|ceftazidime|avibactam|cloxacillin|flucloxacillin|acyclovir|dexamethasone|caspofungin|micafungin|fluconazole|voriconazole|ertapenem|amikacin|levofloxacin|ciprofloxacin|trimethoprim|sulfamethoxazole|co-trimoxazole|cotrimoxazole|tmp-smx|nitrofurantoin|carbapenem|glycopeptide)/i;

const hasMeaningfulTreatment = (item: SourceRecommendation) => {
  const drug = item.drug?.trim();

  if (!drug) {
    return false;
  }

  const normalizedDrug = normalizeMatchText(drug);
  if (
    !normalizedDrug ||
    normalizedDrug.length < 3 ||
    meaninglessDrugFragments.has(normalizedDrug)
  ) {
    return false;
  }

  if (/^(or|and|plus|with|without)\b/i.test(drug) || /^(\+|\+\/-)/.test(drug)) {
    return false;
  }

  if (/[+/-]$/.test(drug.trim())) {
    return false;
  }

  if (/^(suspected|aerobic|anaerobic|therapy|dose|duration)$/i.test(drug)) {
    return false;
  }

  return meaningfulDrugPattern.test(drug);
};

const hasMeaningfulText = (value: string | null | undefined) => {
  const normalized = normalizeMatchText(value);
  return Boolean(
    normalized &&
      normalized.length > 6 &&
      !meaninglessDrugFragments.has(normalized) &&
      !["not specified", "none", "nil", "na"].includes(normalized),
  );
};

const hasDisplayValue = (value: string | null | undefined) =>
  Boolean(value?.trim());

const filterPearlRows = <T extends PearlContentRow>(rows: T[], query: string) => {
  const normalizedQuery = normalizeMatchText(query);

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) =>
    normalizeMatchText(row.pearl_text).includes(normalizedQuery),
  );
};

const groupPearlRowsBySection = <T extends PearlContentRow>(
  rows: T[],
): PearlSectionGroup<T>[] => {
  const groups = new Map<string, T[]>();

  rows.forEach((row) => {
    const sectionName = row.section_name?.trim() || "General";
    const currentRows = groups.get(sectionName) ?? [];
    currentRows.push(row);
    groups.set(sectionName, currentRows);
  });

  return Array.from(groups.entries()).map(([sectionName, sectionRows]) => ({
    sectionName,
    rows: sectionRows.sort((left, right) => left.sort_order - right.sort_order),
  }));
};

const clinicalFieldScore = (value: string | null | undefined) =>
  hasDisplayValue(value) ? 1 : 0;

const displayScenarioValue = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

const canonicalScenarioFieldValue = (
  field: "setting" | "acquisition" | "risk",
  value: string | null | undefined,
) => {
  const normalized = normalizeMatchText(value);

  if (!normalized) {
    return "";
  }

  if (field === "setting") {
    if (/\bicu\b|intensive care|critical care/.test(normalized)) {
      return "ICU";
    }

    if (/ward|inpatient|floor/.test(normalized)) {
      return "Ward";
    }

    if (/\bopd\b|outpatient|ambulatory|clinic/.test(normalized)) {
      return "OPD";
    }
  }

  if (field === "acquisition") {
    if (/healthcare|health care|hca|hcai/.test(normalized)) {
      return "Healthcare-associated";
    }

    if (/hospital|nosocomial|\bhai\b/.test(normalized)) {
      return "Hospital-acquired";
    }

    if (/community|\bcap\b/.test(normalized)) {
      return "Community-acquired";
    }
  }

  if (field === "risk") {
    if (/type\s*1|low risk|low-risk/.test(normalized)) {
      return "Type 1 - Low Risk";
    }

    if (/type\s*2|medium risk|moderate risk|medium-risk|moderate-risk/.test(normalized)) {
      return "Type 2 - Medium Risk";
    }

    if (/type\s*3|high risk|high-risk/.test(normalized)) {
      return "Type 3 - High Risk";
    }
  }

  return displayScenarioValue(value);
};

const sourceFieldOptions = (
  rows: SourceRecommendation[],
  field: "setting" | "acquisition" | "risk",
) => {
  const options = new Map<string, string>();

  rows.forEach((row) => {
    const values =
      field === "risk"
        ? [row.risk_type, row.severity_category]
        : [row[field]];

    values.forEach((value) => {
      const canonical = canonicalScenarioFieldValue(field, value);
      const key = normalizeMatchText(canonical);

      if (key && !options.has(key)) {
        options.set(key, canonical);
      }
    });
  });

  return Array.from(options.values()).sort((left, right) => {
    const order = [
      "Ward",
      "ICU",
      "OPD",
      "Community-acquired",
      "Hospital-acquired",
      "Healthcare-associated",
      "Type 1 - Low Risk",
      "Type 2 - Medium Risk",
      "Type 3 - High Risk",
    ];

    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);

    if (leftIndex >= 0 || rightIndex >= 0) {
      return (leftIndex >= 0 ? leftIndex : 999) - (rightIndex >= 0 ? rightIndex : 999);
    }

    return left.localeCompare(right);
  });
};

const carbapenemPattern = /(carbapenem|meropenem|imipenem|ertapenem|doripenem)/i;
const explicitDurationPattern =
  /\b(?:\d+\s*(?:-|–|—|to)\s*\d+\s*(?:days?|weeks?)|\d+\s*(?:days?|weeks?)|until\s+(?:ANC\s+recovery|afebrile|culture\s+results|clinical\s+response|source\s+control|cultures?\s+(?:are\s+)?(?:sterile|negative)|neutrophil\s+recovery))\b/gi;
const scoreSourceRecommendationBundleMarker = "scoreSourceRecommendation";

function scoreSourceRecommendation(rec: any): number {
  try {
    if (scoreSourceRecommendationBundleMarker.length === 0) {
      return 0;
    }

    if (!rec) {
      return 0;
    }

    let score = 0;

    if (typeof rec.confidence === "number") {
      score += rec.confidence * 100;
    }

    if (typeof rec.score === "number") {
      score += rec.score;
    }

    if (typeof rec.priority === "number") {
      score += rec.priority * 10;
    }

    if (typeof rec.evidence_level === "number") {
      score += rec.evidence_level;
    }

    score += clinicalFieldScore(rec.dose) * 3;
    score += clinicalFieldScore(rec.route) * 2;
    score += clinicalFieldScore(rec.frequency) * 2;
    score += clinicalFieldScore(rec.duration);
    score += hasMeaningfulText(rec.stewardship_note) ? 1 : 0;
    score += hasMeaningfulText(rec.id_consult_trigger) ? 1 : 0;

    return Number.isFinite(score) ? score : 0;
  } catch {
    return 0;
  }
}

const normalizeDurationText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "–")
    .replace(/\s*—\s*/g, "–")
    .replace(/\s+to\s+/gi, "–")
    .trim();

const extractDurationCandidates = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return [];
  }

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const match of value.matchAll(explicitDurationPattern)) {
    const duration = normalizeDurationText(match[0]);
    const key = normalizeMatchText(duration);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push(duration);
  }

  return candidates;
};

type DurationRecommendation = {
  duration: string;
  items: SourceRecommendation[];
  notes: string[];
  reviewTrigger: string;
};

const getDurationRecommendation = (
  rows: SourceRecommendation[],
): DurationRecommendation[] => {
  const groups = new Map<string, DurationRecommendation>();
  const sortedRows = [...rows].sort(
    (left, right) =>
      scoreSourceRecommendation(right) - scoreSourceRecommendation(left),
  );

  sortedRows.forEach((item) => {
    const structuredDurations = hasDisplayValue(item.duration)
      ? [normalizeDurationText(item.duration ?? "")]
      : [];
    const extractedDurations = [
      item.source_quote,
      item.section_heading,
      item.stewardship_note,
      item.id_consult_trigger,
      item.dose,
      item.frequency,
    ].flatMap(extractDurationCandidates);
    const durations =
      structuredDurations.length > 0 ? structuredDurations : extractedDurations;

    durations.forEach((duration) => {
      const key = normalizeMatchText(duration);

      if (!key) {
        return;
      }

      const existing = groups.get(key) ?? {
        duration,
        items: [],
        notes: [],
        reviewTrigger:
          "Reassess duration when cultures, source control, and clinical response are available.",
      };

      if (!existing.items.some((row) => row.id === item.id)) {
        existing.items.push(item);
      }

      const noteCandidates = [
        item.stewardship_note,
        item.id_consult_trigger,
        item.renal_adjustment,
        item.allergy_warning,
        item.contraindication,
      ].filter((value): value is string => Boolean(value && hasMeaningfulText(value)));

      noteCandidates.forEach((note) => {
        if (!existing.notes.some((savedNote) => normalizeMatchText(savedNote) === normalizeMatchText(note))) {
          existing.notes.push(note.trim());
        }
      });

      groups.set(key, existing);
    });
  });

  return Array.from(groups.values()).sort(
    (left, right) =>
      Math.max(...right.items.map(scoreSourceRecommendation), 0) -
      Math.max(...left.items.map(scoreSourceRecommendation), 0),
  );
};

const recommendationIdentity = (item: SourceRecommendation) =>
  [
    normalizeMatchText(item.drug),
    normalizeMatchText(item.dose),
    normalizeMatchText(item.route),
    normalizeMatchText(item.frequency),
    normalizeMatchText(item.duration),
  ].join("|");

const cleanRecommendationRows = (rows: SourceRecommendation[]) => {
  const seen = new Set<string>();

  return rows.filter((item) => {
    if (!hasMeaningfulTreatment(item)) {
      return false;
    }

    const identity = recommendationIdentity(item);
    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
};

const durationIdentity = (item: SourceRecommendation) =>
  [
    normalizeMatchText(item.duration),
    hasMeaningfulTreatment(item) ? normalizeMatchText(item.drug) : "",
    normalizeMatchText(item.dose),
    normalizeMatchText(item.route),
    normalizeMatchText(item.frequency),
  ].join("|");

const cleanDurationRows = (rows: SourceRecommendation[]) => {
  const seen = new Set<string>();

  return rows.filter((item) => {
    if (!hasDisplayValue(item.duration)) {
      return false;
    }

    const identity = durationIdentity(item);
    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
};

export default function App() {
  const dark = useColorScheme() === "dark";
  const { width, height } = useWindowDimensions();
  const palette = useMemo(() => paletteFor(dark), [dark]);
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const webTextInputReset = useMemo(
    () =>
      Platform.OS === "web"
        ? ({
            backgroundColor: "transparent",
            borderWidth: 0,
            borderColor: "transparent",
            outlineColor: "transparent",
            outlineStyle: "none",
            outlineWidth: 0,
            boxShadow: "none",
            WebkitBoxShadow: "0 0 0px 1000px transparent inset",
            WebkitTextFillColor: "#0B2850",
            caretColor: "#0B2850",
            WebkitAppearance: "none",
          } as Record<string, string | number>)
        : null,
    [],
  );

  const [routeStack, setRouteStack] = useState<Screen[]>(["doctorDetails"]);
  const screen = routeStack[routeStack.length - 1];
  const [appReady, setAppReady] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile>(
    emptyDoctorProfile,
  );
  const [doctorNameInput, setDoctorNameInput] = useState("");
  const [doctorEmailInput, setDoctorEmailInput] = useState("");
  const [doctorEmployeeIdInput, setDoctorEmployeeIdInput] = useState("");
  const [doctorContactInput, setDoctorContactInput] = useState("");
  const [doctorDetailsError, setDoctorDetailsError] = useState("");
  const [doctorDetailsLoading, setDoctorDetailsLoading] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileEmailInput, setProfileEmailInput] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTab>("Home");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState<InfectionSite>(sites[1]);
  const [setting, setSetting] = useState("ICU");
  const [acquisition, setAcquisition] = useState("Community-acquired");
  const [selectedSourceRisk, setSelectedSourceRisk] = useState("");
  const [riskAnswers, setRiskAnswers] = useState<AntibiogramRiskAnswers>(
    defaultAntibiogramRiskAnswers,
  );
  const [riskType, setRiskType] = useState<RiskType | null>(null);
  const [protocolDetailTab, setProtocolDetailTab] =
    useState<ProtocolDetailTab>("Notes");
  const [selectedGuidelineSection, setSelectedGuidelineSection] =
    useState<GuidelineSectionKey>("empiric");
  const [icmrGuidelineRows, setIcmrGuidelineRows] = useState<IcmrGuidelineRow[]>([]);
  const [icmrGuidelineLoading, setIcmrGuidelineLoading] = useState(false);
  const [icmrGuidelineError, setIcmrGuidelineError] = useState("");
  const [icmrGuidelineSearch, setIcmrGuidelineSearch] = useState("");
  const [durationGuidelineRows, setDurationGuidelineRows] = useState<
    DurationGuidelineRow[]
  >([]);
  const [durationGuidelineLoading, setDurationGuidelineLoading] = useState(false);
  const [durationGuidelineError, setDurationGuidelineError] = useState("");
  const [durationGuidelineSearch, setDurationGuidelineSearch] = useState("");
  const [antibiogramDetails, setAntibiogramDetails] = useState<AntibiogramDetails>({
    sheets: [],
    pathogenRows: [],
    empiricTherapy: [],
    riskCriteria: [],
    footnotes: [],
  });
  const [antibiogramLoading, setAntibiogramLoading] = useState(false);
  const [antibiogramError, setAntibiogramError] = useState("");
  const [antibiogramInfection, setAntibiogramInfection] =
    useState<AntibiogramInfectionFilter>("BSI");
  const [antibiogramLocation, setAntibiogramLocation] =
    useState<AntibiogramLocationFilter>("ICU");
  const [antibiogramAcquisition, setAntibiogramAcquisition] =
    useState<AntibiogramAcquisitionFilter>("community_acquired");
  const [antibiogramRiskType, setAntibiogramRiskType] =
    useState<AntibiogramRiskFilter>("1");
  const [stewardshipPearls, setStewardshipPearls] = useState<
    StewardshipPearl[]
  >([]);
  const [stewardshipPearlsLoading, setStewardshipPearlsLoading] =
    useState(false);
  const [stewardshipPearlsError, setStewardshipPearlsError] = useState("");
  const [stewardshipPearlSearch, setStewardshipPearlSearch] = useState("");
  const [antimicrobialPearlPoints, setAntimicrobialPearlPoints] = useState<
    AntimicrobialPearlPoint[]
  >([]);
  const [
    antimicrobialPearlPointsLoading,
    setAntimicrobialPearlPointsLoading,
  ] = useState(false);
  const [antimicrobialPearlPointsError, setAntimicrobialPearlPointsError] =
    useState("");
  const [antimicrobialPearlPointSearch, setAntimicrobialPearlPointSearch] =
    useState("");
  const [synergyTestingRows, setSynergyTestingRows] = useState<
    SynergyTestingRow[]
  >([]);
  const [synergyTestingLoading, setSynergyTestingLoading] = useState(false);
  const [synergyTestingError, setSynergyTestingError] = useState("");
  const [antifungalRows, setAntifungalRows] = useState<
    AntifungalSusceptibilityRow[]
  >([]);
  const [antifungalLoading, setAntifungalLoading] = useState(false);
  const [antifungalError, setAntifungalError] = useState("");
  const [synergyAntifungalNotes, setSynergyAntifungalNotes] = useState<
    SynergyAntifungalNote[]
  >([]);
  const [guideMetadata, setGuideMetadata] = useState<GuideDocumentMetadata | null>(
    null,
  );
  const [perioperativeGuidelines, setPerioperativeGuidelines] =
    useState<PerioperativeGuidelines>({
      recommendations: [],
      antibioticDosing: [],
      notes: [],
    });
  const [perioperativeLoading, setPerioperativeLoading] = useState(false);
  const [perioperativeError, setPerioperativeError] = useState("");
  const [sourceRecommendations, setSourceRecommendations] = useState<
    SourceRecommendation[]
  >([]);
  const [sourceRecommendationLoading, setSourceRecommendationLoading] =
    useState(false);
  const [sourceRecommendationError, setSourceRecommendationError] =
    useState("");
  const [protocolScenarioResult, setProtocolScenarioResult] =
    useState<ProtocolScenarioResult | null>(null);
  const [protocolScenarioLoading, setProtocolScenarioLoading] = useState(false);
  const [currentRiskCriteriaRows, setCurrentRiskCriteriaRows] = useState<
    CurrentPatientRiskCriterion[]
  >([]);
  const [currentRiskCriteriaLoading, setCurrentRiskCriteriaLoading] = useState(false);
  const [currentRiskCriteriaError, setCurrentRiskCriteriaError] = useState("");
  const [savedCases, setSavedCases] = useState<SavedClinicalCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<SavedClinicalCase | null>(
    null,
  );
  const [actionMessage, setActionMessage] = useState("");

  const applyDoctorProfile = (nextProfile: DoctorProfile) => {
    setDoctorProfile(nextProfile);
    setProfileNameInput(nextProfile.name);
    setProfileEmailInput(nextProfile.email);
    setDoctorNameInput(nextProfile.name);
    setDoctorEmailInput(nextProfile.email);
    setDoctorEmployeeIdInput(nextProfile.employeeId);
    setDoctorContactInput(nextProfile.contactNumber);
    setDoctorDetailsError("");
    setProfileError("");
    setProfileSuccess("");
  };

  useEffect(() => {
    let active = true;

    const initializeApplication = async () => {
      try {
        const storedProfile = parseStoredDoctorProfile(
          await AsyncStorage.getItem(DOCTOR_PROFILE_STORAGE_KEY),
        );

        if (!active) {
          return;
        }

        applyDoctorProfile(storedProfile);
        setRouteStack([
          hasCompleteDoctorProfile(storedProfile) ? "dashboard" : "doctorDetails",
        ]);

        if (isSupabaseConfigured) {
          void loadApprovedSourceRecommendations();
          void loadApprovedCurrentRiskCriteria();
          void loadApprovedIcmrGuidelines();
          void loadApprovedDurationGuidelines();
          void loadApprovedAntibiograms();
          void loadApprovedPearls();
          void loadApprovedSpecialGuidelineSections();
        }
      } catch (error) {
        console.error("[profile] local profile restore failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });

        if (!active) {
          return;
        }

        applyDoctorProfile(emptyDoctorProfile());
        setRouteStack(["doctorDetails"]);
      } finally {
        if (active) {
          setAppReady(true);
        }
      }
    };

    void initializeApplication();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }

    const styleId = "app-input-focus-reset";
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      input,
      textarea {
        background: transparent !important;
        outline: none !important;
        box-shadow: none !important;
      }

      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
        -webkit-text-fill-color: #0B2850 !important;
        transition: background-color 9999s ease-in-out 0s !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const nextActiveTab = bottomTabs.find((tab) => tabRoutes[tab] === screen);

    if (nextActiveTab && nextActiveTab !== activeTab) {
      setActiveTab(nextActiveTab);
    }
  }, [activeTab, screen]);

  const phoneWidth = Math.min(width - 28, 430);
  const contentMinHeight = Math.max(height - 24, 760);
  const riskLabel =
    riskType === "Type 1"
      ? "Low Risk"
      : riskType === "Type 2"
        ? "Medium Risk"
        : riskType === "Type 3"
          ? "High Risk"
          : "Unclassified";
  const riskColor =
    riskType === "Type 1"
      ? palette.green
      : riskType === "Type 2"
        ? palette.orange
        : riskType === "Type 3"
          ? palette.red
          : palette.muted;
  const riskIconName: AppIconName =
    riskType === "Type 1"
      ? "risk-low"
      : riskType === "Type 2"
        ? "risk-medium"
        : riskType === "Type 3"
          ? "risk-high"
          : "alert";
  const selectedIsRiskTyped = isRiskTypedInfection(
    `${selectedSite.code} ${selectedSite.label}`,
  );
  const selectedRiskDisplay = selectedIsRiskTyped
    ? riskType
      ? `${riskType} - ${riskLabel}`
      : "Risk assessment incomplete"
    : selectedSourceRisk || "Protocol-specific";
  const fieldMatches = (value: string | null, expected: string) => {
    const normalizedValue = normalizeMatchText(value);
    const normalizedExpected = normalizeMatchText(expected);

    return Boolean(normalizedValue && normalizedExpected && normalizedValue === normalizedExpected);
  };

  const recommendationMatchesSite = (
    item: SourceRecommendation,
    site: InfectionSite,
  ) => {
    const sourceCategory =
      canonicalInfectionCategory(item.infection_site) ??
      canonicalInfectionCategory(item.syndrome) ??
      canonicalInfectionCategory(item.section_heading) ??
      canonicalInfectionCategory(item.source_quote);
    const selectedCategory =
      canonicalInfectionCategory(site.code) ??
      canonicalInfectionCategory(site.label);

    if (sourceCategory && selectedCategory) {
      return sourceCategory === selectedCategory;
    }

    const sourceInfection = normalizeMatchText(
      `${item.infection_site ?? ""} ${item.syndrome ?? ""} ${
        item.section_heading ?? ""
      } ${item.source_quote ?? ""}`,
    );

    if (!sourceInfection) {
      return false;
    }

    const selectedInfection = normalizeMatchText(`${site.code} ${site.label}`);
    const selectedAliases = normalizeMatchText(
      infectionAliases[site.code]?.join(" ") ?? "",
    );
    const selectedWithAliases = normalizeMatchText(
      `${selectedInfection} ${selectedAliases}`,
    );

    return (
      sourceInfection.includes(normalizeMatchText(site.code)) ||
      sourceInfection.includes(selectedInfection) ||
      selectedWithAliases.includes(sourceInfection) ||
      hasSharedToken(sourceInfection, selectedWithAliases)
    );
  };

  const selectedInfectionRows = useMemo(
    () =>
      sourceRecommendations.filter((item) =>
        recommendationMatchesSite(item, selectedSite),
      ),
    [selectedSite, sourceRecommendations],
  );
  const selectedSettingOptions = useMemo(
    () =>
      selectedIsRiskTyped
        ? ["ICU", "Wards"]
        : sourceFieldOptions(selectedInfectionRows, "setting"),
    [selectedInfectionRows, selectedIsRiskTyped],
  );
  const selectedAcquisitionOptions = useMemo(
    () =>
      selectedIsRiskTyped
        ? ["Community-acquired", "Hospital-acquired"]
        : sourceFieldOptions(selectedInfectionRows, "acquisition"),
    [selectedInfectionRows, selectedIsRiskTyped],
  );
  const selectedRiskOptions = useMemo(
    () => sourceFieldOptions(selectedInfectionRows, "risk"),
    [selectedInfectionRows],
  );
  const hasSelectedSetting = selectedSettingOptions.length > 0;
  const hasSelectedAcquisition = selectedAcquisitionOptions.length > 0;
  const hasSelectedRisk =
    selectedIsRiskTyped || selectedRiskOptions.length > 0;
  const selectedScenarioParts = [
    selectedSite.code,
    hasSelectedSetting ? setting : null,
    hasSelectedAcquisition ? acquisition : null,
    hasSelectedRisk ? selectedRiskDisplay : null,
  ].filter(Boolean) as string[];
  const selectedScenarioSummary = selectedScenarioParts.join(" • ");
  const activeRiskCriteria = useMemo<AntibiogramRiskCriteria | null>(() => {
    const byCode = new Map(currentRiskCriteriaRows.map((row) => [row.criterion_code, row]));
    const hospital = byCode.get("hospital_contact");
    const antibiotic = byCode.get("antibiotic_exposure");
    const comorbidities = byCode.get("co_morbidities");
    if (!hospital || !antibiotic || !comorbidities) {
      return null;
    }
    return {
      "Hospital contact": { "1": hospital.type_1, "2": hospital.type_2, "3": hospital.type_3 },
      "Antibiotic exposure": { "1": antibiotic.type_1, "2": antibiotic.type_2, "3": antibiotic.type_3 },
      "Co-morbidities": { "1": comorbidities.type_1, "2": comorbidities.type_2, "3": comorbidities.type_3 },
    };
  }, [currentRiskCriteriaRows]);
  const riskCriterionGroups = useMemo(
    () =>
      patientCriterionLabels.map((criterionName) => ({
        criterionName,
        options: activeRiskCriteria
          ? [
              activeRiskCriteria[criterionName]["1"],
              activeRiskCriteria[criterionName]["2"],
              activeRiskCriteria[criterionName]["3"],
            ]
          : [],
      })),
    [activeRiskCriteria],
  );

  const protocolScenarioKey = useMemo<ProtocolScenarioKey | null>(() => {
    if (!selectedIsRiskTyped || !riskType) {
      return null;
    }
    const infectionType = ["BSI", "UTI", "RTI", "IAI"].includes(selectedSite.code)
      ? (selectedSite.code as ProtocolScenarioKey["infectionType"])
      : null;
    const location = setting === "ICU" ? "ICU" : setting === "Wards" ? "wards" : null;
    const acquisitionCode =
      acquisition === "Community-acquired"
        ? "community_acquired"
        : acquisition === "Hospital-acquired"
          ? "hospital_acquired"
          : null;
    const riskCode = riskType === "Type 1" ? "1" : riskType === "Type 2" ? "2" : "3";
    if (!infectionType || !location || !acquisitionCode) {
      return null;
    }
    return { infectionType, location, acquisition: acquisitionCode, riskType: riskCode };
  }, [acquisition, riskType, selectedIsRiskTyped, selectedSite.code, setting]);

  useEffect(() => {
    setProtocolScenarioResult(null);
    if (!protocolScenarioKey || !isSupabaseConfigured) {
      setProtocolScenarioLoading(false);
      return;
    }
    let cancelled = false;
    setProtocolScenarioLoading(true);
    void loadProtocolScenario(protocolScenarioKey).then((result) => {
      if (!cancelled) {
        setProtocolScenarioResult(result);
        setProtocolScenarioLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [protocolScenarioKey]);

  useEffect(() => {
    if (
      selectedSettingOptions.length > 0 &&
      !selectedSettingOptions.some((item) => fieldMatches(item, setting))
    ) {
      setSetting(selectedSettingOptions[0]);
    }

    if (
      selectedAcquisitionOptions.length > 0 &&
      !selectedAcquisitionOptions.some((item) => fieldMatches(item, acquisition))
    ) {
      setAcquisition(selectedAcquisitionOptions[0]);
    }

    if (!selectedIsRiskTyped && selectedRiskOptions.length > 0) {
      if (!selectedRiskOptions.some((item) => fieldMatches(item, selectedSourceRisk))) {
        setSelectedSourceRisk(selectedRiskOptions[0]);
      }
    }

    if (selectedIsRiskTyped && selectedSourceRisk) {
      setSelectedSourceRisk("");
    }
  }, [
    acquisition,
    fieldMatches,
    selectedAcquisitionOptions,
    selectedIsRiskTyped,
    selectedRiskOptions,
    selectedSettingOptions,
    selectedSourceRisk,
    setting,
  ]);

  const dynamicInfectionSites = useMemo(() => {
    const infectionMap = new Map<string, InfectionSite>();

    sites.forEach((site) => {
      infectionMap.set(site.code, site);
    });

    sourceRecommendations.forEach((item) => {
      const candidates = [
        item.infection_site,
        item.syndrome,
        item.section_heading,
      ];

      candidates.forEach((candidate) => {
        const label = cleanInfectionName(candidate);

        if (!label) {
          return;
        }

        const category = canonicalInfectionCategory(label);
        const key = category ?? normalizeMatchText(label);

        if (!key || infectionMap.has(key)) {
          return;
        }

        infectionMap.set(key, {
          code: category ?? `INF-${infectionMap.size + 1}`,
          label,
          icon: iconForInfection(label),
          tone: toneForInfection(label),
        });
      });
    });

    return Array.from(infectionMap.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [sourceRecommendations]);

  const groupedInfectionSites = useMemo(() => {
    const groups = new Map<string, InfectionSite[]>();

    dynamicInfectionSites.forEach((site) => {
      const category = canonicalInfectionCategory(`${site.code} ${site.label}`);
      const groupTitle =
        category && sites.find((defaultSite) => defaultSite.code === category)
          ? "Major infection systems"
          : "Additional guide infections";
      const current = groups.get(groupTitle) ?? [];
      current.push(site);
      groups.set(groupTitle, current);
    });

    return Array.from(groups.entries()).map(([title, rows]) => ({
      title,
      rows,
    }));
  }, [dynamicInfectionSites]);

  const searchResults = useMemo(() => {
    const query = normalizeMatchText(searchQuery);

    if (!query) {
      return [];
    }

    const results: SearchResult[] = [];
    const pushIfMatch = (result: SearchResult) => {
      const haystack = normalizeMatchText(
        `${result.title} ${result.subtitle} ${result.keywords}`,
      );
      const queryTokens = query.split(" ").filter(Boolean);

      if (
        haystack.includes(query) ||
        queryTokens.every((token) => haystack.includes(token))
      ) {
        results.push(result);
      }
    };
    const approvedGuidelineTone = palette.blue;

    dynamicInfectionSites.forEach((site) => {
      const aliases = infectionAliases[site.code] ?? [];
      const sourceMatchesSite = (value: string | null) => {
        if (!value) {
          return false;
        }

        const normalizedValue = value.toLowerCase();
        const normalizedSite = `${site.code} ${site.label}`.toLowerCase();
        return (
          normalizedValue.includes(site.code.toLowerCase()) ||
          normalizedSite.includes(normalizedValue)
        );
      };
      const sourceKeywords = sourceRecommendations
        .filter(
          (item) =>
            sourceMatchesSite(item.infection_site) ||
            sourceMatchesSite(item.syndrome),
        )
        .flatMap((item) => [
          item.syndrome,
          item.infection_site,
          item.setting,
          item.acquisition,
          item.risk_type,
          item.severity_category,
          item.organism,
          item.pathogen,
          item.drug,
          item.stewardship_note,
          item.id_consult_trigger,
          item.section_heading,
        ])
        .filter(Boolean)
        .join(" ");
      const sharedKeywords = [
        site.code,
        site.label,
        ...aliases,
        sourceKeywords,
      ].join(" ");

      pushIfMatch({
        id: `${site.code}-infection`,
        title: site.label,
        subtitle: "Open approved protocol",
        icon: site.icon,
        site,
        target: "setting",
        keywords: sharedKeywords,
      });

      pushIfMatch({
        id: `${site.code}-protocol`,
        title: `${site.code} empiric protocol`,
        subtitle: `${site.label} recommendations`,
        icon: "activity",
        site,
        target: "protocolDetails",
        detailTab: "Notes",
        keywords: sharedKeywords,
      });
    });

    icmrGuidelineRows.forEach((row) => {
      pushIfMatch({
        id: `icmr-${row.id}`,
        title: row.clinical_condition,
        subtitle: "Site Based ICMR Antibiotic Guidelines",
        icon: "book",
        tone: approvedGuidelineTone,
        target: "guidelineSection",
        guidelineSection: "icmr",
        sectionSearchText: row.clinical_condition,
        keywords: [
          row.clinical_condition,
          row.common_pathogens,
          row.empirical_ama,
          row.alternate_ama,
          row.comments,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    durationGuidelineRows.forEach((row) => {
      pushIfMatch({
        id: `duration-${row.id}`,
        title: row.infection,
        subtitle: "Duration of Treatment",
        icon: "clock",
        tone: palette.orange,
        target: "duration",
        sectionSearchText: row.infection,
        keywords: [
          row.infection,
          row.duration,
          row.remarks,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    antibiogramDetails.sheets.forEach((sheet) => {
      const sheetKey = antibiogramSheetKey(
        sheet.infection_type,
        sheet.location,
        sheet.acquisition,
      );
      const pathogenKeywords = antibiogramDetails.pathogenRows
        .filter((row) => row.sheet_key === sheetKey)
        .flatMap((row) => [
          row.pathogen_name,
          row.raw_sensitivity_text,
          Object.keys(row.sensitivities).join(" "),
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]);
      const therapyKeywords = antibiogramDetails.empiricTherapy
        .filter((row) => row.sheet_key === sheetKey)
        .map((row) => row.empiric_therapy)
        .join(" ");

      pushIfMatch({
        id: `antibiogram-${sheet.id}`,
        title: sheet.sheet_title,
        subtitle: "Local Antibiogram and Empirical Antibiotic Choice",
        icon: "activity",
        tone: palette.green,
        target: "antibiogram",
        sectionSearchText: sheet.infection_type,
        keywords: [
          sheet.infection_type,
          sheet.location,
          sheet.acquisition,
          sheet.surveillance,
          sheet.source_quote,
          sheet.source_section,
          sheet.source_span_section_heading,
          sheet.section_notes.join(" "),
          therapyKeywords,
          pathogenKeywords.join(" "),
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    stewardshipPearls.forEach((row) => {
      pushIfMatch({
        id: `stewardship-pearl-${row.id}`,
        title: row.pearl_text,
        subtitle: `Antimicrobial Stewardship Pearls · ${row.section_name}`,
        icon: "shield",
        tone: palette.blue,
        target: "guidelineSection",
        guidelineSection: "stewardshipPearls",
        sectionSearchText: row.pearl_text,
        keywords: [
          row.section_name,
          row.pearl_text,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    antimicrobialPearlPoints.forEach((row) => {
      pushIfMatch({
        id: `pearl-point-${row.id}`,
        title: row.pearl_text,
        subtitle: `Antimicrobial Pearl Points · ${row.section_name}`,
        icon: "check",
        tone: palette.green,
        target: "guidelineSection",
        guidelineSection: "pearlPoints",
        sectionSearchText: row.pearl_text,
        keywords: [
          row.section_name,
          row.pearl_text,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    synergyTestingRows.forEach((row) => {
      pushIfMatch({
        id: `synergy-${row.id}`,
        title: row.organism,
        subtitle: "Synergy Testing",
        icon: "layers",
        tone: palette.blue2,
        target: "guidelineSection",
        guidelineSection: "synergyTesting",
        keywords: [
          row.organism,
          row.total_tested,
          row.negative_for_synergy,
          row.positive_for_synergy,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    antifungalRows.forEach((row) => {
      pushIfMatch({
        id: `antifungal-${row.id}`,
        title: `${row.species} · ${row.drug}`,
        subtitle: `Antifungal Susceptibility · ${row.organism_group}`,
        icon: "fungus",
        tone: palette.orange,
        target: "guidelineSection",
        guidelineSection: "antifungalSusceptibility",
        keywords: [
          row.organism_group,
          row.species,
          row.drug,
          row.susceptibility_value,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    perioperativeGuidelines.recommendations.forEach((row) => {
      pushIfMatch({
        id: `perioperative-procedure-${row.id}`,
        title: row.procedure,
        subtitle: "Perioperative Procedure Recommendation",
        icon: "clipboard",
        tone: palette.blue,
        target: "guidelineSection",
        guidelineSection: "perioperative",
        keywords: [
          row.procedure,
          row.preferred_drug,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    perioperativeGuidelines.antibioticDosing.forEach((row) => {
      pushIfMatch({
        id: `perioperative-dose-${row.id}`,
        title: row.drug,
        subtitle: "Perioperative Antibiotic Dosing",
        icon: "pill",
        tone: palette.orange,
        target: "guidelineSection",
        guidelineSection: "perioperative",
        keywords: [
          row.drug,
          row.standard_dose,
          row.weight_based_dose,
          row.bolus_duration,
          row.infusion_duration,
          row.bolus_or_infusion_duration,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    perioperativeGuidelines.notes.forEach((row) => {
      pushIfMatch({
        id: `perioperative-note-${row.id}`,
        title: row.note_text,
        subtitle: `Perioperative Note · ${row.note_type}`,
        icon: "clipboard",
        tone: palette.green,
        target: "guidelineSection",
        guidelineSection: "perioperative",
        keywords: [
          row.note_type,
          row.note_text,
          row.source_quote,
          row.source_section,
          row.source_span_section_heading,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });

    return results.slice(0, 8);
  }, [
    antifungalRows,
    antimicrobialPearlPoints,
    antibiogramDetails,
    durationGuidelineRows,
    dynamicInfectionSites,
    icmrGuidelineRows,
    palette.blue,
    palette.blue2,
    palette.green,
    palette.orange,
    perioperativeGuidelines,
    searchQuery,
    sourceRecommendations,
    stewardshipPearls,
    synergyTestingRows,
  ]);

  const go = (next: Screen, mode: "push" | "replace" | "reset" = "push") => {
    setRouteStack((current) => {
      if (mode === "reset") {
        return [next];
      }

      if (mode === "replace") {
        return [...current.slice(0, -1), next];
      }

      if (current[current.length - 1] === next) {
        return current;
      }

      return [...current, next];
    });
  };

  const goTab = (tab: BottomTab) => {
    setDrawerOpen(false);
    setActiveTab(tab);
    go(tabRoutes[tab]);
  };

  const goHome = () => {
    setDrawerOpen(false);
    setActiveTab("Home");
    go("dashboard", "reset");
  };

  const goEditProfile = () => {
    setDrawerOpen(false);
    setActiveTab("Profile");
    setProfileNameInput(doctorProfile.name);
    setProfileEmailInput(doctorProfile.email);
    setProfileError("");
    setProfileSuccess("");
    go("editProfile");
  };

  const scenarioOptionsForSite = (site: InfectionSite) => {
    const rows = sourceRecommendations.filter((item) =>
      recommendationMatchesSite(item, site),
    );

    return {
      rows,
      settings: sourceFieldOptions(rows, "setting"),
      acquisitions: sourceFieldOptions(rows, "acquisition"),
      risks: sourceFieldOptions(rows, "risk"),
      isRiskTyped: isRiskTypedInfection(`${site.code} ${site.label}`),
    };
  };

  const firstScenarioScreenForSite = (site: InfectionSite): Screen => {
    const options = scenarioOptionsForSite(site);

    if (options.isRiskTyped) {
      return "setting";
    }

    return "guidelineSection";
  };

  const prepareScenarioForSite = (site: InfectionSite) => {
    const options = scenarioOptionsForSite(site);

    setProtocolScenarioResult(null);
    setRiskAnswers(defaultAntibiogramRiskAnswers);
    setRiskType(null);

    if (options.isRiskTyped) {
      setSetting("ICU");
      setAcquisition("Community-acquired");
      setSelectedSourceRisk("");
      return;
    }

    if (options.settings[0]) {
      setSetting(options.settings[0]);
    }

    if (options.acquisitions[0]) {
      setAcquisition(options.acquisitions[0]);
    }

    if (!options.isRiskTyped && options.risks[0]) {
      setSelectedSourceRisk(options.risks[0]);
    } else {
      setSelectedSourceRisk("");
    }
  };

  const nextScenarioScreen = (completed: "setting" | "acquisition" | "risk") => {
    if (completed === "setting" && selectedAcquisitionOptions.length > 1) {
      return "acquisition";
    }

    if (completed !== "risk" && selectedIsRiskTyped) {
      return "riskAssessment";
    }

    if (
      completed !== "risk" &&
      !selectedIsRiskTyped &&
      selectedRiskOptions.length > 1
    ) {
      return "riskSelection";
    }

    return "protocolResult";
  };

  const openSearchResult = (result: SearchResult) => {
    setSearchQuery("");

    if (result.target === "guidelineSection" && result.guidelineSection) {
      setSelectedGuidelineSection(result.guidelineSection);
      if (result.guidelineSection === "icmr") {
        setIcmrGuidelineSearch(result.sectionSearchText ?? "");
      }
      if (result.guidelineSection === "stewardshipPearls") {
        setStewardshipPearlSearch(result.sectionSearchText ?? "");
      }
      if (result.guidelineSection === "pearlPoints") {
        setAntimicrobialPearlPointSearch(result.sectionSearchText ?? "");
      }
      go("guidelineSection");
      return;
    }

    if (result.target === "duration") {
      setDurationGuidelineSearch(result.sectionSearchText ?? "");
      go("duration");
      return;
    }

    if (result.target === "antibiogram") {
      if (result.sectionSearchText) {
        const matchedInfection = antibiogramInfectionFilters.find(
          (infection) =>
            normalizeMatchText(infection) ===
            normalizeMatchText(result.sectionSearchText),
        );

        if (matchedInfection) {
          setAntibiogramInfection(matchedInfection);
        }
      }
      go("antibiogram");
      return;
    }

    if (!result.site) {
      return;
    }

    setSelectedSite(result.site);
    prepareScenarioForSite(result.site);

    if (result.riskType) {
      setRiskType(result.riskType);
    }

    if (result.detailTab) {
      setProtocolDetailTab(result.detailTab);
    }

    if (result.target === "setting" || result.target === "riskSelection") {
      go(firstScenarioScreenForSite(result.site));
      return;
    }

    go(result.target);
  };

  const openInfectionSite = (site: InfectionSite) => {
    setSelectedSite(site);
    setSearchQuery("");
    prepareScenarioForSite(site);
    if (!isRiskTypedInfection(`${site.code} ${site.label}`)) {
      setSelectedGuidelineSection("icmr");
      setIcmrGuidelineSearch(site.label);
    }
    go(firstScenarioScreenForSite(site));
  };

  const loadApprovedSourceRecommendations = async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    setSourceRecommendationLoading(true);
    setSourceRecommendationError("");

    const { data, error } = await supabase
      .from("approved_clinical_recommendations_with_source")
      .select("*")
      .order("syndrome", { ascending: true });

    setSourceRecommendationLoading(false);

    if (error) {
      setSourceRecommendations([]);
      setSourceRecommendationError(
        "No approved recommendation available. Refer institutional guideline / ID specialist.",
      );
      return;
    }

    const approvedRows = (data ?? []) as SourceRecommendation[];

    setSourceRecommendations(approvedRows);
    setSourceRecommendationError("");
  };

  const loadApprovedCurrentRiskCriteria = async () => {
    if (!isSupabaseConfigured) {
      setCurrentRiskCriteriaRows([]);
      setCurrentRiskCriteriaError("Supabase is not configured.");
      return;
    }
    setCurrentRiskCriteriaLoading(true);
    setCurrentRiskCriteriaError("");
    const result = await loadCurrentPatientRiskCriteria();
    setCurrentRiskCriteriaLoading(false);
    if (result.status === "found") {
      setCurrentRiskCriteriaRows(result.data);
      return;
    }
    setCurrentRiskCriteriaRows([]);
    setCurrentRiskCriteriaError(
      result.status === "empty"
        ? "No active, non-expired patient risk criteria are available."
        : result.message,
    );
  };

  const loadApprovedIcmrGuidelines = async () => {
    if (!isSupabaseConfigured) {
      setIcmrGuidelineRows([]);
      setIcmrGuidelineError("");
      return;
    }

    setIcmrGuidelineLoading(true);
    setIcmrGuidelineError("");

    const rows = await loadIcmrGuidelines();

    setIcmrGuidelineRows(rows);
    setIcmrGuidelineLoading(false);
    setIcmrGuidelineError(
      rows.length === 0
        ? "No approved ICMR guideline rows available. Refer institutional guideline / ID specialist."
        : "",
    );
  };

  const loadApprovedDurationGuidelines = async () => {
    if (!isSupabaseConfigured) {
      setDurationGuidelineRows([]);
      setDurationGuidelineError("");
      return;
    }

    setDurationGuidelineLoading(true);
    setDurationGuidelineError("");

    const rows = await loadDurationGuidelines();

    setDurationGuidelineRows(rows);
    setDurationGuidelineLoading(false);
    setDurationGuidelineError(
      rows.length === 0
        ? "No approved duration guideline rows available. Refer institutional guideline / ID specialist."
        : "",
    );
  };

  const loadApprovedAntibiograms = async () => {
    if (!isSupabaseConfigured) {
      setAntibiogramDetails({
        sheets: [],
        pathogenRows: [],
        empiricTherapy: [],
        riskCriteria: [],
        footnotes: [],
      });
      setAntibiogramError("");
      return;
    }

    setAntibiogramLoading(true);
    setAntibiogramError("");

    const details = await loadAntibiogramDetails();

    setAntibiogramDetails(details);
    setAntibiogramLoading(false);
    setAntibiogramError(
      details.sheets.length === 0
        ? "No approved antibiogram rows available. Refer institutional guideline / ID specialist."
        : "",
    );
  };

  const loadApprovedPearls = async () => {
    if (!isSupabaseConfigured) {
      setStewardshipPearls([]);
      setAntimicrobialPearlPoints([]);
      setStewardshipPearlsError("");
      setAntimicrobialPearlPointsError("");
      return;
    }

    setStewardshipPearlsLoading(true);
    setAntimicrobialPearlPointsLoading(true);
    setStewardshipPearlsError("");
    setAntimicrobialPearlPointsError("");

    const [stewardshipRows, pearlPointRows] = await Promise.all([
      loadStewardshipPearls(),
      loadAntimicrobialPearlPoints(),
    ]);

    setStewardshipPearls(stewardshipRows);
    setAntimicrobialPearlPoints(pearlPointRows);
    setStewardshipPearlsLoading(false);
    setAntimicrobialPearlPointsLoading(false);
    setStewardshipPearlsError(
      stewardshipRows.length === 0
        ? "No approved antimicrobial stewardship pearls available. Refer institutional guideline / ID specialist."
        : "",
    );
    setAntimicrobialPearlPointsError(
      pearlPointRows.length === 0
        ? "No approved antimicrobial pearl points available. Refer institutional guideline / ID specialist."
        : "",
    );
  };

  const loadApprovedSpecialGuidelineSections = async () => {
    if (!isSupabaseConfigured) {
      setSynergyTestingRows([]);
      setAntifungalRows([]);
      setPerioperativeGuidelines({
        recommendations: [],
        antibioticDosing: [],
        notes: [],
      });
      setSynergyTestingError("");
      setAntifungalError("");
      setPerioperativeError("");
      return;
    }

    setSynergyTestingLoading(true);
    setAntifungalLoading(true);
    setPerioperativeLoading(true);
    setSynergyTestingError("");
    setAntifungalError("");
    setPerioperativeError("");

    const [
      synergyRows,
      approvedAntifungalRows,
      approvedPerioperativeGuidelines,
      approvedSynergyAntifungalNotes,
      approvedGuideMetadata,
    ] = await Promise.all([
      loadSynergyTestingRows(),
      loadAntifungalSusceptibilityRows(),
      loadPerioperativeGuidelines(),
      loadSynergyAntifungalNotes(),
      loadGuideMetadata(),
    ]);

    setSynergyTestingRows(synergyRows);
    setAntifungalRows(approvedAntifungalRows);
    setPerioperativeGuidelines(approvedPerioperativeGuidelines);
    setSynergyAntifungalNotes(approvedSynergyAntifungalNotes);
    setGuideMetadata(approvedGuideMetadata);
    setSynergyTestingLoading(false);
    setAntifungalLoading(false);
    setPerioperativeLoading(false);
    setSynergyTestingError(
      synergyRows.length === 0
        ? "No approved synergy testing rows available. Refer institutional guideline / ID specialist."
        : "",
    );
    setAntifungalError(
      approvedAntifungalRows.length === 0
        ? "No approved antifungal susceptibility rows available. Refer institutional guideline / ID specialist."
        : "",
    );
    setPerioperativeError(
      approvedPerioperativeGuidelines.recommendations.length === 0 &&
        approvedPerioperativeGuidelines.antibioticDosing.length === 0 &&
        approvedPerioperativeGuidelines.notes.length === 0
        ? "No approved perioperative antimicrobial guideline rows available. Refer institutional guideline / ID specialist."
        : "",
    );
  };

  const selectedSourceRecommendations = useMemo<SourceRecommendation[]>(() => {
    if (selectedIsRiskTyped) {
      if (
        protocolScenarioResult?.status !== "found" ||
        !protocolScenarioKey ||
        protocolScenarioResult.row.infection_type !== protocolScenarioKey.infectionType ||
        protocolScenarioResult.row.location !== protocolScenarioKey.location ||
        protocolScenarioResult.row.acquisition !== protocolScenarioKey.acquisition ||
        protocolScenarioResult.row.risk_type !== protocolScenarioKey.riskType
      ) {
        return [];
      }
      const row = protocolScenarioResult.row;
      return [
        {
          id: row.therapy_id ?? row.sheet_key,
          syndrome: row.sheet_title,
          infection_site: row.infection_type,
          setting: row.location,
          acquisition: row.acquisition,
          risk_type: row.risk_type,
          severity_category: null,
          organism: null,
          pathogen: null,
          drug: row.empiric_therapy,
          dose: null,
          route: null,
          frequency: null,
          duration: null,
          renal_adjustment: null,
          hepatic_adjustment: null,
          pregnancy_lactation_caution: null,
          allergy_warning: null,
          contraindication: null,
          stewardship_note: row.section_notes.join("\n") || null,
          id_consult_trigger: null,
          clinical_condition: row.sheet_title,
          common_pathogens: null,
          empirical_ama: row.empiric_therapy,
          alternate_ama: null,
          comments: null,
          ama_role: "empirical" as const,
          source_image: null,
          source_page: null,
          review_status: "approved" as const,
          source_filename: row.source_filename,
          page_number: null,
          section_heading: row.sheet_title,
          source_quote: row.source_quote,
          extracted_at: "",
        },
      ];
    }
    return [];
  }, [
    protocolScenarioResult,
    protocolScenarioKey,
    selectedIsRiskTyped,
  ]);

  const failClosedMessage =
    "No approved recommendation available. Refer institutional guideline / ID specialist.";
  const protocolFlowLoading = selectedIsRiskTyped
    ? protocolScenarioLoading
    : sourceRecommendationLoading;
  const protocolFlowMessage = selectedIsRiskTyped
    ? protocolScenarioResult
      ? protocolScenarioMessage(protocolScenarioResult)
      : protocolScenarioKey
        ? "Loading the exact approved scenario..."
        : "Complete all scenario and risk fields before viewing a protocol."
    : sourceRecommendationError || failClosedMessage;
  const canUseProtocolActions = selectedIsRiskTyped
    ? protocolScenarioResult?.status === "found"
    : selectedSourceRecommendations.length > 0;
  const meaningfulWarningRecommendations = selectedSourceRecommendations.filter(
    (item) =>
      hasMeaningfulText(item.renal_adjustment) ||
      hasMeaningfulText(item.hepatic_adjustment) ||
      hasMeaningfulText(item.pregnancy_lactation_caution) ||
      hasMeaningfulText(item.allergy_warning) ||
      hasMeaningfulText(item.contraindication) ||
      hasMeaningfulText(item.stewardship_note),
  );
  const meaningfulConsultRecommendations = selectedSourceRecommendations.filter(
    (item) => hasMeaningfulText(item.id_consult_trigger),
  );
  const recommendedTreatmentRecommendations = selectedSourceRecommendations.slice(
    0,
    Math.min(3, selectedSourceRecommendations.length),
  );
  const alternativeTreatmentRecommendations = selectedSourceRecommendations.slice(
    recommendedTreatmentRecommendations.length,
    6,
  );
  const approvedCleanRecommendations = useMemo(
    () => cleanRecommendationRows(sourceRecommendations),
    [sourceRecommendations],
  );
  const empiricGuidelineSummaries = useMemo(() => {
    const summaries = new Map<
      string,
      { title: string; rows: SourceRecommendation[] }
    >();

    approvedCleanRecommendations.forEach((item) => {
      const category =
        canonicalInfectionCategory(item.infection_site) ??
        canonicalInfectionCategory(item.syndrome) ??
        canonicalInfectionCategory(item.section_heading);
      const title =
        sites.find((site) => site.code === category)?.label ||
        item.infection_site?.trim() ||
        item.syndrome?.trim();

      if (!title) {
        return;
      }

      const current = summaries.get(title) ?? { title, rows: [] };
      current.rows.push(item);
      summaries.set(title, current);
    });

    return Array.from(summaries.values()).slice(0, 8);
  }, [approvedCleanRecommendations]);
  const renalGuidelineRecommendations = approvedCleanRecommendations.filter(
    (item) => hasMeaningfulText(item.renal_adjustment),
  );
  const carbapenemGuidelineRecommendations = approvedCleanRecommendations.filter(
    (item) =>
      carbapenemPattern.test(item.drug ?? "") ||
      carbapenemPattern.test(item.stewardship_note ?? ""),
  );
  const approvedAmaTableRecommendations = approvedCleanRecommendations.filter(
    (item) =>
      hasMeaningfulText(item.clinical_condition) &&
      hasMeaningfulText(item.common_pathogens) &&
      (item.ama_role === "empirical" || item.ama_role === "alternate") &&
      (hasMeaningfulText(item.empirical_ama) ||
        hasMeaningfulText(item.alternate_ama)),
  );
  const filteredIcmrGuidelineRows = useMemo(() => {
    const query = icmrGuidelineSearch.trim().toLowerCase();

    if (!query) {
      return icmrGuidelineRows;
    }

    return icmrGuidelineRows.filter((row) =>
      [row.clinical_condition, row.common_pathogens]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [icmrGuidelineRows, icmrGuidelineSearch]);
  const filteredDurationGuidelineRows = useMemo(() => {
    const query = durationGuidelineSearch.trim().toLowerCase();

    if (!query) {
      return durationGuidelineRows;
    }

    return durationGuidelineRows.filter((row) =>
      row.infection.toLowerCase().includes(query),
    );
  }, [durationGuidelineRows, durationGuidelineSearch]);
  const filteredStewardshipPearls = useMemo(
    () => filterPearlRows(stewardshipPearls, stewardshipPearlSearch),
    [stewardshipPearls, stewardshipPearlSearch],
  );
  const filteredAntimicrobialPearlPoints = useMemo(
    () =>
      filterPearlRows(
        antimicrobialPearlPoints,
        antimicrobialPearlPointSearch,
      ),
    [antimicrobialPearlPoints, antimicrobialPearlPointSearch],
  );
  const groupedStewardshipPearls = useMemo(
    () => groupPearlRowsBySection(filteredStewardshipPearls),
    [filteredStewardshipPearls],
  );
  const groupedAntimicrobialPearlPoints = useMemo(
    () => groupPearlRowsBySection(filteredAntimicrobialPearlPoints),
    [filteredAntimicrobialPearlPoints],
  );
  const groupedAntifungalRows = useMemo(() => {
    const groups = new Map<string, AntifungalSusceptibilityRow[]>();

    antifungalRows.forEach((row) => {
      const currentRows = groups.get(row.organism_group) ?? [];
      currentRows.push(row);
      groups.set(row.organism_group, currentRows);
    });

    return Array.from(groups.entries()).map(([organismGroup, rows]) => ({
      organismGroup,
      rows,
    }));
  }, [antifungalRows]);
  const selectedAntibiogramSheet = useMemo(
    () =>
      antibiogramDetails.sheets.find(
        (sheet) =>
          sheet.infection_type === antibiogramInfection &&
          sheet.location === antibiogramLocation &&
          sheet.acquisition === antibiogramAcquisition,
      ) ?? null,
    [
      antibiogramAcquisition,
      antibiogramDetails.sheets,
      antibiogramInfection,
      antibiogramLocation,
    ],
  );
  const selectedAntibiogramSheetKey = selectedAntibiogramSheet
    ? antibiogramSheetKey(
        selectedAntibiogramSheet.infection_type,
        selectedAntibiogramSheet.location,
        selectedAntibiogramSheet.acquisition,
      )
    : "";
  const selectedAntibiogramPathogens = useMemo(
    () =>
      antibiogramDetails.pathogenRows.filter(
        (row) =>
          row.sheet_key === selectedAntibiogramSheetKey &&
          row.risk_type === antibiogramRiskType,
      ),
    [
      antibiogramDetails.pathogenRows,
      antibiogramRiskType,
      selectedAntibiogramSheetKey,
    ],
  );
  const selectedAntibiogramRiskCriteria = useMemo(
    () =>
      antibiogramDetails.riskCriteria.filter(
        (row) => row.sheet_key === selectedAntibiogramSheetKey,
      ),
    [antibiogramDetails.riskCriteria, selectedAntibiogramSheetKey],
  );
  const selectedAntibiogramTherapy = useMemo(
    () =>
      antibiogramDetails.empiricTherapy.find(
        (row) =>
          row.sheet_key === selectedAntibiogramSheetKey &&
          row.risk_type === antibiogramRiskType,
      ) ?? null,
    [
      antibiogramDetails.empiricTherapy,
      antibiogramRiskType,
      selectedAntibiogramSheetKey,
    ],
  );
  const selectedAntibiogramFootnotes = useMemo(
    () =>
      antibiogramDetails.footnotes.filter(
        (row) =>
          row.sheet_key === selectedAntibiogramSheetKey &&
          (!row.risk_type || row.risk_type === antibiogramRiskType),
      ),
    [
      antibiogramDetails.footnotes,
      antibiogramRiskType,
      selectedAntibiogramSheetKey,
    ],
  );
  const hasStewardshipGuidance =
    meaningfulWarningRecommendations.length > 0 ||
    meaningfulConsultRecommendations.length > 0;
  const isHighRiskCase =
    riskType === "Type 3" || /high/i.test(selectedRiskDisplay);
  const shouldShowStewardshipAlert = hasStewardshipGuidance || isHighRiskCase;
  const stewardshipAlertReason = isHighRiskCase
    ? "High-risk case: ID specialist review recommended."
    : "Approved stewardship guidance is documented for this protocol.";
  const stewardshipAlertAction =
    meaningfulConsultRecommendations[0]?.id_consult_trigger?.trim() ||
    meaningfulWarningRecommendations[0]?.stewardship_note?.trim() ||
    "Review antimicrobial choice, cultures, source control, and escalation or de-escalation with the appropriate senior clinician.";
  const currentCaseSnapshot = (): SavedClinicalCase => ({
    id: `${Date.now()}`,
    infectionSite: selectedSite.label,
    setting,
    acquisition,
    riskLevel: selectedRiskDisplay,
    riskType,
    recommendations: selectedSourceRecommendations,
    warningRecommendations: meaningfulWarningRecommendations,
    consultRecommendations: meaningfulConsultRecommendations,
    savedAt: new Date().toISOString(),
    doctorName: doctorProfile.name,
    doctorEmail: doctorProfile.email,
  });
  const activeReportCase = selectedCase ?? currentCaseSnapshot();
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const recommendationLines = (item: SourceRecommendation) =>
    [
      item.drug?.trim(),
      item.dose?.trim() ? `Dose: ${item.dose.trim()}` : "",
      item.route?.trim() ? `Route: ${item.route.trim()}` : "",
      item.frequency?.trim() ? `Frequency: ${item.frequency.trim()}` : "",
      item.duration?.trim() ? `Duration: ${item.duration.trim()}` : "",
    ].filter(Boolean);
  const reportStewardshipLines = (reportCase = activeReportCase) =>
    [
      ...reportCase.warningRecommendations.flatMap((item) =>
        [
          item.drug?.trim() ? `${item.drug.trim()}:` : "",
          item.stewardship_note?.trim(),
          item.renal_adjustment?.trim(),
          item.allergy_warning?.trim(),
          item.contraindication?.trim(),
        ].filter((line): line is string => Boolean(line && hasMeaningfulText(line))),
      ),
      ...reportCase.consultRecommendations
        .map((item) => item.id_consult_trigger?.trim())
        .filter((line): line is string => Boolean(line && hasMeaningfulText(line))),
      reportCase.riskType === "Type 3"
        ? "High-risk case: ID specialist review recommended."
        : "",
    ].filter(Boolean);
  const buildReportText = (reportCase = activeReportCase) => {
    const protocolLines = reportCase.recommendations
      .flatMap((item, index) => [
        `${index + 1}. ${item.drug?.trim()}`,
        ...recommendationLines(item).slice(1).map((line) => `   ${line}`),
      ])
      .join("\n");
    const stewardshipLines = reportStewardshipLines(reportCase);

    return [
      "Hinduja Antibiotic Guide Protocol Report",
      "",
      `Doctor: ${reportCase.doctorName || "Doctor not specified"}`,
      `Email: ${reportCase.doctorEmail}`,
      `Generated: ${formatDateTime(reportCase.savedAt)}`,
      "",
      "Case Summary",
      `Infection Site: ${reportCase.infectionSite}`,
      `Setting: ${reportCase.setting}`,
      `Acquisition: ${reportCase.acquisition}`,
      `Risk Level: ${reportCase.riskLevel}`,
      "",
      "Recommended Treatment Protocol",
      protocolLines || failClosedMessage,
      ...(stewardshipLines.length > 0
        ? ["", "Stewardship Guidance", ...stewardshipLines]
        : []),
      "",
      "Disclaimer",
      "For authorized clinical use. Verify with institutional protocol and clinical judgment.",
    ].join("\n");
  };
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const buildReportHtml = (text: string, includePrintButton: boolean) => `
    <!doctype html>
    <html>
      <head>
        <title>Hinduja Antibiotic Guide Protocol Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0B2850; margin: 40px; line-height: 1.45; }
          button { background: #0057B8; border: 0; color: #fff; border-radius: 6px; padding: 10px 14px; font-weight: 700; margin-bottom: 20px; }
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12px; }
          @media print { button { display: none; } body { margin: 24px; } }
        </style>
      </head>
      <body>
        ${includePrintButton ? '<button onclick="window.print()">Export PDF</button>' : ""}
        <pre>${escapeHtml(text)}</pre>
      </body>
    </html>
  `;
  const saveCurrentCase = () => {
    if (!canUseProtocolActions) {
      setActionMessage(protocolFlowMessage || failClosedMessage);
      return;
    }

    const nextCase = currentCaseSnapshot();
    setSavedCases((cases) => [nextCase, ...cases]);
    setSelectedCase(nextCase);
    setActionMessage("Case saved to My Cases.");
    go("savedCases");
  };
  const openCaseReport = (reportCase: SavedClinicalCase) => {
    setSelectedCase(reportCase);
    go("caseReport");
  };
  const openWhatsAppShare = async () => {
    const text = buildReportText();
    const encodedText = encodeURIComponent(text);
    const url =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodedText}`
        : `whatsapp://send?text=${encodedText}`;
    const canOpen = Platform.OS === "web" || (await Linking.canOpenURL(url));

    if (!canOpen) {
      setActionMessage("WhatsApp is not available on this device.");
      return;
    }

    await Linking.openURL(url);
  };
  const openEmailShare = async () => {
    const subject = encodeURIComponent(
      "Hinduja Antibiotic Guide Protocol Report",
    );
    const body = encodeURIComponent(buildReportText());
    await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  };
  const openNativeShare = async (unsupportedMessage?: string) => {
    const text = buildReportText();

    if (Platform.OS === "web") {
      const nav = globalThis.navigator as
        | (Navigator & {
            share?: (data: { title: string; text: string }) => Promise<void>;
            clipboard?: { writeText: (value: string) => Promise<void> };
          })
        | undefined;

      if (nav?.share) {
        await nav.share({
          title: "Hinduja Antibiotic Guide Protocol Report",
          text,
        });
        return;
      }

      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        setActionMessage("Report text copied to clipboard.");
        return;
      }

      setActionMessage(unsupportedMessage ?? "Sharing is not available on this device.");
      return;
    }

    await Share.share({
      title: "Hinduja Antibiotic Guide Protocol Report",
      message: text,
    });
  };
  const shareBluetooth = async () => {
    if (Platform.OS === "web") {
      setActionMessage("Bluetooth sharing is not available on this device.");
      return;
    }

    await openNativeShare("Bluetooth sharing is not available on this device.");
  };
  const exportReportPdf = async () => {
    const text = buildReportText();
    const html = renderProfessionalPDFReport(
      activeReportCase,
      Platform.OS === "web",
    );

    if (Platform.OS === "web") {
      const reportWindow = globalThis.window?.open("", "_blank");

      if (!reportWindow) {
        await openNativeShare("PDF export is not available on this device.");
        return;
      }

      reportWindow.document.write(html);
      reportWindow.document.close();
      setActionMessage("PDF report opened. Use the browser print dialog to save as PDF.");
      return;
    }

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canSharePdf = await Sharing.isAvailableAsync();

      if (canSharePdf) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Hinduja Antibiotic Guide Protocol Report",
          UTI: "com.adobe.pdf",
        });
        setActionMessage("PDF report generated.");
        return;
      }

      await openNativeShare("PDF sharing is not available on this device.");
      setActionMessage("PDF generated, but file sharing is not available on this device.");
    } catch {
      await openNativeShare("PDF export is not available on this device.");
      setActionMessage("PDF export is not available on this device. Report text can be shared instead.");
    }
  };
  const saveDoctorDetails = async () => {
    const fullName = doctorNameInput.trim();
    const email = doctorEmailInput.trim();
    const employeeId = doctorEmployeeIdInput.trim();
    const contactNumber = doctorContactInput.trim();

    if (!fullName || !employeeId || !contactNumber) {
      setDoctorDetailsError("Doctor Name, Employee ID, and Contact Number are required.");
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDoctorDetailsError("Enter a valid email address or leave it blank.");
      return;
    }

    setDoctorDetailsLoading(true);
    setDoctorDetailsError("");

    const nextProfile: DoctorProfile = {
      name: fullName,
      email,
      employeeId,
      contactNumber,
    };

    try {
      await AsyncStorage.setItem(
        DOCTOR_PROFILE_STORAGE_KEY,
        JSON.stringify(nextProfile),
      );
      applyDoctorProfile(nextProfile);
    } catch {
      setDoctorDetailsError("Unable to save doctor details on this device.");
      setDoctorDetailsLoading(false);
      return;
    }

    setDoctorDetailsLoading(false);
    setActiveTab("Home");
    go("dashboard", "reset");
  };

  const back = () => {
    setRouteStack((current) =>
      current.length > 1 ? current.slice(0, -1) : current,
    );
  };

  const updateProfile = async () => {
    const trimmedName = profileNameInput.trim();
    const trimmedEmail = profileEmailInput.trim();

    if (!trimmedName) {
      setProfileError("Name is required.");
      setProfileSuccess("");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError("Enter a valid email address or leave it blank.");
      setProfileSuccess("");
      return;
    }

    setProfileLoading(true);
    setProfileError("");
    setProfileSuccess("");

    const nextProfile: DoctorProfile = {
      ...doctorProfile,
      name: trimmedName,
      email: trimmedEmail,
    };

    try {
      await AsyncStorage.setItem(
        DOCTOR_PROFILE_STORAGE_KEY,
        JSON.stringify(nextProfile),
      );
      applyDoctorProfile(nextProfile);
      setProfileSuccess("Profile has been updated on this device.");
    } catch {
      setProfileError("Unable to update the profile on this device.");
    } finally {
      setProfileLoading(false);
    }
  };

  const classify = () => {
    if (!activeRiskCriteria) {
      setActionMessage(
        currentRiskCriteriaError ||
          "No active, non-expired patient risk criteria are available. Manual review is required.",
      );
      return;
    }
    const result = classifyAntibiogramRisk(riskAnswers, activeRiskCriteria);

    if (!result.riskType) {
      setActionMessage("Risk criteria are incomplete. Manual review is required.");
      return;
    }

    setRiskType(result.riskType);
    go("classification");
  };

  const appShell = (children: ReactNode, title?: string, progress = true) => {
    const canGoBack = routeStack.length > 1;

    return (
      <View style={styles.appScreen}>
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={canGoBack ? back : goHome}
            style={styles.topIcon}
            accessibilityRole="button"
            accessibilityLabel={canGoBack ? "Go back" : "Go home"}
          >
            <AppIcon
              name={canGoBack ? "chevron-left" : "home"}
              size={25}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{title}</Text>
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() => setDrawerOpen(true)}
            style={styles.topIcon}
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
          >
            <AppIcon name="menu" size={23} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {progress && <StepDots />}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.screenBody}
        >
          {children}
        </ScrollView>
        <SideDrawer />
      </View>
    );
  };

  function StepDots() {
    return (
      <View style={styles.progress}>
        {[0, 1, 2, 3, 4].map((dot, index) => (
          <View
            key={dot}
            style={[styles.progressLine, index < 4 && styles.progressLineFill]}
          />
        ))}
      </View>
    );
  }

  const PrimaryButton = ({
    label,
    onPress,
    red = false,
    loading = false,
    disabled = false,
  }: {
    label: string;
    onPress: () => void;
    red?: boolean;
    loading?: boolean;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={loading || disabled}
      onPress={onPress}
      style={[
        styles.primaryButton,
        red && styles.redButton,
        (loading || disabled) && styles.disabledButton,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );

  const DoctorDetails = () =>
    appShell(
      <View>
        <View style={styles.editProfileCard}>
          <Text style={styles.editProfileTitle}>Doctor Details</Text>
          <Text style={styles.infoCardBody}>
            Complete this once to personalize clinical reports and profile access.
          </Text>
          {doctorDetailsError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{doctorDetailsError}</Text>
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>Doctor Name *</Text>
          <View style={styles.inputWrap}>
            <AppIcon name="user" size={18} color="#5C6F86" style={styles.inputInlineIcon} />
            <TextInput
              value={doctorNameInput}
              onChangeText={(value) => {
                setDoctorNameInput(value);
                setDoctorDetailsError("");
              }}
              placeholder="Enter doctor name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              style={[styles.textInput, webTextInputReset]}
            />
          </View>
          <Text style={styles.fieldLabel}>Work Email (optional)</Text>
          <View style={styles.inputWrap}>
            <AppIcon name="mail" size={18} color="#5C6F86" style={styles.inputInlineIcon} />
            <TextInput
              value={doctorEmailInput}
              onChangeText={(value) => {
                setDoctorEmailInput(value);
                setDoctorDetailsError("");
              }}
              placeholder="Enter work email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={[styles.textInput, webTextInputReset]}
            />
          </View>
          <Text style={styles.fieldLabel}>Employee ID *</Text>
          <View style={styles.inputWrap}>
            <AppIcon name="shield" size={18} color="#5C6F86" style={styles.inputInlineIcon} />
            <TextInput
              value={doctorEmployeeIdInput}
              onChangeText={(value) => {
                setDoctorEmployeeIdInput(value);
                setDoctorDetailsError("");
              }}
              placeholder="Enter employee ID"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.textInput, webTextInputReset]}
            />
          </View>
          <Text style={styles.fieldLabel}>Contact Number *</Text>
          <View style={styles.inputWrap}>
            <AppIcon name="clinician" size={18} color="#5C6F86" style={styles.inputInlineIcon} />
            <TextInput
              value={doctorContactInput}
              onChangeText={(value) => {
                setDoctorContactInput(value);
                setDoctorDetailsError("");
              }}
              placeholder="Enter contact number"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="phone-pad"
              style={[styles.textInput, webTextInputReset]}
            />
          </View>
          <PrimaryButton
            label="Continue to Home"
            onPress={() => {
              void saveDoctorDetails();
            }}
            loading={doctorDetailsLoading}
          />
        </View>
      </View>,
      "Doctor Details",
      false,
    );

  const drawerMenuItems: DrawerMenuItem[] = [
    { label: "Home", icon: "home", action: goHome },
    { label: "Guidelines", icon: "book", action: () => goTab("Guidelines") },
    { label: "Duration", icon: "clock", action: () => goTab("Duration") },
    { label: "Alerts", icon: "alert", action: () => goTab("Alerts") },
    { label: "Profile", icon: "user", action: () => goTab("Profile") },
    { label: "Edit Profile", icon: "edit", action: goEditProfile },
  ];

  const AppHeader = () => (
    <View style={styles.dashboardHeader}>
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={() => setDrawerOpen(true)}
        style={styles.headerButton}
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
      >
        <AppIcon name="menu" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <View style={styles.headerTextBlock}>
        <Text style={styles.headerTitle}>Hinduja Antibiotic Guide</Text>
        <Text style={styles.headerDoctor}>
          {doctorProfile.name || doctorProfile.email || "Doctor profile"}
        </Text>
      </View>
    </View>
  );

  const SideDrawer = () =>
    drawerOpen ? (
      <View style={styles.drawerLayer} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}
          style={styles.drawerBackdrop}
          accessibilityRole="button"
          accessibilityLabel="Close navigation menu"
        />
        <View style={styles.drawerPanel}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerBadge}>
              <Text style={styles.drawerBadgeText}>
                {initialsForName(doctorProfile.name, doctorProfile.email)}
              </Text>
            </View>
            <View style={styles.drawerIdentity}>
              <Text style={styles.drawerTitle}>Clinical Menu</Text>
              <Text style={styles.drawerName}>
                {doctorProfile.name || "Doctor profile"}
              </Text>
              <Text style={styles.drawerEmail}>
                {doctorProfile.email || "Email not provided"}
              </Text>
            </View>
          </View>
          <View style={styles.drawerItems}>
            {drawerMenuItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.86}
                onPress={item.action}
                style={[
                  styles.drawerItem,
                  item.danger && styles.drawerItemDanger,
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <AppIcon
                  name={item.icon}
                  size={19}
                  color={item.danger ? palette.red : palette.blue}
                />
                <Text
                  style={[
                    styles.drawerItemText,
                    item.danger && styles.drawerItemTextDanger,
                  ]}
                >
                  {item.label}
                </Text>
                <AppIcon
                  name="chevron-right"
                  size={18}
                  color={item.danger ? palette.red : palette.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.drawerFooter}>
            <Text style={styles.drawerFooterText}>
              Approved recommendations only. Clinical judgment required.
            </Text>
          </View>
        </View>
      </View>
    ) : null;

  const Dashboard = () => (
    <View style={styles.dashboardScreen}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.dashboardBody}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBox}>
          <AppIcon name="search" size={18} color="#5C6F86" style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search infection or guideline..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, webTextInputReset]}
          />
        </View>
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  activeOpacity={0.86}
                  style={styles.searchResultCard}
                  onPress={() => openSearchResult(result)}
                >
                  <AppIcon
                    name={result.icon}
                    size={24}
                    color={result.tone ?? result.site?.tone ?? palette.blue}
                    style={styles.searchResultIcon}
                  />
                  <View style={styles.searchResultTextBlock}>
                    <Text style={styles.searchResultTitle}>{result.title}</Text>
                    <Text style={styles.searchResultSubtitle}>
                      {result.subtitle}
                    </Text>
                  </View>
                  <AppIcon name="chevron-right" size={21} color={palette.muted} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.searchEmpty}>
                <Text style={styles.searchEmptyText}>
                  No matching infections, guidelines, protocols, or antibiotics
                  found.
                </Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.sectionLabel}>Select Infection Site</Text>
        {sourceRecommendationLoading ? (
          <View style={styles.infoCard}>
            <ActivityIndicator color={palette.blue} />
            <Text style={styles.infoCardBody}>
              Loading approved guide infections...
            </Text>
          </View>
        ) : null}
        {groupedInfectionSites.map((group) => (
          <View key={group.title}>
            <Text style={styles.groupLabel}>{group.title}</Text>
            <View style={styles.cardGrid}>
              {group.rows.map((site) => (
                <TouchableOpacity
                  key={`${site.code}-${site.label}`}
                  activeOpacity={0.86}
                  onPress={() => openInfectionSite(site)}
                  style={[
                    styles.siteCard,
                    site.code === "FN" && styles.siteCardWide,
                  ]}
                >
                  <View
                    style={[
                      styles.siteIconBadge,
                      { backgroundColor: `${site.tone}18` },
                    ]}
                  >
                    <AppIcon
                      name={site.icon}
                      size={
                        canonicalInfectionCategory(`${site.code} ${site.label}`)
                          ? 48
                          : 42
                      }
                      color={site.tone}
                    />
                  </View>
                  <Text style={styles.siteCardText}>{site.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <BottomTabs />
      <SideDrawer />
    </View>
  );

  const BottomTabs = () => (
    <View style={styles.bottomTabs}>
      {bottomTabs.map((tab) => {
        const isActive = activeTab === tab;

        return (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab} tab`}
            onPress={() => goTab(tab)}
            style={styles.bottomTab}
          >
            <View
              style={[
                styles.bottomTabPill,
                isActive && styles.bottomTabPillActive,
              ]}
            >
              <AppIcon
                name={bottomTabIcons[tab]}
                size={26}
                color={isActive ? palette.blue : palette.muted}
              />
              <Text
                style={[
                  styles.bottomText,
                  isActive && styles.bottomTextActive,
                ]}
              >
                {tab}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const TabPage = (title: string, children: ReactNode) => (
    <View style={styles.dashboardScreen}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.dashboardBody}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.tabPageTitle}>{title}</Text>
        {children}
      </ScrollView>
      <BottomTabs />
      <SideDrawer />
    </View>
  );

  const Guidelines = () =>
    TabPage(
      "Guidelines",
      <View>
        {guidelineSections.map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.86}
            style={styles.listCard}
            onPress={() => {
              setSelectedGuidelineSection(item.key);
              go("guidelineSection");
            }}
          >
            <View style={styles.guidelineIconBadge}>
              <AppIcon name={item.icon} size={28} color={palette.blue} />
            </View>
            <View style={styles.listTextBlock}>
              <Text style={styles.listText}>{item.title}</Text>
              <Text style={styles.listSubText}>{item.subtitle}</Text>
            </View>
            <AppIcon name="chevron-right" size={22} color={palette.muted} />
          </TouchableOpacity>
        ))}
      </View>,
    );

  const GuidelineSection = () => {
    const section = guidelineSections.find(
      (item) => item.key === selectedGuidelineSection,
    );

    return appShell(
      <View>
        <View style={styles.guidelineHero}>
          <View style={styles.guidelineIconBadgeLarge}>
            <AppIcon name={section?.icon ?? "book"} size={34} color={palette.blue} />
          </View>
          <View style={styles.shareTextBlock}>
            <Text style={styles.detailsTitle}>{section?.title}</Text>
            <Text style={styles.infoCardBody}>{section?.subtitle}</Text>
          </View>
        </View>
        {selectedGuidelineSection === "icmr" ? (
          <View>
            <View style={styles.guidelineSearchCard}>
              <Text style={styles.infoCardTitle}>Search ICMR Guidelines</Text>
              <TextInput
                value={icmrGuidelineSearch}
                onChangeText={setIcmrGuidelineSearch}
                placeholder="Search clinical condition or pathogen"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.guidelineSearchInput, webTextInputReset]}
              />
            </View>
            {icmrGuidelineLoading ? (
              <ActivityIndicator color={palette.blue} />
            ) : filteredIcmrGuidelineRows.length === 0 ? (
              <GuidelineEmptyState
                message={
                  icmrGuidelineSearch.trim()
                    ? "No approved ICMR guideline rows match this search."
                    : icmrGuidelineError ||
                      "No approved ICMR guideline rows available."
                }
              />
            ) : (
              filteredIcmrGuidelineRows.map((item) => (
                <IcmrGuidelineCard key={item.id} item={item} />
              ))
            )}
          </View>
        ) : null}
        {selectedGuidelineSection === "stewardshipPearls" ? (
          <View>
            <PearlSearchBox
              title="Search Antimicrobial Stewardship Pearls"
              value={stewardshipPearlSearch}
              onChangeText={setStewardshipPearlSearch}
            />
            {stewardshipPearlsLoading ? (
              <ActivityIndicator color={palette.blue} />
            ) : (
              <PearlSectionList
                groups={groupedStewardshipPearls}
                emptyMessage={
                  stewardshipPearlSearch.trim()
                    ? "No approved antimicrobial stewardship pearls match this search."
                    : stewardshipPearlsError ||
                      "No approved antimicrobial stewardship pearls available."
                }
              />
            )}
          </View>
        ) : null}
        {selectedGuidelineSection === "pearlPoints" ? (
          <View>
            <PearlSearchBox
              title="Search Antimicrobial Pearl Points"
              value={antimicrobialPearlPointSearch}
              onChangeText={setAntimicrobialPearlPointSearch}
            />
            {antimicrobialPearlPointsLoading ? (
              <ActivityIndicator color={palette.blue} />
            ) : (
              <PearlSectionList
                groups={groupedAntimicrobialPearlPoints}
                emptyMessage={
                  antimicrobialPearlPointSearch.trim()
                    ? "No approved antimicrobial pearl points match this search."
                    : antimicrobialPearlPointsError ||
                      "No approved antimicrobial pearl points available."
                }
              />
            )}
          </View>
        ) : null}
        {selectedGuidelineSection === "synergyTesting" ? (
          <View>
            {synergyTestingLoading ? (
              <ActivityIndicator color={palette.blue} />
            ) : synergyTestingRows.length === 0 ? (
              <GuidelineEmptyState
                message={
                  synergyTestingError ||
                  "No approved synergy testing rows available."
                }
              />
            ) : (
              <View>
                {synergyTestingRows.map((item) => (
                  <SynergyTestingCard key={item.id} item={item} />
                ))}
              </View>
            )}
          </View>
        ) : null}
        {selectedGuidelineSection === "antifungalSusceptibility" ? (
          <View>
            {antifungalLoading ? (
              <ActivityIndicator color={palette.blue} />
            ) : groupedAntifungalRows.length === 0 ? (
              <GuidelineEmptyState
                message={
                  antifungalError ||
                  "No approved antifungal susceptibility rows available."
                }
              />
            ) : (
              groupedAntifungalRows.map((group) => (
                <AntifungalSusceptibilityGroup
                  key={group.organismGroup}
                  organismGroup={group.organismGroup}
                  rows={group.rows}
                />
              ))
            )}
            {synergyAntifungalNotes.length > 0 ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>
                  Synergy & antifungal notes
                </Text>
                {synergyAntifungalNotes.map((note) => (
                  <Text key={note.id} style={styles.infoCardBody}>
                    {note.note_text}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {selectedGuidelineSection === "perioperative" ? (
          <View>
            {perioperativeLoading ? (
              <ActivityIndicator color={palette.blue} />
            ) : perioperativeGuidelines.recommendations.length === 0 &&
              perioperativeGuidelines.antibioticDosing.length === 0 &&
              perioperativeGuidelines.notes.length === 0 ? (
              <GuidelineEmptyState
                message={
                  perioperativeError ||
                  "No approved perioperative antimicrobial guideline rows available."
                }
              />
            ) : (
              <PerioperativeGuidelinesPanel data={perioperativeGuidelines} />
            )}
          </View>
        ) : null}
        {selectedGuidelineSection === "empiric" ? (
          approvedAmaTableRecommendations.length > 0 ? (
            approvedAmaTableRecommendations.map((item) => (
              <AmaSourceTableCard key={item.id} item={item} />
            ))
          ) : empiricGuidelineSummaries.length === 0 ? (
            <GuidelineEmptyState />
          ) : (
            empiricGuidelineSummaries.map((summary) => (
              <View key={summary.title} style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{summary.title}</Text>
                {summary.rows.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.guidelineRow}>
                    <Text style={styles.therapyName}>{item.drug?.trim()}</Text>
                    <View style={styles.recommendationGrid}>
                      <RecommendationField label="Dose" value={item.dose} />
                      <RecommendationField label="Route" value={item.route} />
                      <RecommendationField
                        label="Frequency"
                        value={item.frequency}
                      />
                      <RecommendationField
                        label="Duration"
                        value={item.duration}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ))
          )
        ) : null}
        {selectedGuidelineSection === "renal" ? (
          renalGuidelineRecommendations.length === 0 ? (
            <GuidelineEmptyState />
          ) : (
            renalGuidelineRecommendations.slice(0, 12).map((item) => (
              <View key={item.id} style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{item.drug?.trim()}</Text>
                <RecommendationField
                  label="Renal dose adjustment"
                  value={item.renal_adjustment}
                />
              </View>
            ))
          )
        ) : null}
        {selectedGuidelineSection === "carbapenem" ? (
          carbapenemGuidelineRecommendations.length === 0 ? (
            <GuidelineEmptyState />
          ) : (
            carbapenemGuidelineRecommendations.slice(0, 12).map((item) => (
              <View key={item.id} style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{item.drug?.trim()}</Text>
                {hasMeaningfulText(item.stewardship_note) ? (
                  <RecommendationField
                    label="Stewardship note"
                    value={item.stewardship_note}
                  />
                ) : null}
                {hasMeaningfulText(item.id_consult_trigger) ? (
                  <RecommendationField
                    label="ID consult"
                    value={item.id_consult_trigger}
                  />
                ) : null}
              </View>
            ))
          )
        ) : null}
      </View>,
      section?.title ?? "Guideline",
      false,
    );
  };

  const GuidelineEmptyState = ({ message }: { message?: string }) => (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardBody}>
        {message ?? "No approved guideline content available for this section."}
      </Text>
    </View>
  );

  const IcmrGuidelineCard = ({ item }: { item: IcmrGuidelineRow }) => (
    <View style={styles.amaTableCard}>
      <View style={styles.amaTableHeader}>
        <Text style={styles.amaTableTitle}>{item.clinical_condition}</Text>
        <Text style={styles.amaRoleBadge}>ICMR</Text>
      </View>
      <RecommendationField
        label="Clinical Condition"
        value={item.clinical_condition}
      />
      <RecommendationField
        label="Common Pathogens"
        value={item.common_pathogens}
      />
      <RecommendationField label="Empirical AMA" value={item.empirical_ama} />
      <RecommendationField label="Alternate AMA" value={item.alternate_ama} />
      <RecommendationField label="Comments" value={item.comments} />
      <RecommendationField
        label="Source Page"
        value={
          item.source_page === null || item.source_page === undefined
            ? "not specified"
            : String(item.source_page)
        }
      />
      <RecommendationField label="Source Quote" value={item.source_quote} />
    </View>
  );

  const DurationGuidelineCard = ({ item }: { item: DurationGuidelineRow }) => (
    <View style={styles.amaTableCard}>
      <View style={styles.amaTableHeader}>
        <Text style={styles.amaTableTitle}>{item.infection}</Text>
        <Text style={styles.amaRoleBadge}>Duration</Text>
      </View>
      <RecommendationField label="Infection" value={item.infection} />
      <RecommendationField label="Duration" value={item.duration} />
      <RecommendationField label="Remarks" value={item.remarks} />
      <RecommendationField
        label="Source Page"
        value={
          item.source_page === null || item.source_page === undefined
            ? "not specified"
            : String(item.source_page)
        }
      />
      <RecommendationField label="Source Quote" value={item.source_quote} />
    </View>
  );

  const PearlSearchBox = ({
    title,
    value,
    onChangeText,
  }: {
    title: string;
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <View style={styles.guidelineSearchCard}>
      <Text style={styles.infoCardTitle}>{title}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search pearl text"
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.guidelineSearchInput, webTextInputReset]}
      />
    </View>
  );

  const PearlCard = ({ item }: { item: PearlContentRow }) => (
    <View style={styles.amaTableCard}>
      <View style={styles.amaTableHeader}>
        <Text style={styles.amaTableTitle}>{item.section_name}</Text>
        <Text style={styles.amaRoleBadge}>Pearl</Text>
      </View>
      <RecommendationField label="Section" value={item.section_name} />
      <RecommendationField label="Pearl Text" value={item.pearl_text} />
      <RecommendationField
        label="Source Page"
        value={
          item.source_page === null || item.source_page === undefined
            ? "not specified"
            : String(item.source_page)
        }
      />
      <RecommendationField label="Source Quote" value={item.source_quote} />
    </View>
  );

  const PearlSectionList = ({
    groups,
    emptyMessage,
  }: {
    groups: PearlSectionGroup<PearlContentRow>[];
    emptyMessage: string;
  }) =>
    groups.length === 0 ? (
      <GuidelineEmptyState message={emptyMessage} />
    ) : (
      <View>
        {groups.map((group) => (
          <View key={group.sectionName} style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{group.sectionName}</Text>
            {group.rows.map((item) => (
              <PearlCard key={item.id} item={item} />
            ))}
          </View>
        ))}
      </View>
    );

  const SourceBackedMeta = ({ item }: { item: { source_page: number | null; source_quote: string } }) => (
    <View>
      <RecommendationField
        label="Source Page"
        value={
          item.source_page === null || item.source_page === undefined
            ? "not specified"
            : String(item.source_page)
        }
      />
      <RecommendationField label="Source Quote" value={item.source_quote} />
    </View>
  );

  const SynergyTestingCard = ({ item }: { item: SynergyTestingRow }) => (
    <View style={styles.amaTableCard}>
      <View style={styles.amaTableHeader}>
        <Text style={styles.amaTableTitle}>{item.organism}</Text>
        <Text style={styles.amaRoleBadge}>Synergy</Text>
      </View>
      <View style={styles.antibiogramMiniGrid}>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Organism</Text>
          <Text style={styles.infoCardBody}>{item.organism}</Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Total No. Tested</Text>
          <Text style={styles.infoCardBody}>
            {item.total_tested ?? "not documented"}
          </Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>
            Negative for Synergy
          </Text>
          <Text style={styles.infoCardBody}>
            {item.negative_for_synergy ?? "not documented"}
          </Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>
            Positive for Synergy
          </Text>
          <Text style={styles.infoCardBody}>
            {item.positive_for_synergy ?? "not documented"}
          </Text>
        </View>
      </View>
      <SourceBackedMeta item={item} />
    </View>
  );

  const AntifungalSusceptibilityGroup = ({
    organismGroup,
    rows,
  }: {
    organismGroup: string;
    rows: AntifungalSusceptibilityRow[];
  }) => (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>{organismGroup}</Text>
      {rows.map((item) => (
        <View key={item.id} style={styles.antibiogramPathogenCard}>
          <View style={styles.amaTableHeader}>
            <Text style={styles.amaTableTitle}>{item.species}</Text>
            <Text style={styles.amaRoleBadge}>{item.drug}</Text>
          </View>
          <RecommendationField label="Organism Group" value={item.organism_group} />
          <RecommendationField label="Species" value={item.species} />
          <RecommendationField label="Drug" value={item.drug} />
          <RecommendationField
            label="Susceptibility Value"
            value={item.susceptibility_value ?? "not documented"}
          />
          <SourceBackedMeta item={item} />
        </View>
      ))}
    </View>
  );

  const PerioperativeRecommendationCard = ({
    item,
  }: {
    item: PerioperativeRecommendation;
  }) => (
    <View style={styles.antibiogramPathogenCard}>
      <Text style={styles.amaTableTitle}>{item.procedure}</Text>
      <RecommendationField label="Procedure" value={item.procedure} />
      <RecommendationField label="Preferred Drug" value={item.preferred_drug} />
      <SourceBackedMeta item={item} />
    </View>
  );

  const PerioperativeDosingCard = ({
    item,
  }: {
    item: PerioperativeAntibioticDosing;
  }) => (
    <View style={styles.antibiogramPathogenCard}>
      <Text style={styles.amaTableTitle}>{item.drug}</Text>
      <View style={styles.antibiogramMiniGrid}>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Drug</Text>
          <Text style={styles.infoCardBody}>{item.drug}</Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Standard Dose</Text>
          <Text style={styles.infoCardBody}>
            {item.standard_dose ?? "not documented"}
          </Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Weight-Based Dose</Text>
          <Text style={styles.infoCardBody}>
            {item.weight_based_dose ?? "not documented"}
          </Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Duration for Bolus</Text>
          <Text style={styles.infoCardBody}>
            {item.bolus_duration ?? "not documented"}
          </Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Duration for Infusion</Text>
          <Text style={styles.infoCardBody}>
            {item.infusion_duration ?? "not documented"}
          </Text>
        </View>
      </View>
      <SourceBackedMeta item={item} />
    </View>
  );

  const PerioperativeNoteCard = ({ item }: { item: PerioperativeNote }) => (
    <View style={styles.antibiogramPathogenCard}>
      <Text style={styles.amaTableTitle}>{item.note_type}</Text>
      <RecommendationField label="Note" value={item.note_text} />
      <SourceBackedMeta item={item} />
    </View>
  );

  const PerioperativeGuidelinesPanel = ({
    data,
  }: {
    data: PerioperativeGuidelines;
  }) => (
    <View>
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Procedure Recommendations</Text>
        {data.recommendations.length === 0 ? (
          <Text style={styles.infoCardBody}>
            No approved perioperative procedure recommendation rows available.
          </Text>
        ) : (
          data.recommendations.map((item) => (
            <PerioperativeRecommendationCard key={item.id} item={item} />
          ))
        )}
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Antibiotic Dosing Table</Text>
        {data.antibioticDosing.length === 0 ? (
          <Text style={styles.infoCardBody}>
            No approved perioperative antibiotic dosing rows available.
          </Text>
        ) : (
          data.antibioticDosing.map((item) => (
            <PerioperativeDosingCard key={item.id} item={item} />
          ))
        )}
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>General Notes</Text>
        {data.notes.length === 0 ? (
          <Text style={styles.infoCardBody}>
            No approved perioperative notes available.
          </Text>
        ) : (
          data.notes.map((item) => (
            <PerioperativeNoteCard key={item.id} item={item} />
          ))
        )}
      </View>
    </View>
  );

  const AntibiogramFilterGroup = <T extends string>({
    label,
    values,
    selected,
    onSelect,
  }: {
    label: string;
    values: T[];
    selected: T;
    onSelect: (value: T) => void;
  }) => (
    <View style={styles.antibiogramFilterGroup}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.antibiogramFilterRow}>
        {values.map((value) => {
          const isSelected = selected === value;

          return (
            <TouchableOpacity
              key={value}
              activeOpacity={0.86}
              onPress={() => onSelect(value)}
              style={[
                styles.antibiogramFilterChip,
                isSelected && styles.antibiogramFilterChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.antibiogramFilterChipText,
                  isSelected && styles.antibiogramFilterChipTextSelected,
                ]}
              >
                {antibiogramFilterLabel(value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const TypeTotals = ({ sheet }: { sheet: AntibiogramSheet }) => (
    <View style={styles.antibiogramMiniGrid}>
      {antibiogramRiskFilters.map((risk) => (
        <View key={risk} style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>
            {antibiogramFilterLabel(risk)}
          </Text>
          <Text style={styles.infoCardBody}>
            {String(sheet.type_totals?.[risk] ?? "not enough data")}
          </Text>
        </View>
      ))}
    </View>
  );

  const AntibiogramEmpiricTherapyCard = ({
    item,
    riskType,
  }: {
    item: AntibiogramEmpiricTherapy | null;
    riskType: AntibiogramRiskFilter;
  }) => (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>
        Empiric Therapy for {antibiogramFilterLabel(riskType)}
      </Text>
      <Text style={styles.infoCardBody}>
        {item?.empiric_therapy?.trim() ||
          "No approved empiric therapy documented for this selection."}
      </Text>
      {item?.source_quote ? (
        <RecommendationField label="Source Quote" value={item.source_quote} />
      ) : null}
    </View>
  );

  const SensitivityList = ({
    sensitivities,
  }: {
    sensitivities: Record<string, number>;
  }) => {
    const entries = Object.entries(sensitivities);

    if (entries.length === 0) {
      return (
        <Text style={styles.infoCardBody}>
          No sensitivities documented in the approved row.
        </Text>
      );
    }

    return (
      <View style={styles.sensitivityGrid}>
        {entries.map(([drug, value]) => (
          <View key={drug} style={styles.sensitivityChip}>
            <Text style={styles.sensitivityDrug}>{drug}</Text>
            <Text style={styles.sensitivityValue}>{value}%</Text>
          </View>
        ))}
      </View>
    );
  };

  const AntibiogramPathogenCard = ({ item }: { item: AntibiogramPathogenRow }) => (
    <View style={styles.antibiogramPathogenCard}>
      <View style={styles.amaTableHeader}>
        <Text style={styles.amaTableTitle}>
          {item.sno ? `${item.sno}. ` : ""}
          {item.pathogen_name}
          {item.has_footnote_marker ? "*" : ""}
        </Text>
        <Text style={styles.amaRoleBadge}>{antibiogramFilterLabel(item.risk_type)}</Text>
      </View>
      <View style={styles.antibiogramMiniGrid}>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>n</Text>
          <Text style={styles.infoCardBody}>
            {item.isolate_count === null || item.isolate_count === undefined
              ? "not specified"
              : String(item.isolate_count)}
          </Text>
        </View>
        <View style={styles.antibiogramMiniCell}>
          <Text style={styles.recommendationFieldLabel}>Prevalence</Text>
          <Text style={styles.infoCardBody}>
            {item.prevalence_pct === null || item.prevalence_pct === undefined
              ? "not specified"
              : `${item.prevalence_pct}%`}
          </Text>
        </View>
      </View>
      <Text style={styles.groupLabel}>Sensitivities</Text>
      <SensitivityList sensitivities={item.sensitivities} />
      {item.raw_sensitivity_text ? (
        <RecommendationField
          label="Raw Sensitivity Text"
          value={item.raw_sensitivity_text}
        />
      ) : null}
    </View>
  );

  const AntibiogramRiskCriteriaCard = ({
    rows,
  }: {
    rows: AntibiogramRiskCriterion[];
  }) => (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Risk Stratification Criteria</Text>
      {rows.length === 0 ? (
        <Text style={styles.infoCardBody}>
          No approved risk criteria documented for this selection.
        </Text>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.antibiogramCriteriaRow}>
            <Text style={styles.infoCardTitle}>{row.criterion_name}</Text>
            <RecommendationField label="Type 1" value={row.type_1} />
            <RecommendationField label="Type 2" value={row.type_2} />
            <RecommendationField label="Type 3" value={row.type_3} />
          </View>
        ))
      )}
    </View>
  );

  const AntibiogramFootnotesCard = ({
    rows,
    riskType,
  }: {
    rows: AntibiogramFootnote[];
    riskType: AntibiogramRiskFilter;
  }) => (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>
        Footnotes for {antibiogramFilterLabel(riskType)}
      </Text>
      {rows.length === 0 ? (
        <Text style={styles.infoCardBody}>
          No approved footnotes documented for this selection.
        </Text>
      ) : (
        rows.map((row) => (
          <Text key={row.id} style={styles.infoCardBody}>
            {row.note}
          </Text>
        ))
      )}
    </View>
  );

  const RecommendationField = ({
    label,
    value,
  }: {
    label: string;
    value: string | null | undefined;
  }) => {
    const displayValue = value?.trim();

    if (!displayValue) {
      return null;
    }

    return (
      <View style={styles.recommendationField}>
        <Text style={styles.recommendationFieldLabel}>{label}</Text>
        <Text style={styles.recommendationFieldValue}>{displayValue}</Text>
      </View>
    );
  };

  const hasAmaTableFields = (item: SourceRecommendation) =>
    hasMeaningfulText(item.clinical_condition) &&
    hasMeaningfulText(item.common_pathogens) &&
    (item.ama_role === "empirical" || item.ama_role === "alternate");

  const amaTextForRole = (item: SourceRecommendation) =>
    item.ama_role === "alternate" ? item.alternate_ama : item.empirical_ama;

  const amaRoleLabel = (role: SourceRecommendation["ama_role"]) =>
    role === "alternate" ? "Alternate AMA" : "Empirical AMA";

  const AmaSourceTableCard = ({ item }: { item: SourceRecommendation }) => (
    <View style={styles.amaTableCard}>
      <View style={styles.amaTableHeader}>
        <Text style={styles.amaTableTitle}>
          {item.clinical_condition?.trim()}
        </Text>
        <Text style={styles.amaRoleBadge}>{amaRoleLabel(item.ama_role)}</Text>
      </View>
      <RecommendationField
        label="Common Pathogens"
        value={item.common_pathogens}
      />
      <RecommendationField label={amaRoleLabel(item.ama_role)} value={amaTextForRole(item)} />
      <RecommendationField label="Comments" value={item.comments} />
      <View style={styles.amaSourceMeta}>
        <Text style={styles.amaSourceMetaText}>
          Source: {item.source_image?.trim() || item.source_filename}
        </Text>
        <Text style={styles.amaSourceMetaText}>
          Page: {item.source_page ?? item.page_number ?? "not specified"}
        </Text>
      </View>
      <RecommendationField label="Source Quote" value={item.source_quote} />
    </View>
  );

  const cleanDrugDisplayName = (value: string) =>
    value
      .replace(/^\s*(OR|AND)\s+/i, "")
      .replace(/^\s*(plus|with|combined with|along with)\s+/i, "")
      .replace(/^\s*(\+\/-|\+)\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

  const sourceExpressionForProtocol = (item: SourceRecommendation) =>
    [item.source_quote, item.drug].filter(Boolean).join(" ");

  const startsWithAlternativeOperator = (value: string) =>
    /^\s*(OR|alternative|either)\b/i.test(value);

  const endsWithAlternativeOperator = (value: string) =>
    /\bOR\s*$/i.test(value);

  const startsWithCombinationOperator = (value: string) =>
    /^\s*(\+|plus|with|combined with|along with|add)\b/i.test(value);

  const endsWithCombinationOperator = (value: string) =>
    /(\+|\bplus\b|\bwith\b|\bcombined with\b|\balong with\b|\badd\b)\s*$/i.test(
      value,
    );

  const startsWithOptionalOperator = (value: string) =>
    /^\s*(\+\/-|optional)\b/i.test(value);

  const endsWithOptionalOperator = (value: string) =>
    /(\+\/-|\boptional\b)\s*$/i.test(value);

  const containsCombinationOperator = (value: string) =>
    /(\+|\/\+|\bplus\b|\bwith\b|\bcombined with\b|\balong with\b|\badd\b)/i.test(
      value,
    );

  const containsAlternativeOperator = (value: string) =>
    /\b(OR|alternative|either|step-down to)\b/i.test(value);

  const shouldClinicallyCombineAdjacent = (
    current: SourceRecommendation,
    previous: SourceRecommendation | null,
  ) => {
    if (!previous) {
      return false;
    }

    const currentDrug = normalizeMatchText(current.drug);
    const previousDrug = normalizeMatchText(previous.drug);
    const combinedContext = normalizeMatchText(
      `${previous.source_quote ?? ""} ${current.source_quote ?? ""}`,
    );

    if (!currentDrug || !previousDrug) {
      return false;
    }

    if (
      currentDrug.includes("metronidazole") &&
      /(ceftriaxone|cefotaxime|cefoperazone|piperacillin|carbapenem|meropenem|imipenem|doripenem)/.test(
        previousDrug,
      )
    ) {
      return true;
    }

    if (
      /(vancomycin|teicoplanin|linezolid|clindamycin)/.test(currentDrug) &&
      /(mrsa|staph|gram positive|add|risk factors|vancomycin|teicoplanin|linezolid|clindamycin)/.test(
        combinedContext,
      )
    ) {
      return true;
    }

    if (
      /(azithromycin|doxycycline|macrolide)/.test(currentDrug) &&
      /(cap|respiratory|pneumonia|doxycycline|macrolide|azithromycin)/.test(
        combinedContext,
      ) &&
      /(ceftriaxone|cefoperazone|piperacillin|cefotaxime|ceftazidime|avibactam|aztreonam)/.test(
        previousDrug,
      )
    ) {
      return true;
    }

    return false;
  };

  const splitProtocolOptionDrugs = (
    item: SourceRecommendation,
    optionKey: string,
  ): ProtocolDrugDisplay[] => {
    const expression = item.drug?.trim();

    if (!expression) {
      return [];
    }

    const tokens = expression
      .split(/(\+\/-|\+)/)
      .map((part) => part.trim())
      .filter(Boolean);

    const drugs: ProtocolDrugDisplay[] = [];
    let nextIsOptional = false;

    tokens.forEach((token, tokenIndex) => {
      if (token === "+") {
        nextIsOptional = false;
        return;
      }

      if (token === "+/-") {
        nextIsOptional = true;
        return;
      }

      const name = cleanDrugDisplayName(token);

      if (!name) {
        return;
      }

      drugs.push({
        key: `${optionKey}-${tokenIndex}-${name}`,
        name,
        dose: item.dose,
        route: item.route,
        frequency: item.frequency,
        duration: item.duration,
        optional: nextIsOptional,
      });
      nextIsOptional = false;
    });

    return drugs;
  };

  const buildProtocolOptions = (
    items: SourceRecommendation[],
  ): ProtocolOptionDisplay[] => {
    const options: ProtocolOptionDisplay[] = [];
    let currentOption: ProtocolOptionDisplay | null = null;
    let previousItem: SourceRecommendation | null = null;
    let previousExpression = "";

    const pushOption = () => {
      if (!currentOption || currentOption.drugs.length === 0) {
        currentOption = null;
        return;
      }

      currentOption.relationship =
        currentOption.drugs.length === 1
          ? currentOption.drugs[0].optional
            ? "OPTIONAL"
            : "SINGLE"
          : currentOption.drugs.some((drug) => drug.optional)
            ? "MIXED"
            : "AND";
      currentOption.optionNumber = options.length + 1;
      options.push(currentOption);
      currentOption = null;
    };

    const ensureOption = (optionKey: string) => {
      if (!currentOption) {
        currentOption = {
          key: optionKey,
          optionNumber: options.length + 1,
          relationship: "SINGLE",
          drugs: [],
        };
      }

      return currentOption;
    };

    items.forEach((item) => {
      const expression = item.drug?.trim();
      const sourceExpression = sourceExpressionForProtocol(item);

      if (!expression) {
        return;
      }

      const optionExpressions = expression
        .split(/\s+\b(?:OR|alternative|either|step-down to)\b\s+/i)
        .map((part) => part.trim())
        .filter(Boolean);

      const chunks = optionExpressions.length > 0 ? optionExpressions : [expression];

      chunks.forEach((chunk, chunkIndex) => {
        const optionKey = `${item.id}-${chunkIndex}`;
        const chunkExpression = chunkIndex === 0 ? sourceExpression : chunk;
        const optionItem: SourceRecommendation = {
          ...item,
          drug: chunk,
        };
        const drugs = splitProtocolOptionDrugs(optionItem, optionKey);

        if (drugs.length === 0) {
          return;
        }

        const hasInlineCombination =
          drugs.length > 1 || containsCombinationOperator(chunkExpression);
        const isOptionalChunk =
          startsWithOptionalOperator(chunkExpression) ||
          endsWithOptionalOperator(previousExpression);
        const isAlternativeChunk =
          chunkIndex > 0 ||
          startsWithAlternativeOperator(chunkExpression) ||
          endsWithAlternativeOperator(previousExpression);
        const isCombinationChunk =
          !isAlternativeChunk &&
          (startsWithCombinationOperator(chunkExpression) ||
            endsWithCombinationOperator(previousExpression) ||
            isOptionalChunk ||
            hasInlineCombination ||
            shouldClinicallyCombineAdjacent(item, previousItem));

        if (isAlternativeChunk && currentOption) {
          pushOption();
        }

        const option = isCombinationChunk
          ? ensureOption(optionKey)
          : (() => {
              if (currentOption) {
                pushOption();
              }
              return ensureOption(optionKey);
            })();

        drugs.forEach((drug) =>
          option.drugs.push({
            ...drug,
            optional: drug.optional || isOptionalChunk,
          }),
        );
      });

      previousItem = item;
      previousExpression = sourceExpression;
    });

    pushOption();

    return options;
  };

  const protocolBadgeLabel = (options: ProtocolOptionDisplay[]) => {
    if (options.length === 0) {
      return "No Protocol";
    }

    const hasMultipleOptions = options.length > 1;
    const hasCombination = options.some((option) =>
      ["AND", "MIXED", "OPTIONAL"].includes(option.relationship),
    );

    if (hasMultipleOptions && hasCombination) {
      return "Mixed Protocol";
    }

    if (hasMultipleOptions) {
      return "OR Protocol";
    }

    if (hasCombination) {
      return options[0].relationship === "AND"
        ? "Combination Therapy"
        : "Mixed Protocol";
    }

    return "Single Treatment Protocol";
  };

  const RelationshipBadge = ({ label }: { label: string }) => (
    <View style={styles.protocolBadge}>
      <Text style={styles.protocolBadgeText}>{label}</Text>
    </View>
  );

  const OrDivider = () => (
    <View style={styles.orDivider}>
      <View style={styles.orDividerLine} />
      <Text style={styles.orDividerText}>OR</Text>
      <View style={styles.orDividerLine} />
    </View>
  );

  const AndConnector = () => (
    <View style={styles.andConnector}>
      <Text style={styles.andConnectorText}>AND</Text>
    </View>
  );

  const OptionalBadge = () => (
    <View style={styles.optionalBadge}>
      <Text style={styles.optionalBadgeText}>OPTIONAL</Text>
    </View>
  );

  const ProtocolDrugBlock = ({ drug }: { drug: ProtocolDrugDisplay }) => (
    <View style={styles.protocolDrugBlock}>
      <View style={styles.protocolDrugHeader}>
        <Text style={styles.therapyName}>{drug.name}</Text>
        {drug.optional ? <OptionalBadge /> : null}
      </View>
      <View style={styles.recommendationGrid}>
        <RecommendationField label="Dose" value={drug.dose} />
        <RecommendationField label="Route" value={drug.route} />
        <RecommendationField label="Frequency" value={drug.frequency} />
        <RecommendationField label="Duration" value={drug.duration} />
      </View>
    </View>
  );

  const ProtocolOptionCard = ({ option }: { option: ProtocolOptionDisplay }) => (
    <View style={styles.therapyCard}>
      <View style={styles.therapyIconBadge}>
        <AppIcon name="pill" size={24} color={palette.orange} />
        <Text style={styles.rank}>{option.optionNumber}</Text>
      </View>
      <View style={styles.therapyBody}>
        <View style={styles.protocolOptionHeader}>
          <Text style={styles.protocolOptionTitle}>
            Option {option.optionNumber}
          </Text>
          <RelationshipBadge label={option.relationship} />
        </View>
        {option.drugs.map((drug, drugIndex) => (
          <View key={drug.key}>
            {drugIndex > 0 ? <AndConnector /> : null}
            <ProtocolDrugBlock drug={drug} />
          </View>
        ))}
      </View>
    </View>
  );

  const ProtocolRecommendationList = ({
    items,
  }: {
    items: SourceRecommendation[];
  }) => {
    if (items.some(hasAmaTableFields)) {
      return (
        <View>
          {items.filter(hasAmaTableFields).map((item) => (
            <AmaSourceTableCard key={item.id} item={item} />
          ))}
        </View>
      );
    }

    const options = buildProtocolOptions(items);

    if (options.length === 0) {
      return null;
    }

    return (
      <View>
        <RelationshipBadge label={protocolBadgeLabel(options)} />
        {options.map((option, index) => (
          <View key={option.key}>
            {index > 0 ? <OrDivider /> : null}
            <ProtocolOptionCard option={option} />
          </View>
        ))}
      </View>
    );
  };

  const renderPDFDrugTable = (option: ProtocolOptionDisplay) => {
    const rows = option.drugs
      .map(
        (drug) => `
          <tr>
            <td>
              <strong>${escapeHtml(drug.name)}</strong>
              ${
                drug.optional
                  ? '<span class="badge badge-green">Optional</span>'
                  : ""
              }
            </td>
            <td>${escapeHtml(drug.dose || "-")}</td>
            <td>${escapeHtml(drug.route || "-")}</td>
            <td>${escapeHtml(drug.frequency || "-")}</td>
            <td>${escapeHtml(drug.duration || "")}</td>
          </tr>
        `,
      )
      .join("");

    return `
      <table class="drug-table">
        <thead>
          <tr>
            <th>Drug</th>
            <th>Dose</th>
            <th>Route</th>
            <th>Frequency</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  const renderPDFProtocolOptions = (reportCase: SavedClinicalCase) => {
    const options = buildProtocolOptions(reportCase.recommendations);

    if (options.length === 0) {
      return `<div class="empty">${escapeHtml(failClosedMessage)}</div>`;
    }

    return `
      <div class="protocol-badge">${escapeHtml(protocolBadgeLabel(options))}</div>
      ${options
        .map(
          (option, index) => `
            ${index > 0 ? '<div class="or-divider"><span></span><b>OR</b><span></span></div>' : ""}
            <article class="protocol-option">
              <div class="option-head">
                <h3>Option ${option.optionNumber}</h3>
                <span class="badge">${escapeHtml(
                  option.relationship === "AND"
                    ? "Combination Therapy"
                    : option.relationship,
                )}</span>
              </div>
              ${renderPDFDrugTable(option)}
            </article>
          `,
        )
        .join("")}
    `;
  };

  const renderPDFStewardshipGuidance = (reportCase: SavedClinicalCase) => {
    const lines = reportStewardshipLines(reportCase);

    if (lines.length === 0) {
      return '<p class="muted">No additional stewardship guidance documented for this selected protocol.</p>';
    }

    return `<ul class="guidance-list">${lines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("")}</ul>`;
  };

  const renderProfessionalPDFReport = (
    reportCase: SavedClinicalCase,
    includePrintButton: boolean,
  ) => `
    <!doctype html>
    <html>
      <head>
        <title>Hinduja Antibiotic Guide Report</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          body {
            margin: 0;
            background: #ffffff;
            color: #0B2850;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.45;
          }
          .page { max-width: 920px; margin: 0 auto; padding: 34px; }
          .print-button {
            border: 0;
            border-radius: 10px;
            background: #0057B8;
            color: #ffffff;
            padding: 11px 16px;
            font-weight: 800;
            margin-bottom: 18px;
          }
          .report-header {
            border: 1px solid #DCE6F2;
            border-left: 8px solid #0057B8;
            border-radius: 16px;
            padding: 22px;
            display: flex;
            justify-content: space-between;
            gap: 20px;
            background: #F7FBFF;
          }
          .eyebrow { color: #0057B8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
          h1 { margin: 4px 0 2px; font-size: 24px; line-height: 1.2; color: #0B2850; }
          h2 { margin: 0 0 14px; font-size: 16px; color: #004AA3; }
          h3 { margin: 0; font-size: 14px; color: #0B2850; }
          .meta { color: #5C6F86; font-size: 12px; font-weight: 700; }
          .section {
            border: 1px solid #DCE6F2;
            border-radius: 16px;
            padding: 18px;
            margin-top: 18px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .field { border-top: 1px solid #E7EEF8; padding-top: 8px; }
          .label { color: #5C6F86; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
          .value { color: #0B2850; font-size: 13px; font-weight: 800; margin-top: 2px; }
          .protocol-badge, .badge {
            display: inline-block;
            border: 1px solid #CFE1FF;
            background: #EAF2FF;
            color: #004AA3;
            border-radius: 999px;
            padding: 5px 10px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .04em;
          }
          .badge-green {
            margin-left: 8px;
            border-color: #BBF7D0;
            background: #ECFDF5;
            color: #1E9D61;
          }
          .protocol-option {
            border: 1px solid #DCE6F2;
            border-radius: 14px;
            padding: 14px;
            margin-top: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .option-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
          }
          .or-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #004AA3;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .1em;
            margin: 12px 0 2px;
          }
          .or-divider span { height: 1px; flex: 1; background: #CFE1FF; }
          .drug-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .drug-table th {
            text-align: left;
            background: #EEF6FF;
            color: #004AA3;
            padding: 9px;
            border: 1px solid #DCE6F2;
            font-size: 10px;
            text-transform: uppercase;
          }
          .drug-table td { padding: 10px 9px; border: 1px solid #DCE6F2; vertical-align: top; }
          .guidance-list { margin: 0; padding-left: 20px; }
          .guidance-list li { margin-bottom: 8px; }
          .muted { color: #5C6F86; font-weight: 700; }
          .signature {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            margin-top: 26px;
            color: #5C6F86;
            font-size: 12px;
            font-weight: 700;
          }
          .signature-line { flex: 1; border-top: 1px solid #AFC2D9; padding-top: 8px; }
          .footer {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 1px solid #DCE6F2;
            color: #5C6F86;
            font-size: 11px;
            font-weight: 700;
          }
          .empty { border-radius: 12px; background: #FFF1F1; color: #D93A3A; padding: 12px; font-weight: 800; }
          @media print {
            .print-button { display: none; }
            .page { padding: 22px; max-width: none; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          ${includePrintButton ? '<button class="print-button" onclick="window.print()">Export PDF</button>' : ""}
          <header class="report-header">
            <div>
              <div class="eyebrow">Hinduja Antibiotic Guide</div>
              <h1>Antimicrobial Stewardship Recommendation Report</h1>
              <div class="meta">Generated ${escapeHtml(formatDateTime(reportCase.savedAt))}</div>
            </div>
            <div class="meta">
              <strong>${escapeHtml(reportCase.doctorName || "Doctor not specified")}</strong><br />
              ${escapeHtml(reportCase.doctorEmail)}
            </div>
          </header>

          <section class="section">
            <h2>Doctor / Report Information</h2>
            <div class="grid">
              <div class="field"><div class="label">Doctor</div><div class="value">${escapeHtml(reportCase.doctorName || "Doctor not specified")}</div></div>
              <div class="field"><div class="label">Email</div><div class="value">${escapeHtml(reportCase.doctorEmail)}</div></div>
              <div class="field"><div class="label">Generated</div><div class="value">${escapeHtml(formatDateTime(reportCase.savedAt))}</div></div>
              <div class="field"><div class="label">Report Type</div><div class="value">Antimicrobial stewardship recommendation</div></div>
            </div>
          </section>

          <section class="section">
            <h2>Case Summary</h2>
            <div class="grid">
              <div class="field"><div class="label">Infection Site</div><div class="value">${escapeHtml(reportCase.infectionSite)}</div></div>
              <div class="field"><div class="label">Setting</div><div class="value">${escapeHtml(reportCase.setting)}</div></div>
              <div class="field"><div class="label">Acquisition</div><div class="value">${escapeHtml(reportCase.acquisition)}</div></div>
              <div class="field"><div class="label">Risk Level</div><div class="value">${escapeHtml(reportCase.riskLevel)} ${reportCase.riskType === "Type 3" ? '<span class="badge badge-green">High Risk / ID Review</span>' : ""}</div></div>
            </div>
          </section>

          <section class="section">
            <h2>Recommended Treatment Protocol</h2>
            ${renderPDFProtocolOptions(reportCase)}
          </section>

          <section class="section">
            <h2>Stewardship Guidance</h2>
            ${renderPDFStewardshipGuidance(reportCase)}
          </section>

          <section class="section">
            <h2>Disclaimer / Signature</h2>
            <p class="muted">For authorized clinical use only. Verify with institutional protocol and clinical judgement.</p>
            <div class="signature">
              <div class="signature-line">AMS / ID Team</div>
              <div class="signature-line">Treating Clinician</div>
            </div>
          </section>
          <footer class="footer">For authorized clinical use only · Verify with institutional protocol and clinical judgement</footer>
        </main>
      </body>
    </html>
  `;

  const SourceRecommendationCard = ({
    item,
    index,
  }: {
    item: SourceRecommendation;
    index: number;
  }) => (
    <View style={styles.therapyCard}>
      <View style={styles.therapyIconBadge}>
        <AppIcon name="pill" size={24} color={palette.orange} />
        <Text style={styles.rank}>{index + 1}</Text>
      </View>
      <View style={styles.therapyBody}>
        <Text style={styles.therapyName}>{item.drug?.trim()}</Text>
        <View style={styles.recommendationGrid}>
          <RecommendationField label="Dose" value={item.dose} />
          <RecommendationField label="Route" value={item.route} />
          <RecommendationField label="Frequency" value={item.frequency} />
          <RecommendationField label="Duration" value={item.duration} />
        </View>
        {hasMeaningfulText(item.renal_adjustment) ? (
          <RecommendationField
            label="Renal adjustment"
            value={item.renal_adjustment}
          />
        ) : null}
        {hasMeaningfulText(item.allergy_warning) ? (
          <RecommendationField
            label="Allergy warning"
            value={item.allergy_warning}
          />
        ) : null}
        {hasMeaningfulText(item.stewardship_note) ? (
          <RecommendationField
            label="Stewardship note"
            value={item.stewardship_note}
          />
        ) : null}
      </View>
    </View>
  );

  const Duration = () =>
    TabPage(
      "Duration",
      <View>
        <View style={styles.guidelineSearchCard}>
          <Text style={styles.infoCardTitle}>Search Duration Guidelines</Text>
          <TextInput
            value={durationGuidelineSearch}
            onChangeText={setDurationGuidelineSearch}
            placeholder="Search infection"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.guidelineSearchInput, webTextInputReset]}
          />
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Approved Duration of Treatment</Text>
          {durationGuidelineLoading ? (
            <ActivityIndicator color={palette.blue} />
          ) : filteredDurationGuidelineRows.length === 0 ? (
            <Text style={styles.infoCardBody}>
              {durationGuidelineSearch.trim()
                ? "No approved duration guideline rows match this search."
                : durationGuidelineError ||
                  "No approved duration guideline rows available."}
            </Text>
          ) : (
            filteredDurationGuidelineRows.map((item) => (
              <DurationGuidelineCard key={item.id} item={item} />
            ))
          )}
        </View>
        {durationGuidelineRows.length === 0 ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Review Trigger</Text>
            <Text style={styles.infoCardBody}>
              Reassess duration when cultures, source control, and clinical response are available.
            </Text>
          </View>
        ) : null}
      </View>,
    );

  const Antibiogram = () =>
    TabPage(
      "Local Antibiogram",
      <View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            Local Antibiogram and Empirical Antibiotic Choice
          </Text>
          <AntibiogramFilterGroup
            label="Infection"
            values={antibiogramInfectionFilters}
            selected={antibiogramInfection}
            onSelect={setAntibiogramInfection}
          />
          <AntibiogramFilterGroup
            label="Location"
            values={antibiogramLocationFilters}
            selected={antibiogramLocation}
            onSelect={setAntibiogramLocation}
          />
          <AntibiogramFilterGroup
            label="Acquisition"
            values={antibiogramAcquisitionFilters}
            selected={antibiogramAcquisition}
            onSelect={setAntibiogramAcquisition}
          />
          <AntibiogramFilterGroup
            label="Risk Type"
            values={antibiogramRiskFilters}
            selected={antibiogramRiskType}
            onSelect={setAntibiogramRiskType}
          />
        </View>

        {antibiogramLoading ? (
          <View style={styles.infoCard}>
            <ActivityIndicator color={palette.blue} />
          </View>
        ) : !selectedAntibiogramSheet ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardBody}>
              {antibiogramError ||
                "No approved antibiogram rows available for this selection."}
            </Text>
          </View>
        ) : (
          <View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>
                {selectedAntibiogramSheet.sheet_title}
              </Text>
              <RecommendationField
                label="Surveillance Period"
                value={selectedAntibiogramSheet.surveillance}
              />
              <Text style={styles.groupLabel}>Type Totals</Text>
              <TypeTotals sheet={selectedAntibiogramSheet} />
              {selectedAntibiogramSheet.section_notes.length > 0 ? (
                <View>
                  <Text style={styles.groupLabel}>Section Notes</Text>
                  {selectedAntibiogramSheet.section_notes.map((note) => (
                    <Text key={note} style={styles.infoCardBody}>
                      {note}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            <AntibiogramEmpiricTherapyCard
              item={selectedAntibiogramTherapy}
              riskType={antibiogramRiskType}
            />

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>
                Pathogen Rows for {antibiogramFilterLabel(antibiogramRiskType)}
              </Text>
              {selectedAntibiogramPathogens.length === 0 ? (
                <Text style={styles.infoCardBody}>
                  No approved pathogen rows documented for this selected type.
                </Text>
              ) : (
                selectedAntibiogramPathogens.map((item) => (
                  <AntibiogramPathogenCard key={item.id} item={item} />
                ))
              )}
            </View>

            <AntibiogramFootnotesCard
              rows={selectedAntibiogramFootnotes}
              riskType={antibiogramRiskType}
            />
            <AntibiogramRiskCriteriaCard rows={selectedAntibiogramRiskCriteria} />
          </View>
        )}
      </View>,
    );

  const Alerts = () =>
    TabPage(
      "Alerts",
      <View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Stewardship Review</Text>
          {protocolFlowLoading ? (
            <ActivityIndicator color={palette.blue} />
          ) : selectedSourceRecommendations.length === 0 ? (
            <Text style={styles.infoCardBody}>
              {protocolFlowMessage || failClosedMessage}
            </Text>
          ) : meaningfulWarningRecommendations.length === 0 ? (
            <Text style={styles.infoCardBody}>
              No specific warnings documented in approved data for the current recommendations.
            </Text>
          ) : (
            meaningfulWarningRecommendations.map((item) => (
              <View key={item.id} style={styles.durationRow}>
                <Text style={styles.infoCardTitle}>{item.drug?.trim()}</Text>
                {hasMeaningfulText(item.stewardship_note) ? (
                  <Text style={styles.infoCardBody}>
                    Stewardship: {item.stewardship_note?.trim()}
                  </Text>
                ) : null}
                {hasMeaningfulText(item.allergy_warning) ? (
                  <Text style={styles.infoCardBody}>
                    Allergy: {item.allergy_warning?.trim()}
                  </Text>
                ) : null}
                {hasMeaningfulText(item.renal_adjustment) ? (
                  <Text style={styles.infoCardBody}>
                    Renal: {item.renal_adjustment?.trim()}
                  </Text>
                ) : null}
              </View>
            ))
          )}
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.actionButton}
            onPress={() => go("stewardshipAlert")}
          >
            <Text style={styles.actionButtonText}>Open Warnings</Text>
          </TouchableOpacity>
        </View>
      </View>,
    );

  const Profile = () =>
    TabPage(
      "Profile",
      <View>
        <View style={styles.profileBadge}>
          <Text style={styles.profileInitial}>
            {initialsForName(doctorProfile.name, doctorProfile.email)}
          </Text>
        </View>
        <Text style={styles.profileName}>
          {doctorProfile.name || "Name not set"}
        </Text>
        <Text style={styles.profileMeta}>
          {doctorProfile.email || "Email not provided"}
        </Text>
        {doctorProfile.employeeId ? (
          <Text style={styles.profileMeta}>Employee ID: {doctorProfile.employeeId}</Text>
        ) : null}
        {doctorProfile.contactNumber ? (
          <Text style={styles.profileMeta}>Contact: {doctorProfile.contactNumber}</Text>
        ) : null}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Local profile</Text>
          <Text style={styles.infoCardBody}>
            Stored on this device for report personalization. It does not authenticate or authorize access.
          </Text>
        </View>
        {guideMetadata ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>About this guide</Text>
            <Text style={styles.infoCardBody}>
              {guideMetadata.source_document}
            </Text>
            {guideMetadata.institution_address ? (
              <Text style={styles.infoCardBody}>
                {guideMetadata.institution_address}
              </Text>
            ) : null}
            {guideMetadata.surveillance_period ? (
              <Text style={styles.infoCardBody}>
                Surveillance period: {guideMetadata.surveillance_period}
              </Text>
            ) : null}
            {guideMetadata.valid_till ? (
              <Text style={styles.infoCardBody}>
                Valid till: {guideMetadata.valid_till}
              </Text>
            ) : null}
            {guideMetadata.document_index &&
            guideMetadata.document_index.length > 0 ? (
              <View>
                <Text style={styles.groupLabel}>Contents</Text>
                {guideMetadata.document_index.map((entry) => (
                  <Text
                    key={`guide-index-${entry.sno}`}
                    style={styles.infoCardBody}
                  >
                    {entry.sno}. {entry.description} (page {entry.page})
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        <PrimaryButton
          label="Edit Profile"
          onPress={() => {
            setProfileNameInput(doctorProfile.name);
            setProfileEmailInput(doctorProfile.email);
            setProfileError("");
            setProfileSuccess("");
            go("editProfile");
          }}
        />
      </View>,
    );

  const EditProfile = () =>
    appShell(
      <View>
        <View style={styles.editProfileCard}>
          <Text style={styles.editProfileTitle}>Edit Profile</Text>
          {profileSuccess ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{profileSuccess}</Text>
            </View>
          ) : null}
          {profileError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{profileError}</Text>
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>Name *</Text>
          <View style={styles.inputWrap}>
            <AppIcon name="user" size={18} color="#5C6F86" style={styles.inputInlineIcon} />
            <TextInput
              value={profileNameInput}
              onChangeText={(value) => {
                setProfileNameInput(value);
                setProfileError("");
                setProfileSuccess("");
              }}
              placeholder="Enter your name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              style={[styles.textInput, webTextInputReset]}
            />
          </View>
          <Text style={styles.fieldLabel}>Work Email (optional)</Text>
          <View style={styles.inputWrap}>
            <AppIcon name="mail" size={18} color="#5C6F86" style={styles.inputInlineIcon} />
            <TextInput
              value={profileEmailInput}
              onChangeText={(value) => {
                setProfileEmailInput(value);
                setProfileError("");
                setProfileSuccess("");
              }}
              placeholder="Enter work email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={[styles.textInput, webTextInputReset]}
            />
          </View>
          <PrimaryButton
            label="Update Profile"
            onPress={() => {
              void updateProfile();
            }}
            loading={profileLoading}
          />
        </View>
      </View>,
      "Edit Profile",
      false,
    );

  const InfectionSite = () =>
    appShell(
      <View>
        {dynamicInfectionSites.map((site) => (
          <TouchableOpacity
            key={`${site.code}-${site.label}`}
            activeOpacity={0.86}
            style={styles.listCard}
            onPress={() => openInfectionSite(site)}
          >
            <AppIcon
              name={site.icon}
              size={44}
              color={site.tone}
              style={styles.listIcon}
            />
            <Text style={styles.listText}>{site.label}</Text>
            <AppIcon name="chevron-right" size={22} color={palette.muted} />
          </TouchableOpacity>
        ))}
      </View>,
      "Select Infection Site",
      false,
    );

  const Setting = () =>
    appShell(
      <View>
        <Text style={styles.questionTitle}>
          Where is the patient{"\n"}currently admitted?
        </Text>
        {selectedSettingOptions.map((item) => {
          const isSelected = setting === item;
          const normalizedItem = normalizeMatchText(item);
          const iconName: AppIconName = normalizedItem.includes("icu")
            ? "icu"
            : normalizedItem.includes("opd") || normalizedItem.includes("outpatient")
              ? "clinician"
              : "ward";

          return (
            <TouchableOpacity
              key={item}
              activeOpacity={0.86}
              style={[
                styles.choiceCard,
                isSelected && styles.choiceCardActive,
              ]}
              onPress={() => {
                setSetting(item);
                go(nextScenarioScreen("setting"));
              }}
            >
              <View
                style={[
                  styles.selectionIconBadge,
                  isSelected && styles.selectionIconBadgeActive,
                ]}
              >
                <AppIcon
                  name={iconName}
                  size={36}
                  color={isSelected ? "#FFFFFF" : palette.blue}
                />
              </View>
              <View style={styles.selectionTextBlock}>
                <Text style={styles.choiceText}>{item}</Text>
              </View>
              <View
                style={[
                  styles.selectionRadio,
                  isSelected && styles.selectionRadioActive,
                ]}
              >
                {isSelected ? (
                  <AppIcon name="check" size={13} color="#FFFFFF" />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={styles.noteBox}>
          <AppIcon name="info" size={15} color={palette.blue} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            Your selection helps us suggest the most appropriate empiric
            therapy.
          </Text>
        </View>
      </View>,
      selectedSite.code,
    );

  const Acquisition = () =>
    appShell(
      <View>
        <Text style={styles.questionTitle}>
          What is the acquisition{"\n"}of infection?
        </Text>
        {selectedAcquisitionOptions.map((item) => {
          const isSelected = acquisition === item;
          const normalizedItem = normalizeMatchText(item);
          const isHospitalAcquired = normalizedItem.includes("hospital");
          const isHealthcareAssociated = normalizedItem.includes("healthcare");

          return (
            <TouchableOpacity
              key={item}
              activeOpacity={0.86}
              style={[
                styles.acqCard,
                isSelected && styles.acqCardActive,
              ]}
              onPress={() => {
                setAcquisition(item);
                go(nextScenarioScreen("acquisition"));
              }}
            >
              <View
                style={[
                  styles.selectionIconBadge,
                  isSelected && styles.selectionIconBadgeActive,
                  isHospitalAcquired &&
                    !isSelected &&
                    styles.selectionIconBadgeRed,
                ]}
              >
                <AppIcon
                  name={isHospitalAcquired || isHealthcareAssociated ? "hospital" : "community"}
                  size={36}
                  color={
                    isSelected
                      ? "#FFFFFF"
                      : isHospitalAcquired || isHealthcareAssociated
                        ? palette.red
                        : palette.blue
                  }
                />
              </View>
              <View style={styles.selectionTextBlock}>
                <Text
                  style={[
                    styles.acqTitle,
                    isHospitalAcquired && styles.acqTitleRed,
                  ]}
                >
                  {item}
                </Text>
                <Text style={styles.acqSub}>
                  {isHospitalAcquired || isHealthcareAssociated
                    ? "(Recent hospital exposure)"
                    : "(No recent hospital exposure)"}
                </Text>
              </View>
              <View
                style={[
                  styles.selectionRadio,
                  isSelected && styles.selectionRadioActive,
                ]}
              >
                {isSelected ? (
                  <AppIcon name="check" size={13} color="#FFFFFF" />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={styles.noteBox}>
          <AppIcon name="info" size={15} color={palette.blue} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            Acquisition type is used along with risk factors for final
            recommendation.
          </Text>
        </View>
      </View>,
      `${selectedSite.code} - ${setting}`,
    );

  const RiskSelection = () =>
    appShell(
      <View>
        <Text style={styles.questionTitle}>
          Select the documented{"\n"}risk category
        </Text>
        {selectedRiskOptions.map((item) => {
          const isSelected = fieldMatches(selectedSourceRisk, item);
          const normalizedItem = normalizeMatchText(item);
          const iconName: AppIconName = normalizedItem.includes("high")
            ? "risk-high"
            : normalizedItem.includes("low")
              ? "risk-low"
              : "risk-medium";
          const tone = normalizedItem.includes("high")
            ? palette.red
            : normalizedItem.includes("low")
              ? palette.green
              : palette.orange;

          return (
            <TouchableOpacity
              key={item}
              activeOpacity={0.86}
              style={[
                styles.choiceCard,
                isSelected && styles.choiceCardActive,
              ]}
              onPress={() => {
                setSelectedSourceRisk(item);
                go("protocolResult");
              }}
            >
              <View
                style={[
                  styles.selectionIconBadge,
                  isSelected && styles.selectionIconBadgeActive,
                ]}
              >
                <AppIcon
                  name={iconName}
                  size={36}
                  color={isSelected ? "#FFFFFF" : tone}
                />
              </View>
              <View style={styles.selectionTextBlock}>
                <Text style={styles.choiceText}>{item}</Text>
              </View>
              <View
                style={[
                  styles.selectionRadio,
                  isSelected && styles.selectionRadioActive,
                ]}
              >
                {isSelected ? (
                  <AppIcon name="check" size={13} color="#FFFFFF" />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={styles.noteBox}>
          <AppIcon name="info" size={15} color={palette.blue} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            These categories are shown only when multiple reviewed source
            values exist for the selected infection.
          </Text>
        </View>
      </View>,
      `${selectedSite.code} - ${setting} - ${acquisition}`,
    );

  const Risk = () =>
    appShell(
      <View>
        <Text style={styles.riskHeading}>
          Please answer the following{"\n"}risk assessment questions
        </Text>
        {currentRiskCriteriaLoading ? (
          <ActivityIndicator color={palette.blue} />
        ) : currentRiskCriteriaError ? (
          <View style={[styles.noteBlue, styles.actionAlert]}>
            <Text style={[styles.noteText, styles.actionBodyRed]}>
              {currentRiskCriteriaError}
            </Text>
          </View>
        ) : null}
        {riskCriterionGroups.map((group) => (
          <View key={group.criterionName} style={styles.riskRow}>
            <Text style={styles.riskQuestion}>{group.criterionName}</Text>
            <View style={styles.riskOptionList}>
              {group.options.map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    setRiskAnswers((current) => ({
                      ...current,
                      [group.criterionName]: value,
                    }));
                  }}
                  style={[
                    styles.riskOption,
                    riskAnswers[group.criterionName] === value && styles.toggleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      riskAnswers[group.criterionName] === value && styles.toggleTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <PrimaryButton
          label="View Result"
          onPress={classify}
          disabled={!activeRiskCriteria || currentRiskCriteriaLoading}
        />
      </View>,
      `${selectedSite.code} - ${setting} - ${acquisition}`,
    );

  const Classification = () =>
    appShell(
      <View>
        <View style={styles.classCard}>
          <AppIcon name={riskIconName} size={48} color={riskColor} style={styles.classShield} />
          <View>
            <Text style={[styles.classType, { color: riskColor }]}>
              {riskType?.toUpperCase() ?? "UNCLASSIFIED"}
            </Text>
            <Text style={[styles.classLabel, { color: riskColor }]}>
              {riskLabel}
            </Text>
          </View>
        </View>
        <Text style={styles.classCopy}>
          Based on your responses, the patient falls under {riskLabel} category.
        </Text>
        <Text style={styles.summaryTitle}>Risk Summary</Text>
        {riskCriterionGroups.map((group) => (
          <View key={group.criterionName} style={styles.summaryLineRow}>
            <AppIcon
              name={
                riskAnswers[group.criterionName] === activeRiskCriteria?.[group.criterionName]["1"]
                  ? "check"
                  : "alert"
              }
              size={14}
              color={
                riskAnswers[group.criterionName] === activeRiskCriteria?.[group.criterionName]["1"]
                  ? palette.green
                  : palette.orange
              }
              style={styles.summaryIcon}
            />
            <Text style={styles.summaryLine}>
              {group.criterionName}: {riskAnswers[group.criterionName]}
            </Text>
          </View>
        ))}
        <PrimaryButton
          label="View Protocol Result"
          onPress={() => go("protocolResult")}
        />
      </View>,
      "Risk Classification",
      false,
    );

  const ProtocolResult = () =>
    appShell(
      <View>
        <View style={styles.resultMeta}>
          <Text style={styles.resultMetaText}>
            {selectedScenarioSummary}
          </Text>
          {hasSelectedRisk ? (
            <Text style={[styles.resultMetaRisk, { color: riskColor }]}>
              {selectedRiskDisplay}
            </Text>
          ) : null}
        </View>
        <Text style={styles.resultSection}>Recommended Treatment Protocol</Text>
        {protocolFlowLoading ? (
          <View style={styles.noteBlue}>
            <Text style={styles.noteText}>Loading approved treatment data...</Text>
          </View>
        ) : selectedSourceRecommendations.length === 0 ? (
          <View style={[styles.noteBlue, styles.actionAlert]}>
            <Text style={[styles.noteText, styles.actionBodyRed]}>
              {protocolFlowMessage || failClosedMessage}
            </Text>
          </View>
        ) : (
          <View>
            <ProtocolRecommendationList items={recommendedTreatmentRecommendations} />
            {alternativeTreatmentRecommendations.length > 0 ? (
              <View style={styles.alternativeSection}>
                <Text style={styles.resultSection}>Alternative Options</Text>
                <ProtocolRecommendationList
                  items={alternativeTreatmentRecommendations}
                />
              </View>
            ) : null}
          </View>
        )}
        {canUseProtocolActions ? (
          <PrimaryButton
            label="View Details"
            onPress={() => go("protocolDetails")}
          />
        ) : null}
      </View>,
      "Protocol Result",
      false,
    );

  const ProtocolDetails = () =>
    appShell(
      <View>
        <View style={styles.infoCard}>
          <Text style={styles.detailsTitle}>Clinical Scenario</Text>
          <Text style={styles.infoCardBody}>
            Infection Site: {selectedSite.label}
          </Text>
          {hasSelectedSetting ? (
            <Text style={styles.infoCardBody}>Setting: {setting}</Text>
          ) : null}
          {hasSelectedAcquisition ? (
            <Text style={styles.infoCardBody}>Acquisition: {acquisition}</Text>
          ) : null}
          {hasSelectedRisk ? (
            <Text style={styles.infoCardBody}>
              Risk Level: {selectedRiskDisplay}
            </Text>
          ) : null}
        </View>
        <View>
          <Text style={styles.detailsTitle}>Recommended Treatment Protocol</Text>
          {protocolFlowLoading ? (
            <View style={styles.noteBlue}>
              <Text style={styles.noteText}>Loading approved treatment data...</Text>
            </View>
          ) : selectedSourceRecommendations.length === 0 ? (
            <View style={[styles.noteBlue, styles.actionAlert]}>
              <Text style={[styles.noteText, styles.actionBodyRed]}>
                  {protocolFlowMessage || failClosedMessage}
              </Text>
            </View>
          ) : (
            <View>
              <ProtocolRecommendationList items={recommendedTreatmentRecommendations} />
              {alternativeTreatmentRecommendations.length > 0 ? (
                <View style={styles.alternativeSection}>
                  <Text style={styles.resultSection}>Alternative Options</Text>
                  <ProtocolRecommendationList
                    items={alternativeTreatmentRecommendations}
                  />
                </View>
              ) : null}
            </View>
          )}
        </View>
        {shouldShowStewardshipAlert ? (
          <View style={[styles.noteBlue, styles.actionAlert]}>
            <Text style={[styles.actionTitle, styles.actionTitleRed]}>
              Stewardship Guidance
            </Text>
            <Text style={styles.detailLabel}>Reason</Text>
            <Text style={styles.actionBodyRed}>{stewardshipAlertReason}</Text>
            <Text style={styles.detailLabel}>Recommended action</Text>
            <Text style={styles.actionBodyRed}>{stewardshipAlertAction}</Text>
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.actionButton, styles.actionButtonRed]}
              onPress={() => go("stewardshipAlert")}
            >
              <Text style={styles.actionButtonText}>View Alert</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Review Trigger</Text>
          <Text style={styles.infoCardBody}>
            Reassess duration when cultures, source control, and clinical
            response are available.
          </Text>
        </View>
        {canUseProtocolActions ? (
          <PrimaryButton
            label="Continue to Actions"
            onPress={() => go("actions")}
          />
        ) : null}
      </View>,
      "Protocol Details",
      false,
    );

  const Actions = () =>
    appShell(
      <View>
        {!canUseProtocolActions ? (
          <View style={[styles.noteBlue, styles.actionAlert]}>
            <Text style={[styles.noteText, styles.actionBodyRed]}>
              {protocolFlowMessage || failClosedMessage}
            </Text>
            <PrimaryButton label="Back to Scenario" onPress={() => go("infectionSite")} />
          </View>
        ) : (
          <>
        {actionMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{actionMessage}</Text>
          </View>
        ) : null}
        <View style={styles.actionsGrid}>
          <ActionCard
            title="Save to My Cases"
            description="Save this selected scenario and approved protocol as a case report."
            features={["Securely saved", "Available in My Cases", "Clinical tracking"]}
            buttonLabel="Save Case"
            icon="save"
            variant="primary"
            onPress={saveCurrentCase}
          />
          <ActionCard
            title="Export PDF"
            description="Generate a professional PDF report of this case."
            features={["Print-ready", "Structured report", "Includes protocol & notes"]}
            buttonLabel="Export PDF"
            icon="file"
            variant="primary"
            onPress={() => {
              setSelectedCase(currentCaseSnapshot());
              void exportReportPdf();
            }}
          />
          <ActionCard
            title="Share with Team"
            description="Share this clinical report via WhatsApp, Email, or other apps."
            features={["WhatsApp / Email", "Secure sharing", "Team review"]}
            buttonLabel="Share Report"
            icon="share"
            variant="success"
            onPress={() => {
              setSelectedCase(currentCaseSnapshot());
              go("shareView");
            }}
          />
          <ActionCard
            title="Back to Details"
            description="Return to the clinical details and approved treatment protocol."
            features={["Review details", "Modify inputs", "Return to protocol"]}
            buttonLabel="Back to Details"
            icon="chevron-left"
            variant="secondary"
            onPress={() => go("protocolDetails")}
          />
        </View>
          </>
        )}
      </View>,
      "Actions",
      false,
    );

  const ActionCard = ({
    title,
    description,
    features,
    buttonLabel,
    icon,
    variant = "primary",
    onPress,
  }: {
    title: string;
    description: string;
    features: string[];
    buttonLabel: string;
    icon: AppIconName;
    variant?: "primary" | "success" | "secondary";
    onPress: () => void;
  }) => {
    const accent =
      variant === "success"
        ? palette.green
        : variant === "secondary"
          ? palette.muted
          : palette.blue;

    return (
      <View style={styles.actionCard}>
        <View style={styles.actionCardTop}>
          <View
            style={[
              styles.actionIconBadge,
              { backgroundColor: `${accent}14` },
            ]}
          >
            <AppIcon name={icon} size={28} color={accent} />
          </View>
          <View style={styles.actionTextBlock}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionBody}>{description}</Text>
          </View>
        </View>
        <View style={styles.actionFeatureRow}>
          {features.map((feature) => (
            <Text key={feature} style={styles.actionFeatureChip}>
              {feature}
            </Text>
          ))}
        </View>
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={onPress}
          style={[
            styles.actionButton,
            variant === "success" && styles.actionButtonSuccess,
            variant === "secondary" && styles.actionButtonSecondary,
          ]}
        >
          <Text
            style={[
              styles.actionButtonText,
              variant === "secondary" && styles.actionButtonTextSecondary,
            ]}
          >
            {buttonLabel}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const SavedCases = () =>
    appShell(
      <View>
        {actionMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{actionMessage}</Text>
          </View>
        ) : null}
        {savedCases.length === 0 ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>No saved cases yet</Text>
            <Text style={styles.infoCardBody}>
              Save a selected protocol from Protocol Details to create a case report.
            </Text>
          </View>
        ) : (
          savedCases.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.86}
              style={styles.infoCard}
              onPress={() => openCaseReport(item)}
            >
              <Text style={styles.infoCardTitle}>{item.infectionSite}</Text>
              <Text style={styles.infoCardBody}>
                {item.setting} · {item.acquisition} · {item.riskLevel}
              </Text>
              <Text style={styles.infoCardBody}>
                Saved {formatDateTime(item.savedAt)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>,
      "My Cases",
      false,
    );

  const Reports = () =>
    appShell(
      <View>
        <CaseReportContent reportCase={activeReportCase} />
        {actionMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{actionMessage}</Text>
          </View>
        ) : null}
        <PrimaryButton label="Export PDF" onPress={exportReportPdf} />
        <PrimaryButton label="Share with Team" onPress={() => go("shareView")} />
        <PrimaryButton label="Back to Details" onPress={() => go("protocolDetails")} />
      </View>,
      "Export PDF",
      false,
    );

  const ShareView = () =>
    appShell(
      <View>
        {actionMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{actionMessage}</Text>
          </View>
        ) : null}
        <ShareRow
          title="WhatsApp"
          subtitle="Open WhatsApp with report summary"
          icon="share"
          brandColor="#25D366"
          onPress={openWhatsAppShare}
        />
        <ShareRow
          title="Email"
          subtitle="Create an email with report subject and body"
          icon="mail"
          onPress={openEmailShare}
        />
        <ShareRow
          title="Bluetooth"
          subtitle="Use native sharing where supported"
          icon="share"
          onPress={shareBluetooth}
        />
        <ShareRow
          title="More"
          subtitle="Open native share or copy report text"
          icon="share"
          onPress={() => openNativeShare()}
        />
      </View>,
      "Share with Team",
      false,
    );

  const ShareRow = ({
    title,
    subtitle,
    icon,
    brandColor,
    onPress,
  }: {
    title: string;
    subtitle: string;
    icon: AppIconName;
    brandColor?: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.shareRow}
    >
      <View
        style={[
          styles.shareIconBox,
          brandColor ? { backgroundColor: brandColor } : null,
        ]}
      >
        <AppIcon
          name={icon}
          size={21}
          color={brandColor ? "#FFFFFF" : palette.blue}
        />
      </View>
      <View style={styles.shareTextBlock}>
        <Text style={styles.listText}>{title}</Text>
        <Text style={styles.infoCardBody}>{subtitle}</Text>
      </View>
      <AppIcon name="chevron-right" size={22} color={palette.muted} />
    </TouchableOpacity>
  );

  const CaseReportContent = ({
    reportCase,
  }: {
    reportCase: SavedClinicalCase;
  }) => {
    const reportWarnings = [
      ...reportCase.warningRecommendations.flatMap((item) =>
        [
          item.stewardship_note,
          item.renal_adjustment,
          item.allergy_warning,
          item.contraindication,
        ].filter((value): value is string => Boolean(value && hasMeaningfulText(value))),
      ),
      ...reportCase.consultRecommendations
        .map((item) => item.id_consult_trigger)
        .filter((value): value is string => Boolean(value && hasMeaningfulText(value))),
      reportCase.riskType === "Type 3"
        ? "High-risk case: ID specialist review recommended."
        : "",
    ].filter(Boolean);

    return (
      <View style={styles.reportPreview}>
        <View style={styles.reportHeaderRow}>
          <View>
            <Text style={styles.reportTitle}>
              Hinduja Antibiotic Guide Protocol Report
            </Text>
            <Text style={styles.reportMeta}>
              Generated {formatDateTime(reportCase.savedAt)}
            </Text>
          </View>
          <View style={styles.reportIcon}>
            <AppIcon name="file" size={24} color={palette.red} />
            <Text style={styles.reportIconText}>PDF</Text>
          </View>
        </View>
        <View style={styles.reportSection}>
          <Text style={styles.detailsTitle}>Doctor</Text>
          <Text style={styles.infoCardBody}>
            {reportCase.doctorName || "Doctor not specified"}
          </Text>
          <Text style={styles.infoCardBody}>{reportCase.doctorEmail}</Text>
        </View>
        <View style={styles.reportSection}>
          <Text style={styles.detailsTitle}>Case Summary</Text>
          <Text style={styles.infoCardBody}>
            Infection Site: {reportCase.infectionSite}
          </Text>
          <Text style={styles.infoCardBody}>Setting: {reportCase.setting}</Text>
          <Text style={styles.infoCardBody}>
            Acquisition: {reportCase.acquisition}
          </Text>
          <Text style={styles.infoCardBody}>
            Risk Level: {reportCase.riskLevel}
          </Text>
        </View>
        <View style={styles.reportSection}>
          <Text style={styles.detailsTitle}>Recommended Treatment Protocol</Text>
          {reportCase.recommendations.length === 0 ? (
            <View style={[styles.noteBlue, styles.actionAlert]}>
              <Text style={[styles.noteText, styles.actionBodyRed]}>
                {failClosedMessage}
              </Text>
            </View>
          ) : (
            <ProtocolRecommendationList items={reportCase.recommendations} />
          )}
        </View>
        {reportWarnings.length > 0 ? (
          <View style={styles.reportSection}>
            <Text style={styles.detailsTitle}>Stewardship Guidance</Text>
            {reportWarnings.map((item) => (
              <Text key={item} style={styles.infoCardBody}>
                {item}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.disclaimerBox}>
          <Text style={styles.infoCardBody}>
            For authorized clinical use. Verify with institutional protocol and
            clinical judgment.
          </Text>
        </View>
      </View>
    );
  };

  const StewardshipAlert = () =>
    appShell(
      <View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Stewardship Alert Details</Text>
          {protocolFlowLoading ? (
            <ActivityIndicator color={palette.blue} />
          ) : selectedSourceRecommendations.length === 0 ? (
            <Text style={styles.infoCardBody}>
              {protocolFlowMessage || failClosedMessage}
            </Text>
          ) : !shouldShowStewardshipAlert ? (
            <Text style={styles.infoCardBody}>
              No stewardship alert is triggered for the current approved
              recommendations.
            </Text>
          ) : (
            <View>
              <Text style={styles.detailLabel}>Risk level</Text>
              <Text style={styles.infoCardBody}>{selectedRiskDisplay}</Text>
              <Text style={styles.detailLabel}>Reason for alert</Text>
              <Text style={styles.infoCardBody}>{stewardshipAlertReason}</Text>
              <Text style={styles.detailLabel}>Recommended action</Text>
              <Text style={styles.infoCardBody}>{stewardshipAlertAction}</Text>
              {selectedSourceRecommendations.length > 0 ? (
                <View style={styles.durationRow}>
                  <Text style={styles.detailLabel}>Antibiotics to review</Text>
                  {selectedSourceRecommendations.map((item) => (
                    <Text key={item.id} style={styles.infoCardBody}>
                      {item.drug?.trim()}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>
        <PrimaryButton
          label="View Protocol"
          onPress={() => go("protocolResult")}
        />
      </View>,
      "Stewardship Alert",
      false,
    );

  const renderScreen = () => {
    switch (screen) {
      case "doctorDetails":
        return DoctorDetails();
      case "dashboard":
        return Dashboard();
      case "guidelines":
        return Guidelines();
      case "guidelineSection":
        return GuidelineSection();
      case "duration":
        return Duration();
      case "antibiogram":
        return Antibiogram();
      case "alerts":
        return Alerts();
      case "profile":
        return Profile();
      case "editProfile":
        return EditProfile();
      case "infectionSite":
        return InfectionSite();
      case "setting":
        return Setting();
      case "acquisition":
        return Acquisition();
      case "riskSelection":
        return RiskSelection();
      case "riskAssessment":
        return Risk();
      case "classification":
        return Classification();
      case "protocolResult":
        return ProtocolResult();
      case "protocolDetails":
        return ProtocolDetails();
      case "actions":
        return Actions();
      case "savedCases":
        return SavedCases();
      case "reports":
        return Reports();
      case "shareView":
        return ShareView();
      case "stewardshipAlert":
        return StewardshipAlert();
      case "caseReport":
        return appShell(
          <View>
            <CaseReportContent reportCase={activeReportCase} />
            <PrimaryButton label="Export PDF" onPress={exportReportPdf} />
            <PrimaryButton label="Share with Team" onPress={() => go("shareView")} />
            <PrimaryButton label="Back to Details" onPress={() => go("protocolDetails")} />
          </View>,
          "Case Report",
          false,
        );
    }
  };

  if (!appReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={[styles.loadingScreen, { minHeight: contentMinHeight }]}>
          <ActivityIndicator color={palette.blue} />
          <Text style={styles.infoText}>Loading application...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.stage,
            {
              minHeight: contentMinHeight,
              paddingVertical: width > 600 ? 26 : 10,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.phone,
              { width: phoneWidth },
            ]}
          >
            {renderScreen()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: p.bg },
    keyboard: { flex: 1 },
    stage: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    phone: {
      minHeight: 720,
      borderRadius: 34,
      backgroundColor: p.bg,
      overflow: "hidden",
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.2,
      shadowRadius: 34,
      elevation: 8,
    },
    loadingScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 24,
    },
    inputWrap: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#DDEAF7",
      paddingHorizontal: 14,
      marginBottom: 12,
      backgroundColor: "#FFFFFF",
    },
    inputIcon: { color: "#5C6F86", fontSize: 18, marginRight: 10 },
    inputInlineIcon: { marginRight: 10 },
    textInput: {
      flex: 1,
      width: "100%",
      height: "100%",
      minWidth: 0,
      color: "#0B2850",
      fontSize: 14,
      fontWeight: "400",
      padding: 0,
      margin: 0,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: "transparent",
      elevation: 0,
      includeFontPadding: false,
    },
    errorBox: {
      borderRadius: 8,
      backgroundColor: "#FEE2E2",
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 8,
    },
    errorText: {
      color: p.red,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    successBox: {
      backgroundColor: "#ECFDF5",
      borderColor: "#A7F3D0",
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    successText: {
      color: p.green,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: p.blue,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
      paddingHorizontal: 22,
      paddingVertical: 14,
      shadowColor: p.blue,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 4,
    },
    redButton: { backgroundColor: p.red, shadowColor: p.red },
    disabledButton: { opacity: 0.66 },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      letterSpacing: 0.2,
      textAlign: "center",
    },
    infoBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 9,
      backgroundColor: "#EEF6FF",
      padding: 13,
      marginTop: 26,
    },
    infoIcon: { marginTop: 1 },
    infoText: {
      flex: 1,
      color: "#5C6F86",
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    infoCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      padding: 14,
      marginBottom: 12,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    infoCardTitle: {
      color: p.blue2,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "900",
      marginBottom: 5,
    },
    infoCardBody: {
      color: p.text,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
    },
    profileBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: p.blue,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: 20,
      marginBottom: 10,
    },
    profileInitial: {
      color: "#FFFFFF",
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "900",
    },
    profileName: {
      color: p.text,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "900",
      textAlign: "center",
    },
    profileMeta: {
      color: p.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 18,
    },
    editProfileCard: {
      backgroundColor: p.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      padding: 18,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    editProfileTitle: {
      color: p.blue2,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "900",
      marginBottom: 14,
      textAlign: "center",
    },
    fieldLabel: {
      color: p.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
      marginBottom: 8,
      marginTop: 10,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 34,
    },
    versionText: { color: "#5C6F86", fontSize: 10, fontWeight: "700" },
    offlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#1E9D61",
    },
    dashboardScreen: { flex: 1, minHeight: 720, backgroundColor: p.bg },
    dashboardHeader: {
      minHeight: 82,
      backgroundColor: p.blue,
      paddingHorizontal: 14,
      paddingTop: 22,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTextBlock: {
      flex: 1,
      paddingLeft: 12,
      paddingRight: 2,
    },
    headerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
    headerDoctor: {
      color: "#D7E8FF",
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },
    tabPageTitle: {
      color: p.blue2,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "900",
      marginBottom: 14,
    },
    drawerLayer: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 50,
    },
    drawerBackdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(11, 40, 80, 0.36)",
    },
    drawerPanel: {
      width: "82%",
      maxWidth: 338,
      minHeight: "100%",
      backgroundColor: p.card,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 18,
      paddingTop: 26,
      paddingHorizontal: 16,
      paddingBottom: 22,
      shadowColor: p.shadow,
      shadowOffset: { width: 10, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 22,
      elevation: 22,
    },
    drawerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      marginBottom: 14,
    },
    drawerBadge: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: p.blue,
      alignItems: "center",
      justifyContent: "center",
    },
    drawerBadgeText: {
      color: "#FFFFFF",
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "900",
    },
    drawerIdentity: { flex: 1 },
    drawerTitle: {
      color: p.blue2,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
    },
    drawerName: {
      color: p.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "800",
      marginTop: 2,
    },
    drawerEmail: {
      color: p.muted,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: 1,
    },
    drawerItems: { gap: 8 },
    drawerItem: {
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: "#F8FBFF",
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 12,
    },
    drawerItemDanger: {
      backgroundColor: "#FFF6F6",
      borderColor: "#F5C4C4",
      marginTop: 8,
    },
    drawerItemText: {
      flex: 1,
      color: p.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
    },
    drawerItemTextDanger: { color: p.red },
    drawerFooter: {
      marginTop: 16,
      borderRadius: 8,
      backgroundColor: p.soft,
      padding: 12,
    },
    drawerFooterText: {
      color: p.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
    },
    dashboardBody: { padding: 14, paddingBottom: 112 },
    searchBox: {
      height: 52,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      marginBottom: 18,
    },
    searchIcon: { marginRight: 9 },
    searchText: { color: p.muted, fontSize: 12, fontWeight: "700" },
    searchInput: {
      flex: 1,
      height: "100%",
      color: p.text,
      fontSize: 12,
      fontWeight: "400",
      padding: 0,
      margin: 0,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: "transparent",
    },
    searchResults: { marginTop: -8, marginBottom: 14 },
    searchResultCard: {
      minHeight: 62,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      marginBottom: 8,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    searchResultIcon: {
      width: 34,
      marginRight: 2,
    },
    searchResultTextBlock: { flex: 1 },
    searchResultTitle: {
      color: p.blue2,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "900",
    },
    searchResultSubtitle: {
      color: p.muted,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700",
    },
    searchEmpty: {
      borderRadius: 8,
      backgroundColor: p.soft,
      padding: 12,
      marginBottom: 8,
    },
    searchEmptyText: {
      color: p.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    sectionLabel: {
      color: p.text,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "900",
      marginBottom: 10,
    },
    groupLabel: {
      color: p.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
      textTransform: "uppercase",
      marginTop: 10,
      marginBottom: 8,
    },
    cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
    siteCard: {
      width: "48%",
      minHeight: 116,
      borderRadius: 9,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: "center",
      justifyContent: "center",
      padding: 10,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    siteCardWide: { width: "100%", minHeight: 82 },
    siteIconBadge: {
      width: 66,
      height: 66,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
      borderWidth: 1,
      borderColor: "#E3EEF9",
    },
    siteCardText: {
      color: p.text,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      textAlign: "center",
    },
    bottomTabs: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      minHeight: 78,
      backgroundColor: p.card,
      borderTopWidth: 1,
      borderTopColor: p.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 9,
      paddingTop: 9,
      paddingBottom: Platform.OS === "ios" ? 18 : 10,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 14,
    },
    bottomTab: {
      flex: 1,
      minHeight: 58,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    bottomTabPill: {
      minHeight: 48,
      minWidth: 58,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 7,
      paddingVertical: 5,
      gap: 3,
    },
    bottomTabPillActive: {
      backgroundColor: "#EAF4FF",
    },
    bottomText: {
      color: p.muted,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      textAlign: "center",
    },
    bottomTextActive: { color: p.blue, fontWeight: "900" },
    appScreen: { minHeight: 720, flex: 1, backgroundColor: p.bg },
    topBar: {
      height: 70,
      backgroundColor: p.blue,
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 18,
      paddingHorizontal: 10,
    },
    topIcon: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    topIconSpacer: {
      width: 42,
      height: 42,
    },
    topIconText: {
      color: "#FFFFFF",
      fontSize: 31,
      lineHeight: 34,
      fontWeight: "500",
    },
    topTitle: {
      flex: 1,
      color: "#FFFFFF",
      textAlign: "center",
      fontSize: 14,
      fontWeight: "900",
    },
    progress: {
      height: 18,
      backgroundColor: p.blue,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 34,
    },
    progressLine: {
      flex: 1,
      height: 2,
      backgroundColor: "#A8C8F0",
      marginHorizontal: 2,
    },
    progressLineFill: { backgroundColor: "#FFFFFF" },
    screenBody: { padding: 16, paddingBottom: 30 },
    listCard: {
      minHeight: 70,
      borderRadius: 8,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.border,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 12,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    listIcon: { width: 48 },
    guidelineIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#EAF4FF",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    guidelineIconBadgeLarge: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#EAF4FF",
      alignItems: "center",
      justifyContent: "center",
    },
    listTextBlock: {
      flex: 1,
      gap: 3,
    },
    listText: {
      flex: 1,
      color: p.blue2,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
    },
    listSubText: {
      color: p.muted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
    },
    chevron: { color: p.muted, fontSize: 25, fontWeight: "900" },
    guidelineHero: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      padding: 14,
      marginBottom: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    guidelineRow: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 10,
      marginTop: 10,
      gap: 7,
    },
    questionTitle: {
      color: p.text,
      textAlign: "center",
      fontSize: 19,
      lineHeight: 27,
      fontWeight: "900",
      marginVertical: 22,
    },
    choiceCard: {
      height: 106,
      borderRadius: 9,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 15,
      flexDirection: "row",
      gap: 14,
      paddingHorizontal: 18,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    choiceCardActive: {
      borderColor: p.blue,
      backgroundColor: p.soft,
    },
    selectionIconBadge: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.soft,
      borderWidth: 1,
      borderColor: p.border,
    },
    selectionIconBadgeActive: {
      backgroundColor: p.blue,
      borderColor: p.blue,
    },
    selectionIconBadgeRed: {
      backgroundColor: p.soft,
      borderColor: p.border,
    },
    selectionTextBlock: { flex: 1 },
    selectionRadio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: p.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.card,
    },
    selectionRadioActive: {
      backgroundColor: p.blue,
      borderColor: p.blue,
    },
    choiceText: {
      color: p.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "900",
    },
    noteBox: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: p.soft,
      borderRadius: 8,
      padding: 13,
      marginTop: 24,
    },
    noteIcon: { marginTop: 1 },
    noteText: {
      flex: 1,
      color: p.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
    },
    acqCard: {
      minHeight: 86,
      borderRadius: 8,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 18,
      marginBottom: 16,
    },
    acqCardActive: {
      borderColor: p.blue,
      backgroundColor: p.soft,
    },
    acqTitle: {
      color: p.blue2,
      fontSize: 17,
      lineHeight: 23,
      fontWeight: "900",
    },
    acqTitleRed: { color: p.red },
    acqSub: { color: p.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" },
    riskHeading: {
      color: p.text,
      textAlign: "center",
      fontSize: 18,
      lineHeight: 25,
      fontWeight: "900",
      marginBottom: 18,
    },
    riskRow: {
      minHeight: 58,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      gap: 8,
      paddingVertical: 10,
    },
    riskQuestion: {
      color: p.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
    },
    riskOptionList: {
      gap: 8,
    },
    riskOption: {
      minHeight: 40,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.soft,
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    toggle: {
      flexDirection: "row",
      borderRadius: 5,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: p.border,
    },
    toggleOption: {
      width: 52,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.soft,
    },
    toggleActive: { backgroundColor: p.card },
    toggleText: { color: p.text, fontSize: 12, fontWeight: "800" },
    toggleTextActive: { color: p.blue },
    classCard: {
      minHeight: 148,
      borderRadius: 8,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 22,
      marginBottom: 20,
    },
    classShield: { width: 58 },
    classType: { fontSize: 27, lineHeight: 34, fontWeight: "900" },
    classLabel: { fontSize: 17, lineHeight: 24, fontWeight: "900" },
    classCopy: {
      color: p.text,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
      marginBottom: 18,
    },
    summaryTitle: {
      color: p.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
      marginBottom: 8,
    },
    summaryLine: {
      flex: 1,
      color: p.text,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
    },
    summaryLineRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 7,
    },
    summaryIcon: { marginTop: 2 },
    resultMeta: {
      backgroundColor: "#FFF7ED",
      borderRadius: 7,
      padding: 11,
      marginBottom: 13,
    },
    resultMetaText: {
      color: p.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "900",
    },
    resultMetaRisk: { fontSize: 12, lineHeight: 17, fontWeight: "900" },
    resultSection: {
      color: p.text,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "900",
      marginBottom: 8,
    },
    alternativeSection: {
      marginTop: 8,
    },
    protocolBadge: {
      alignSelf: "flex-start",
      borderRadius: 999,
      backgroundColor: "#EAF2FF",
      borderWidth: 1,
      borderColor: "#CFE1FF",
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 9,
    },
    protocolBadgeText: {
      color: p.blue2,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.2,
    },
    protocolOptionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 2,
    },
    protocolOptionTitle: {
      color: p.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "900",
    },
    protocolDrugHeader: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 7,
    },
    protocolDrugBlock: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#EEF3F9",
      backgroundColor: "#FBFDFF",
      paddingHorizontal: 10,
      paddingVertical: 9,
      gap: 7,
    },
    orDivider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginVertical: 7,
    },
    orDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: "#CFE1FF",
    },
    orDividerText: {
      color: p.blue2,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    andConnector: {
      alignSelf: "center",
      borderRadius: 999,
      backgroundColor: "#FFF7ED",
      borderWidth: 1,
      borderColor: "#FED7AA",
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 7,
    },
    andConnectorText: {
      color: p.orange,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    optionalBadge: {
      borderRadius: 999,
      backgroundColor: "#ECFDF5",
      borderWidth: 1,
      borderColor: "#BBF7D0",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    optionalBadgeText: {
      color: p.green,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    therapyCard: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 13,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 8,
    },
    therapyBody: {
      flex: 1,
      gap: 7,
    },
    therapyIconBadge: {
      width: 34,
      alignItems: "center",
      gap: 4,
    },
    rank: {
      width: 22,
      height: 22,
      borderRadius: 11,
      overflow: "hidden",
      backgroundColor: p.orange,
      color: "#FFFFFF",
      textAlign: "center",
      lineHeight: 22,
      fontSize: 11,
      fontWeight: "900",
    },
    therapyName: {
      color: "#A83D26",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
    },
    recommendationGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    recommendationField: {
      minWidth: "47%",
      flexGrow: 1,
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 7,
      gap: 2,
    },
    recommendationFieldLabel: {
      color: p.muted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    recommendationFieldValue: {
      color: p.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    amaTableCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      padding: 14,
      marginBottom: 12,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    guidelineSearchCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      padding: 14,
      marginBottom: 12,
    },
    guidelineSearchInput: {
      minHeight: 44,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.soft,
      color: p.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      paddingHorizontal: 12,
      marginTop: 10,
    },
    amaTableHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8,
    },
    amaTableTitle: {
      flex: 1,
      color: p.blue2,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "900",
    },
    amaRoleBadge: {
      overflow: "hidden",
      borderRadius: 999,
      backgroundColor: "#EAF4FF",
      color: p.blue2,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    amaSourceMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    amaSourceMetaText: {
      color: p.muted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "800",
    },
    durationRow: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 10,
      marginTop: 10,
    },
    durationCard: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 11,
      marginTop: 11,
      gap: 7,
    },
    durationValue: {
      color: p.blue2,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "900",
    },
    durationTreatmentRow: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 9,
      marginTop: 4,
      gap: 6,
    },
    antibiogramFilterGroup: {
      marginTop: 10,
    },
    antibiogramFilterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    antibiogramFilterChip: {
      minHeight: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.soft,
      justifyContent: "center",
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    antibiogramFilterChipSelected: {
      borderColor: p.blue,
      backgroundColor: "#EAF4FF",
    },
    antibiogramFilterChipText: {
      color: p.muted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "900",
    },
    antibiogramFilterChipTextSelected: {
      color: p.blue2,
    },
    antibiogramMiniGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    antibiogramMiniCell: {
      minWidth: "30%",
      flexGrow: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#E6EEF7",
      backgroundColor: "#FBFDFF",
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    antibiogramPathogenCard: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 12,
      marginTop: 12,
      gap: 8,
    },
    sensitivityGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    sensitivityChip: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#DCE6F2",
      backgroundColor: "#FFFFFF",
      paddingHorizontal: 9,
      paddingVertical: 7,
      maxWidth: "100%",
    },
    sensitivityDrug: {
      color: p.text,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
    },
    sensitivityValue: {
      color: p.blue2,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
      marginTop: 2,
    },
    antibiogramCriteriaRow: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 10,
      marginTop: 10,
    },
    therapyDose: {
      color: p.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    detailLabel: {
      color: p.text,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "900",
      marginTop: 10,
    },
    detailText: {
      color: p.text,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 5,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginTop: 8,
      marginBottom: 14,
    },
    pill: {
      color: p.text,
      backgroundColor: p.soft,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      fontSize: 11,
      fontWeight: "800",
    },
    alertStrip: {
      borderRadius: 8,
      backgroundColor: "#FEE2E2",
      padding: 12,
      marginBottom: 12,
    },
    alertStripText: { color: p.red, fontSize: 12, fontWeight: "900" },
    tabsRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      marginBottom: 18,
    },
    tabButton: { flex: 1 },
    tabText: {
      flex: 1,
      color: p.muted,
      fontSize: 11,
      lineHeight: 28,
      fontWeight: "800",
      textAlign: "center",
    },
    tabActive: {
      color: p.blue,
      borderBottomWidth: 2,
      borderBottomColor: p.blue,
    },
    detailsTitle: {
      color: p.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "900",
    },
    detailsSub: {
      color: p.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
      marginTop: 10,
      marginBottom: 10,
    },
    table: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: p.card,
    },
    tableHeader: {
      height: 42,
      backgroundColor: p.soft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
    },
    tableHeadText: { color: p.text, fontSize: 11, fontWeight: "900" },
    tableRow: {
      minHeight: 41,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    tableDrug: { flex: 1, color: p.text, fontSize: 12, fontWeight: "700" },
    tableValue: { color: p.text, fontSize: 12, fontWeight: "800" },
    noteBlue: {
      backgroundColor: p.soft,
      borderRadius: 8,
      padding: 13,
      marginTop: 14,
      marginBottom: 18,
    },
    actionsGrid: { gap: 12 },
    successBanner: {
      borderRadius: 8,
      backgroundColor: "#EAF8F0",
      borderWidth: 1,
      borderColor: "#BDE8CF",
      padding: 12,
      marginTop: 10,
      marginBottom: 14,
    },
    successBannerText: {
      color: p.green,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "900",
    },
    actionCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "#DCE6F2",
      backgroundColor: p.card,
      padding: 14,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 2,
    },
    actionAlert: { borderColor: "#F5C4C4", backgroundColor: "#FFF1F1" },
    actionCardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    actionIconBadge: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    actionTextBlock: {
      flex: 1,
    },
    actionTitle: {
      color: p.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
    },
    actionTitleRed: { color: p.red },
    actionIcon: {
      marginBottom: 8,
    },
    actionBody: {
      color: p.muted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 3,
    },
    actionBodyRed: { color: p.red, fontWeight: "900" },
    actionFeatureRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginTop: 12,
      marginBottom: 12,
    },
    actionFeatureChip: {
      overflow: "hidden",
      borderRadius: 999,
      backgroundColor: "#F3F7FC",
      color: p.muted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    actionButton: {
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: p.blue,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 10,
      shadowColor: p.blue,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 3,
    },
    actionButtonSuccess: {
      backgroundColor: p.green,
      shadowColor: p.green,
    },
    actionButtonSecondary: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#C8D8EA",
      shadowOpacity: 0,
      elevation: 0,
    },
    actionButtonRed: { backgroundColor: p.red, shadowColor: p.red },
    actionButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      letterSpacing: 0.2,
      textAlign: "center",
    },
    actionButtonTextSecondary: {
      color: p.blue2,
    },
    reportPreview: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      padding: 18,
      marginBottom: 18,
    },
    reportHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 14,
    },
    reportSection: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 12,
      marginTop: 12,
      gap: 5,
    },
    reportTitle: {
      color: p.blue2,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
    },
    reportBody: {
      color: p.text,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "800",
      marginTop: 8,
    },
    reportMeta: {
      color: p.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 5,
    },
    reportIcon: {
      width: 56,
      height: 64,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: p.red,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    reportIconText: {
      color: p.red,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
    },
    disclaimerBox: {
      borderRadius: 8,
      backgroundColor: p.soft,
      padding: 12,
      marginTop: 14,
    },
    shareRow: {
      minHeight: 76,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      gap: 12,
    },
    shareIconBox: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#EAF4FF",
      alignItems: "center",
      justifyContent: "center",
    },
    shareTextBlock: {
      flex: 1,
    },
  });
