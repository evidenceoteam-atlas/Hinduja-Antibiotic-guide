import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { isSupabaseConfigured, supabase } from "./supabase";

type Screen =
  | "login"
  | "signup"
  | "otp"
  | "dashboard"
  | "guidelines"
  | "duration"
  | "alerts"
  | "profile"
  | "infectionSite"
  | "setting"
  | "acquisition"
  | "riskAssessment"
  | "classification"
  | "protocolResult"
  | "protocolDetails"
  | "actions"
  | "savedCases"
  | "reports"
  | "qrView"
  | "shareView"
  | "stewardshipAlert";

type RiskType = "Type 1" | "Type 2" | "Type 3";

type InfectionSite = {
  code: string;
  label: string;
  icon: string;
  tone: string;
};

type TherapyOption = {
  rank: number;
  name: string;
  dose: string;
};

type ProtocolProfile = {
  therapies: Record<RiskType, TherapyOption[]>;
  duration: string;
  coverage: string[];
  notes: string[];
  warnings: string[];
  idConsult: string[];
};

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  site: InfectionSite;
  target: "setting" | "protocolResult" | "protocolDetails";
  riskType?: RiskType;
  detailTab?: ProtocolDetailTab;
  keywords: string;
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
    icon: "♢",
    tone: "#D9267D",
  },
  {
    code: "UTI",
    label: "Urinary Tract Infection (UTI)",
    icon: "♧",
    tone: "#2563EB",
  },
  {
    code: "RTI",
    label: "Respiratory Tract Infection (RTI)",
    icon: "♧",
    tone: "#0284C7",
  },
  {
    code: "IAI",
    label: "Intra-abdominal Infection",
    icon: "⊂",
    tone: "#DC5656",
  },
  { code: "CNS", label: "CNS Infection", icon: "◎", tone: "#1698B8" },
  {
    code: "SSTI",
    label: "Skin & Soft Tissue Infection (SSTI)",
    icon: "⊗",
    tone: "#2BAA72",
  },
  { code: "FN", label: "Febrile Neutropenia", icon: "◊", tone: "#7C3AED" },
];

const questions = [
  "Hospital contact in last 90 days?",
  "Recent antibiotics (oral/IV) in last 90 days?",
  "Invasive device/procedure in last 90 days?",
  "More than 2 antibiotics in last 90 days?",
  "More than 2 comorbidities or immunodeficiency?",
];

type BottomTab = "Home" | "Guidelines" | "Duration" | "Alerts" | "Profile";
type ProtocolDetailTab = "Notes" | "Warnings" | "ID Consult";
type AuthChannel = "email" | "phone";

type OtpTarget = {
  channel: AuthChannel;
  value: string;
};

const bottomTabs: BottomTab[] = [
  "Home",
  "Guidelines",
  "Duration",
  "Alerts",
  "Profile",
];

const tabRoutes: Record<BottomTab, Screen> = {
  Home: "dashboard",
  Guidelines: "guidelines",
  Duration: "duration",
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

const protocolProfiles: Record<string, ProtocolProfile> = {
  BSI: {
    therapies: {
      "Type 1": [
        { rank: 1, name: "Ceftriaxone", dose: "2 g IV q24h" },
        { rank: 2, name: "Ampicillin-Sulbactam", dose: "3 g IV q6h" },
      ],
      "Type 2": [
        { rank: 1, name: "Piperacillin-Tazobactam", dose: "4.5 g IV q6h" },
        { rank: 2, name: "Cefoperazone-Sulbactam", dose: "3 g IV q12h" },
      ],
      "Type 3": [
        { rank: 1, name: "Meropenem", dose: "1 g IV q8h" },
        { rank: 2, name: "Vancomycin", dose: "15-20 mg/kg IV q12h" },
      ],
    },
    duration: "Uncomplicated bacteremia: 7-14 days after source control",
    coverage: ["Enterobacterales", "Staphylococcus aureus", "Streptococci"],
    notes: [
      "Obtain two blood culture sets before antibiotics where feasible.",
      "Review culture and source control status within 48-72 hours.",
    ],
    warnings: [
      "Escalate early if septic shock, persistent fever, or suspected catheter-related infection.",
      "Monitor renal function with glycopeptides and aminoglycosides.",
    ],
    idConsult: [
      "Request ID review for Staphylococcus aureus bacteremia or persistent positive cultures.",
      "Discuss catheter removal, echocardiography need, and de-escalation plan.",
    ],
  },
  UTI: {
    therapies: {
      "Type 1": [
        { rank: 1, name: "Ceftriaxone", dose: "1 g IV q24h" },
        { rank: 2, name: "Amikacin", dose: "15 mg/kg IV q24h" },
      ],
      "Type 2": [
        { rank: 1, name: "Cefoperazone-Sulbactam", dose: "3 g IV q12h" },
        { rank: 2, name: "Piperacillin-Tazobactam", dose: "4.5 g IV q6h" },
      ],
      "Type 3": [
        { rank: 1, name: "Meropenem", dose: "1 g IV q8h" },
        { rank: 2, name: "Imipenem", dose: "500 mg IV q6h" },
      ],
    },
    duration: "Pyelonephritis / urosepsis: 10-14 days",
    coverage: ["E. coli", "Klebsiella spp.", "Proteus spp.", "Enterococcus"],
    notes: [
      "Send urine culture before antibiotics and de-escalate based on susceptibility.",
      "Assess obstruction, catheter status, and need for source control.",
    ],
    warnings: [
      "Avoid nephrotoxic combinations when renal function is impaired.",
      "Carbapenem use should trigger stewardship review in low-risk cases.",
    ],
    idConsult: [
      "Consult ID for recurrent ESBL UTI, septic shock, or complicated urinary source.",
      "Review oral step-down options after clinical stabilization.",
    ],
  },
  RTI: {
    therapies: {
      "Type 1": [
        {
          rank: 1,
          name: "Ceftriaxone + Azithromycin",
          dose: "2 g IV q24h + 500 mg q24h",
        },
        { rank: 2, name: "Amoxicillin-Clavulanate", dose: "1.2 g IV q8h" },
      ],
      "Type 2": [
        { rank: 1, name: "Piperacillin-Tazobactam", dose: "4.5 g IV q6h" },
        { rank: 2, name: "Cefoperazone-Sulbactam", dose: "3 g IV q12h" },
      ],
      "Type 3": [
        {
          rank: 1,
          name: "Meropenem + Azithromycin",
          dose: "1 g IV q8h + 500 mg q24h",
        },
        {
          rank: 2,
          name: "Add Vancomycin if MRSA risk",
          dose: "15-20 mg/kg IV q12h",
        },
      ],
    },
    duration: "Pneumonia: 5-7 days if clinically stable",
    coverage: [
      "S. pneumoniae",
      "H. influenzae",
      "Atypicals",
      "Gram-negative bacilli",
    ],
    notes: [
      "Assess oxygen requirement, aspiration risk, and radiology before escalation.",
      "Collect sputum and blood cultures in severe disease.",
    ],
    warnings: [
      "Avoid unnecessary dual atypical coverage.",
      "Review QT risk when using macrolides or fluoroquinolones.",
    ],
    idConsult: [
      "Consult ID for ventilator-associated pneumonia, MDR risk, or non-resolving pneumonia.",
      "Discuss de-escalation after respiratory culture results.",
    ],
  },
  IAI: {
    therapies: {
      "Type 1": [
        {
          rank: 1,
          name: "Ceftriaxone + Metronidazole",
          dose: "2 g IV q24h + 500 mg IV q8h",
        },
        { rank: 2, name: "Amoxicillin-Clavulanate", dose: "1.2 g IV q8h" },
      ],
      "Type 2": [
        { rank: 1, name: "Piperacillin-Tazobactam", dose: "4.5 g IV q6h" },
        {
          rank: 2,
          name: "Cefoperazone-Sulbactam + Metronidazole",
          dose: "3 g IV q12h + 500 mg q8h",
        },
      ],
      "Type 3": [
        { rank: 1, name: "Meropenem", dose: "1 g IV q8h" },
        {
          rank: 2,
          name: "Add Vancomycin if enterococcal risk",
          dose: "15-20 mg/kg IV q12h",
        },
      ],
    },
    duration:
      "Intra-abdominal infection: 4-7 days after adequate source control",
    coverage: ["Enterobacterales", "Anaerobes", "Enterococcus", "Streptococci"],
    notes: [
      "Source control is essential; coordinate surgical or radiology intervention early.",
      "Reassess antibiotics after operative findings and cultures.",
    ],
    warnings: [
      "Prolonged therapy without source control is unlikely to succeed.",
      "Monitor for C. difficile risk with broad anaerobic coverage.",
    ],
    idConsult: [
      "Consult ID for tertiary peritonitis, resistant organisms, or failed source control.",
      "Discuss antifungal need only when risk factors are present.",
    ],
  },
  CNS: {
    therapies: {
      "Type 1": [
        {
          rank: 1,
          name: "Ceftriaxone + Vancomycin",
          dose: "2 g IV q12h + 15-20 mg/kg q12h",
        },
        {
          rank: 2,
          name: "Add Acyclovir if encephalitis suspected",
          dose: "10 mg/kg IV q8h",
        },
      ],
      "Type 2": [
        {
          rank: 1,
          name: "Ceftriaxone + Vancomycin + Ampicillin",
          dose: "2 g q12h + 15-20 mg/kg q12h + 2 g q4h",
        },
        { rank: 2, name: "Acyclovir", dose: "10 mg/kg IV q8h when indicated" },
      ],
      "Type 3": [
        {
          rank: 1,
          name: "Meropenem + Vancomycin",
          dose: "2 g IV q8h + 15-20 mg/kg q12h",
        },
        {
          rank: 2,
          name: "Add Acyclovir",
          dose: "10 mg/kg IV q8h if encephalitis possible",
        },
      ],
    },
    duration: "Meningitis: organism-directed, commonly 10-21 days",
    coverage: [
      "S. pneumoniae",
      "N. meningitidis",
      "Listeria",
      "Gram-negative bacilli",
    ],
    notes: [
      "Do not delay antibiotics for lumbar puncture in unstable patients.",
      "Use CNS-penetrating doses and review CSF findings urgently.",
    ],
    warnings: [
      "Check renal function for vancomycin and acyclovir dosing.",
      "Urgent escalation needed for altered sensorium, seizures, or shock.",
    ],
    idConsult: [
      "Mandatory ID consult for suspected meningitis, encephalitis, or healthcare-associated CNS infection.",
      "Discuss adjunctive steroids and pathogen-directed duration.",
    ],
  },
  SSTI: {
    therapies: {
      "Type 1": [
        { rank: 1, name: "Cefazolin", dose: "2 g IV q8h" },
        { rank: 2, name: "Amoxicillin-Clavulanate", dose: "1.2 g IV q8h" },
      ],
      "Type 2": [
        { rank: 1, name: "Cefoperazone-Sulbactam", dose: "3 g IV q12h" },
        {
          rank: 2,
          name: "Clindamycin",
          dose: "600 mg IV q8h if toxin concern",
        },
      ],
      "Type 3": [
        {
          rank: 1,
          name: "Piperacillin-Tazobactam + Vancomycin",
          dose: "4.5 g IV q6h + 15-20 mg/kg q12h",
        },
        {
          rank: 2,
          name: "Meropenem + Clindamycin",
          dose: "1 g IV q8h + 600 mg IV q8h",
        },
      ],
    },
    duration:
      "SSTI: 5-10 days; extend if necrotizing infection or poor source control",
    coverage: [
      "Streptococci",
      "MSSA/MRSA risk",
      "Anaerobes",
      "Gram-negative bacilli",
    ],
    notes: [
      "Assess abscess, necrotizing features, diabetic foot, and need for drainage.",
      "Mark margins and reassess clinical response within 24-48 hours.",
    ],
    warnings: [
      "Urgent surgical review for pain out of proportion, bullae, crepitus, or shock.",
      "Avoid broad Gram-negative coverage for uncomplicated cellulitis.",
    ],
    idConsult: [
      "Consult ID for necrotizing infection, diabetic foot, MRSA risk, or failed oral therapy.",
      "Discuss debridement timing and culture-directed narrowing.",
    ],
  },
  FN: {
    therapies: {
      "Type 1": [
        { rank: 1, name: "Cefepime", dose: "2 g IV q8h" },
        { rank: 2, name: "Piperacillin-Tazobactam", dose: "4.5 g IV q6h" },
      ],
      "Type 2": [
        { rank: 1, name: "Piperacillin-Tazobactam", dose: "4.5 g IV q6h" },
        { rank: 2, name: "Add Amikacin if unstable", dose: "15 mg/kg IV q24h" },
      ],
      "Type 3": [
        { rank: 1, name: "Meropenem", dose: "1 g IV q8h" },
        {
          rank: 2,
          name: "Add Vancomycin if catheter/MRSA risk",
          dose: "15-20 mg/kg IV q12h",
        },
      ],
    },
    duration:
      "Febrile neutropenia: until afebrile, clinically stable, and ANC recovery plan defined",
    coverage: [
      "Pseudomonas",
      "Enterobacterales",
      "Staphylococci",
      "Fungal risk when prolonged",
    ],
    notes: [
      "Administer empiric antibiotics within 60 minutes of presentation.",
      "Risk-stratify with neutrophil count, expected duration, and hemodynamic status.",
    ],
    warnings: [
      "Do not delay therapy while awaiting cultures.",
      "Add antifungal therapy only for persistent fever with prolonged neutropenia risk.",
    ],
    idConsult: [
      "Early ID consult is recommended for high-risk neutropenia or persistent fever.",
      "Discuss antifungal triggers, catheter management, and de-escalation plan.",
    ],
  },
};

const drugDoseMap: Record<string, string> = {
  Amikacin: "15 mg/kg IV q24h",
  "Amoxicillin-Clavulanate": "1.2 g IV q8h",
  "Ampicillin-Sulbactam": "3 g IV q6h",
  Azithromycin: "500 mg OD",
  Cefazolin: "2 g IV q8h",
  Cefepime: "2 g IV q8h",
  "Cefoperazone-Sulbactam": "3 g IV q12h",
  "Cefoperazone-Sulbactam + Metronidazole": "3 g IV q12h + 500 mg IV q8h",
  Ceftazidime: "2 g IV q8h",
  "Ceftazidime-Avibactam + Aztreonam": "ID-guided CRE regimen",
  Ceftriaxone: "1-2 g IV q24h",
  "Ceftriaxone + Azithromycin": "1 g IV q12h + 500 mg OD",
  "Ceftriaxone + Metronidazole": "2 g IV q24h + 500 mg IV q8h",
  Clindamycin: "600-900 mg IV q8h",
  "Colistin +/- IV Fosfomycin":
    "Colistin 9 MU LD then 4.5 MU q12h +/- fosfomycin 12-16 g/day",
  "Doxycycline/Macrolide": "Doxycycline 100 mg BD or macrolide",
  Imipenem: "500 mg IV q6h",
  Linezolid: "600 mg BD",
  Metronidazole: "500 mg IV q8h",
  Meropenem: "1 g IV q8h",
  "Meropenem + Vancomycin":
    "Meropenem 2 g IV q8h + vancomycin target trough 15-20 mcg/mL",
  "Piperacillin-Tazobactam": "4.5 g IV q6-8h",
  "Piperacillin-Tazobactam + Vancomycin":
    "4.5 g IV q6h + 15-20 mg/kg IV q8-12h",
  "Polymyxin-based combination therapy":
    "Polymyxin B 15 lakh unit LD then 5 lakh units q8h; ID-guided combination",
  Vancomycin: "25-30 mg/kg LD then 15 mg/kg IV q8-12h",
};

const makeTherapies = (names: string[]): TherapyOption[] =>
  names.map((name, index) => ({
    rank: index + 1,
    name,
    dose:
      drugDoseMap[name] ?? "Refer hospital protocol dosing / renal adjustment",
  }));

const mapTherapies = (
  type1: string[],
  type2: string[],
  type3: string[],
): Record<RiskType, TherapyOption[]> => ({
  "Type 1": makeTherapies(type1),
  "Type 2": makeTherapies(type2),
  "Type 3": makeTherapies(type3),
});

const profileKey = (
  code: string,
  selectedSetting: string,
  selectedAcquisition: string,
) => `${code}|${selectedSetting}|${selectedAcquisition}`;

const contextualProtocolProfiles: Record<string, ProtocolProfile> = {
  [profileKey("BSI", "ICU", "Community-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Imipenem", "Meropenem"],
      [
        "Ceftazidime-Avibactam + Aztreonam",
        "Polymyxin-based combination therapy",
      ],
    ),
    duration:
      "BSI / CRBSI: 10-14 days; longer if endocarditis, persistent bacteremia, or source control delay",
    coverage: [
      "E. coli",
      "Klebsiella pneumoniae",
      "Pseudomonas spp.",
      "Enterococcus spp.",
      "Staphylococcus aureus",
    ],
    notes: [
      "PDF local antibiogram: BSI ICU community-acquired pathway.",
      "Send blood cultures before antibiotics and reassess after 48-72 hours.",
    ],
    warnings: [
      "Ceftazidime-avibactam + aztreonam recommendation is committee/ID guided where susceptibility data are insufficient.",
      "Use loading dose in sepsis or septic shock regardless of renal dysfunction.",
    ],
    idConsult: [
      "ID consult advised for CRE/MDR concern, persistent bacteremia, S. aureus bacteremia, or Type 3 risk.",
      "Discuss source control, de-escalation, and duration after cultures.",
    ],
  },
  [profileKey("BSI", "ICU", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      [
        "Ceftazidime-Avibactam + Aztreonam",
        "Polymyxin-based combination therapy",
      ],
      [
        "Ceftazidime-Avibactam + Aztreonam",
        "Polymyxin-based combination therapy",
      ],
    ),
    duration:
      "Hospital-acquired BSI: 10-14 days after clearance/source control; organism-directed longer courses when indicated",
    coverage: [
      "E. coli",
      "Klebsiella pneumoniae",
      "Pseudomonas spp.",
      "Acinetobacter baumannii",
      "Enterococcus spp.",
      "Staphylococcus aureus",
    ],
    notes: [
      "PDF local antibiogram: BSI ICU hospital-acquired pathway.",
      "Review devices/lines and remove infected catheter where appropriate.",
    ],
    warnings: [
      "Hospital-acquired ICU BSI has high MDR/CRE concern; avoid static low-risk regimens.",
      "Monitor renal function and antimicrobial levels for glycopeptides/polymyxins.",
    ],
    idConsult: [
      "Same-day ID/stewardship review recommended for ICU hospital-acquired BSI.",
      "Discuss CRE strategy, catheter management, repeat cultures, and de-escalation.",
    ],
  },
  [profileKey("BSI", "Ward", "Community-acquired")]: {
    therapies: mapTherapies(
      ["Ceftriaxone", "Cefoperazone-Sulbactam"],
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      [
        "Cefoperazone-Sulbactam",
        "Piperacillin-Tazobactam",
        "Imipenem",
        "Meropenem",
      ],
    ),
    duration:
      "Ward community BSI: 7-14 days after source control and first negative culture where applicable",
    coverage: [
      "Salmonella group",
      "E. coli",
      "Klebsiella pneumoniae",
      "Staphylococcus aureus",
      "Streptococcus pneumoniae",
    ],
    notes: [
      "PDF local antibiogram: BSI wards community-acquired pathway.",
      "If urinary source is suspected, use the UTI-specific protocol branch.",
    ],
    warnings: [
      "Do not treat likely contaminants unless repeated cultures support true BSI.",
      "Avoid tigecycline for BSI due to poor bloodstream exposure.",
    ],
    idConsult: [
      "ID consult for S. aureus BSI, endocarditis suspicion, persistent fever, or Type 3 risk.",
      "Discuss repeat blood cultures and oral step-down only when appropriate.",
    ],
  },
  [profileKey("BSI", "Ward", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Meropenem", "Imipenem"],
      [
        "Polymyxin-based combination therapy",
        "Ceftazidime-Avibactam + Aztreonam",
      ],
    ),
    duration:
      "Ward hospital-acquired BSI: 10-14 days; tailor after cultures and source control",
    coverage: [
      "E. coli",
      "Klebsiella pneumoniae",
      "Pseudomonas aeruginosa",
      "Enterococcus spp.",
      "Staphylococcus aureus",
    ],
    notes: [
      "PDF local antibiogram: BSI wards hospital-acquired pathway.",
      "Assess hospital exposure, invasive device history, and prior antibiotics.",
    ],
    warnings: [
      "Colistin resistance was reported in Klebsiella isolates in the local guide.",
      "Reserve CZA/aztreonam or polymyxin combinations for MDR/CRE risk with ID input.",
    ],
    idConsult: [
      "ID review for Type 3, suspected CRE, catheter-related BSI, or treatment failure.",
      "Discuss escalation/de-escalation after susceptibility results.",
    ],
  },
  [profileKey("UTI", "ICU", "Community-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Cefoperazone-Sulbactam", "Meropenem", "Imipenem"],
      ["Colistin +/- IV Fosfomycin", "Ceftazidime-Avibactam + Aztreonam"],
    ),
    duration:
      "Urosepsis / pyelonephritis: 10-14 days; emphysematous PN/perinephric abscess 3-4 weeks with source control",
    coverage: [
      "E. coli",
      "Klebsiella pneumoniae",
      "Pseudomonas spp.",
      "Enterococcus spp.",
    ],
    notes: [
      "PDF local antibiogram: UTI ICU community-acquired pathway.",
      "Fosfomycin susceptibility is based on E. coli urinary CLSI breakpoints.",
    ],
    warnings: [
      "Colistin resistance reported in Klebsiella isolates; use polymyxin/CZA paths with stewardship review.",
      "Assess obstruction, catheter status, and need for source control.",
    ],
    idConsult: [
      "ID consult for Type 3, CRE concern, septic shock, obstruction, or perinephric abscess.",
      "Discuss de-escalation to culture-directed therapy.",
    ],
  },
  [profileKey("UTI", "ICU", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Meropenem", "Imipenem"],
      ["Colistin +/- IV Fosfomycin", "Ceftazidime-Avibactam + Aztreonam"],
      ["Colistin +/- IV Fosfomycin", "Ceftazidime-Avibactam + Aztreonam"],
    ),
    duration:
      "Hospital-acquired ICU UTI/urosepsis: 10-14 days; longer with abscess or delayed source control",
    coverage: [
      "E. coli",
      "Klebsiella pneumoniae",
      "Pseudomonas spp.",
      "Enterococcus spp.",
    ],
    notes: [
      "PDF local antibiogram: UTI ICU hospital-acquired pathway.",
      "Replace old catheter before sending urine culture when catheter-associated UTI is suspected.",
    ],
    warnings: [
      "Hospital-acquired ICU UTI carries MDR/ESBL/Pseudomonas risk.",
      "CZA/aztreonam recommendation is AMSP/ID guided where susceptibility data are insufficient.",
    ],
    idConsult: [
      "ID consult for ICU hospital-acquired UTI with Type 2/3 risk or resistant organism.",
      "Discuss source control and culture-directed narrowing.",
    ],
  },
  [profileKey("UTI", "Ward", "Community-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Cefoperazone-Sulbactam"],
      ["Colistin +/- IV Fosfomycin", "Ceftazidime-Avibactam + Aztreonam"],
    ),
    duration: "Ward community UTI: pyelonephritis/urosepsis 10-14 days",
    coverage: [
      "E. coli",
      "Klebsiella pneumoniae",
      "Pseudomonas spp.",
      "Enterococcus spp.",
      "Proteus spp.",
    ],
    notes: [
      "PDF local antibiogram: UTI wards community-acquired pathway.",
      "Nitrofurantoin is for uncomplicated cystitis only, not pyelonephritis or urosepsis.",
    ],
    warnings: [
      "Do not treat asymptomatic bacteriuria unless pregnant or before urological procedure.",
      "Avoid unnecessary carbapenem use in low-risk ward UTI.",
    ],
    idConsult: [
      "ID consult if recurrent ESBL UTI, Type 3 risk, or poor response.",
      "Discuss oral step-down once stable and susceptibilities are available.",
    ],
  },
  [profileKey("UTI", "Ward", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Imipenem", "Meropenem"],
      ["Colistin +/- IV Fosfomycin", "Ceftazidime-Avibactam + Aztreonam"],
    ),
    duration:
      "Ward hospital-acquired UTI: 10-14 days; adjust for source control and response",
    coverage: [
      "E. coli",
      "Klebsiella pneumoniae",
      "Pseudomonas spp.",
      "Enterococcus spp.",
      "Proteus spp.",
    ],
    notes: [
      "PDF local antibiogram: UTI wards hospital-acquired pathway.",
      "Fosfomycin interpretation follows urinary E. coli CLSI breakpoints.",
    ],
    warnings: [
      "Colistin resistance was reported in local Klebsiella isolates.",
      "Escalate only with MDR risk, sepsis, or culture evidence.",
    ],
    idConsult: [
      "ID consult for Type 3 hospital-acquired UTI, CRE/ESBL risk, or renal dosing complexity.",
      "Review de-escalation after culture results.",
    ],
  },
  [profileKey("RTI", "ICU", "Community-acquired")]: {
    therapies: mapTherapies(
      [
        "Cefoperazone-Sulbactam",
        "Piperacillin-Tazobactam",
        "Doxycycline/Macrolide",
      ],
      [
        "Cefoperazone-Sulbactam",
        "Piperacillin-Tazobactam",
        "Doxycycline/Macrolide",
      ],
      ["Ceftazidime-Avibactam + Aztreonam", "Doxycycline/Macrolide"],
    ),
    duration:
      "CAP: 5-7 days when stable; extend for complications or slow response",
    coverage: [
      "Klebsiella pneumoniae",
      "Pseudomonas aeruginosa",
      "E. coli",
      "H. influenzae",
      "S. pneumoniae",
      "Atypicals",
    ],
    notes: [
      "PDF local antibiogram: RTI ICU community-acquired pathway.",
      "Doxycycline/macrolides remain effective for CAP pathogens.",
    ],
    warnings: [
      "Stop antibiotics if viral etiology is confirmed and no secondary bacterial infection exists.",
      "Add anaerobic cover only for aspiration, lung abscess, or empyema.",
    ],
    idConsult: [
      "ID consult for ICU pneumonia with Type 3/MDR risk or invasive mold concern.",
      "Discuss respiratory cultures and de-escalation.",
    ],
  },
  [profileKey("RTI", "ICU", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      [
        "Ceftazidime-Avibactam + Aztreonam",
        "Polymyxin-based combination therapy",
      ],
    ),
    duration:
      "HCAP/VAP: usually 7 days; longer for bacteremia, immunosuppression, pyogenic complications, mold, or slow response",
    coverage: [
      "Klebsiella spp.",
      "Pseudomonas aeruginosa",
      "Acinetobacter baumannii",
      "Stenotrophomonas maltophilia",
      "Staphylococcus aureus",
    ],
    notes: [
      "PDF local antibiogram: RTI ICU hospital-acquired pathway.",
      "Reserve minocycline for MDR nosocomial infections.",
    ],
    warnings: [
      "Hospital-acquired ICU RTI requires MDR/Pseudomonas assessment.",
      "CZA/aztreonam or polymyxin combinations require ID/stewardship input.",
    ],
    idConsult: [
      "ID consult for VAP/HAP with Type 3 risk, CRE, CRAB, or non-resolving pneumonia.",
      "Discuss bronchoscopy/cultures and de-escalation.",
    ],
  },
  [profileKey("RTI", "Ward", "Community-acquired")]: {
    therapies: mapTherapies(
      ["Ceftriaxone + Azithromycin", "Doxycycline/Macrolide"],
      [
        "Cefoperazone-Sulbactam",
        "Piperacillin-Tazobactam",
        "Doxycycline/Macrolide",
      ],
      [
        "Cefoperazone-Sulbactam",
        "Piperacillin-Tazobactam",
        "Doxycycline/Macrolide",
      ],
    ),
    duration:
      "Ward CAP: 5-7 days when hemodynamically stable and afebrile for 48-72 hours",
    coverage: [
      "Klebsiella spp.",
      "Pseudomonas spp.",
      "H. influenzae",
      "S. pneumoniae",
      "Staphylococcus aureus",
      "Atypicals",
    ],
    notes: [
      "PDF local antibiogram: RTI wards community-acquired pathway.",
      "Avoid fluoroquinolones for routine CAP when alternatives are appropriate.",
    ],
    warnings: [
      "Do not continue antibiotics for confirmed viral disease without bacterial coinfection.",
      "Use broad Gram-negative coverage only when structural lung disease, recent antibiotics, or immunosuppression are present.",
    ],
    idConsult: [
      "ID consult for severe CAP, Type 3 risk, or poor clinical response.",
      "Review culture-directed narrowing and duration.",
    ],
  },
  [profileKey("RTI", "Ward", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Cefoperazone-Sulbactam", "Imipenem", "Meropenem"],
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
    ),
    duration:
      "Ward hospital-acquired RTI: usually 7 days; tailor to response and complications",
    coverage: [
      "Klebsiella spp.",
      "Pseudomonas spp.",
      "E. coli",
      "Staphylococcus aureus",
      "Acinetobacter spp.",
    ],
    notes: [
      "PDF local antibiogram: RTI wards hospital-acquired pathway.",
      "Obtain respiratory cultures before escalation when feasible.",
    ],
    warnings: [
      "Colistin resistance was reported in Klebsiella isolates in the local guide.",
      "Avoid static CAP regimens for hospital-acquired RTI.",
    ],
    idConsult: [
      "ID consult for MDR/Pseudomonas risk, Type 3 risk, or treatment failure.",
      "Discuss de-escalation and need for anaerobic coverage only when indicated.",
    ],
  },
  [profileKey("IAI", "ICU", "Community-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      [
        "Ceftazidime-Avibactam + Aztreonam",
        "Metronidazole",
        "Polymyxin-based combination therapy",
      ],
    ),
    duration:
      "Intra-abdominal sepsis: 5-14 days depending on source control and response",
    coverage: [
      "E. coli",
      "Klebsiella spp.",
      "Enterococcus spp.",
      "Anaerobes",
      "Candida risk",
    ],
    notes: [
      "PDF local antibiogram: IAI ICU community-acquired pathway.",
      "Ensure adequate source control; shorter courses suffice after source control unless abscess persists.",
    ],
    warnings: [
      "Anaerobic cover is needed if ceftazidime-avibactam is used.",
      "Tigecycline susceptibility is interpreted using E. coli EUCAST breakpoints in the guide.",
    ],
    idConsult: [
      "ID consult for Type 3 risk, CRE concern, candidiasis risk, or failed source control.",
      "Discuss antifungal indication and de-escalation after cultures.",
    ],
  },
  [profileKey("IAI", "ICU", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam"],
      ["Ceftazidime-Avibactam + Aztreonam", "Metronidazole"],
      ["Ceftazidime-Avibactam + Aztreonam", "Metronidazole"],
    ),
    duration:
      "ICU hospital-acquired IAI: 5-14 days; source control determines duration",
    coverage: [
      "E. coli",
      "Klebsiella spp.",
      "Enterococcus spp.",
      "Anaerobes",
      "Candida risk",
    ],
    notes: [
      "PDF local antibiogram: IAI ICU hospital-acquired pathway.",
      "Source control is mandatory; sterile necrotizing pancreatitis should not be treated.",
    ],
    warnings: [
      "CZA/aztreonam recommendation is AMSP/ID guided where susceptibility data are insufficient.",
      "Hospital-acquired ICU IAI has MDR and Enterococcus risk.",
    ],
    idConsult: [
      "Same-day ID consult for ICU hospital-acquired IAI with Type 2/3 risk.",
      "Discuss source control, antifungal triggers, and de-escalation.",
    ],
  },
  [profileKey("IAI", "Ward", "Community-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"],
      ["Imipenem", "Meropenem"],
      ["Imipenem", "Meropenem"],
    ),
    duration:
      "Ward community IAI: 5-14 days depending on source control and clinical response",
    coverage: [
      "E. coli",
      "Klebsiella spp.",
      "Enterococcus spp.",
      "Pseudomonas spp.",
      "Anaerobes",
    ],
    notes: [
      "PDF local antibiogram: IAI wards community-acquired pathway.",
      "Ensure adequate source control and reassess after cultures.",
    ],
    warnings: [
      "Do not prolong antibiotics after adequate source control without clinical indication.",
      "Tigecycline susceptibility follows E. coli EUCAST breakpoints in the local guide.",
    ],
    idConsult: [
      "ID consult for Type 3 risk, abscess, resistant organism, or poor source control.",
      "Discuss step-down and total duration.",
    ],
  },
  [profileKey("IAI", "Ward", "Hospital-acquired")]: {
    therapies: mapTherapies(
      ["Cefoperazone-Sulbactam", "Imipenem", "Meropenem"],
      ["Imipenem", "Meropenem"],
      ["Cefoperazone-Sulbactam", "Imipenem", "Meropenem"],
    ),
    duration:
      "Ward hospital-acquired IAI: 5-14 days; tailor to source control and response",
    coverage: [
      "E. coli",
      "Klebsiella spp.",
      "Enterococcus spp.",
      "Anaerobes",
      "Pseudomonas risk",
    ],
    notes: [
      "PDF local antibiogram: IAI wards hospital-acquired pathway.",
      "Review operative/radiology source control plan before extending therapy.",
    ],
    warnings: [
      "Hospital-acquired IAI increases MDR/ESBL and Enterococcus risk.",
      "Avoid unrelated UTI/RTI regimens for abdominal source.",
    ],
    idConsult: [
      "ID consult for Type 3 risk, suspected CRE, candidiasis risk, or ongoing sepsis.",
      "Discuss de-escalation and duration after source control.",
    ],
  },
};

const otpResendSeconds = 30;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

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

  const [routeStack, setRouteStack] = useState<Screen[]>(["login"]);
  const screen = routeStack[routeStack.length - 1];
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChannel, setAuthChannel] = useState<AuthChannel>("email");
  const [phone, setPhone] = useState("");
  const [otpTarget, setOtpTarget] = useState<OtpTarget | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(otpResendSeconds);
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const [activeTab, setActiveTab] = useState<BottomTab>("Home");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState<InfectionSite>(sites[1]);
  const [setting, setSetting] = useState("ICU");
  const [acquisition, setAcquisition] = useState("Community-acquired");
  const [riskAnswers, setRiskAnswers] = useState<boolean[]>([
    false,
    true,
    false,
    false,
    false,
  ]);
  const [riskType, setRiskType] = useState<RiskType>("Type 2");
  const [protocolDetailTab, setProtocolDetailTab] =
    useState<ProtocolDetailTab>("Notes");
  const isAuthScreen =
    screen === "login" || screen === "signup" || screen === "otp";

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoginError(
        "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setSessionReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setLoginError(error.message);
      }

      const hasSession = Boolean(data.session);
      setIsAuthenticated(hasSession);
      setRouteStack([hasSession ? "dashboard" : "login"]);
      setSessionReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = Boolean(session);
      setIsAuthenticated(hasSession);
      setRouteStack([hasSession ? "dashboard" : "login"]);
      setActiveTab("Home");
      if (hasSession) {
        setAuthSuccess("Login successful.");
        setLoginError("");
        setOtp("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }

    const styleId = "login-input-focus-reset";
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

      [data-testid="login-email-input"],
      [data-testid="login-password-input"],
      [data-testid="signup-employee-input"],
      [data-testid="signup-email-input"],
      [data-testid="signup-phone-input"],
      [data-testid="signup-password-input"],
      [data-testid="signup-confirm-password-input"],
      [data-testid="login-email-input"]:focus,
      [data-testid="login-password-input"]:focus,
      [data-testid="signup-employee-input"]:focus,
      [data-testid="signup-email-input"]:focus,
      [data-testid="signup-phone-input"]:focus,
      [data-testid="signup-password-input"]:focus,
      [data-testid="signup-confirm-password-input"]:focus,
      [data-testid="login-email-input"] input,
      [data-testid="login-password-input"] input,
      [data-testid="signup-employee-input"] input,
      [data-testid="signup-email-input"] input,
      [data-testid="signup-phone-input"] input,
      [data-testid="signup-password-input"] input,
      [data-testid="signup-confirm-password-input"] input,
      [data-testid="login-email-input"] input:focus,
      [data-testid="login-password-input"] input:focus,
      [data-testid="signup-employee-input"] input:focus,
      [data-testid="signup-email-input"] input:focus,
      [data-testid="signup-phone-input"] input:focus,
      [data-testid="signup-password-input"] input:focus,
      [data-testid="signup-confirm-password-input"] input:focus {
        background: transparent !important;
        border: 0 !important;
        outline: none !important;
        box-shadow: none !important;
        -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
        -webkit-text-fill-color: #0B2850 !important;
        caret-color: #0B2850 !important;
        -webkit-appearance: none !important;
        appearance: none !important;
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

  useEffect(() => {
    if (screen !== "otp" || otpTimer <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setOtpTimer((remainingSeconds) => Math.max(remainingSeconds - 1, 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [otpTimer, screen]);

  const phoneWidth = Math.min(width - 28, 430);
  const contentMinHeight = Math.max(height - 24, 760);
  const riskLabel =
    riskType === "Type 1"
      ? "Low Risk"
      : riskType === "Type 2"
        ? "Medium Risk"
        : "High Risk";
  const riskColor =
    riskType === "Type 1"
      ? palette.green
      : riskType === "Type 2"
        ? palette.orange
        : palette.red;
  const currentProtocol = useMemo(() => {
    const contextProfile =
      contextualProtocolProfiles[
        profileKey(selectedSite.code, setting, acquisition)
      ];
    const profile =
      contextProfile ??
      protocolProfiles[selectedSite.code] ??
      protocolProfiles.UTI;
    const hasMdrRisk =
      riskType === "Type 3" ||
      acquisition === "Hospital-acquired" ||
      riskAnswers[2] ||
      riskAnswers[3] ||
      riskAnswers[4];
    const hasEsblRisk =
      hasMdrRisk ||
      riskAnswers[0] ||
      riskAnswers[1] ||
      ["UTI", "IAI", "BSI"].includes(selectedSite.code);
    const hasPseudomonasRisk =
      setting === "ICU" ||
      acquisition === "Hospital-acquired" ||
      riskAnswers[2] ||
      ["RTI", "UTI", "IAI", "SSTI"].includes(selectedSite.code);
    const contextNotes = [
      `${setting} pathway selected for ${selectedSite.label}.`,
      `${acquisition} protocol context applied.`,
      `MDR/ESBL/Pseudomonas risk flags: MDR ${hasMdrRisk ? "yes" : "no"}, ESBL ${hasEsblRisk ? "yes" : "no"}, Pseudomonas ${hasPseudomonasRisk ? "yes" : "no"}.`,
    ];
    const contextWarnings = [
      setting === "ICU"
        ? "ICU admission: reassess severity, organ support, and cultures daily."
        : "Ward admission: escalate promptly if hypotension, hypoxia, or clinical deterioration occurs.",
      acquisition === "Hospital-acquired"
        ? "Hospital-acquired infection: review prior cultures, device exposure, and MDR risk."
        : "Community-acquired infection: avoid unnecessary broad-spectrum escalation if stable.",
      riskType === "Type 3"
        ? "Type 3 risk: stewardship alert and ID review are advised."
        : "Use the narrowest effective agent once culture data are available.",
      hasEsblRisk
        ? "ESBL/MDR risk present: avoid ceftriaxone-only therapy unless cultures support susceptibility."
        : "No ESBL/MDR flag from current answers; avoid unnecessary escalation.",
      hasPseudomonasRisk
        ? "Pseudomonas risk present: ensure selected regimen has antipseudomonal activity when clinically relevant."
        : "No Pseudomonas flag from current pathway.",
    ];
    const contextIdConsult = [
      `Share ${selectedSite.code}, ${setting}, ${acquisition}, and ${riskType} classification with ID team.`,
      riskType === "Type 3" || setting === "ICU"
        ? "Prioritize same-day ID consultation."
        : "Consider ID consultation if cultures show resistance or response is poor.",
      hasMdrRisk
        ? "Review CRE/MDRO strategy with stewardship before using polymyxin or ceftazidime-avibactam + aztreonam."
        : "Document planned 48-72 hour culture review.",
    ];
    const coverage = [...profile.coverage];

    if (
      hasPseudomonasRisk &&
      !coverage.some((item) => item.includes("Pseudomonas"))
    ) {
      coverage.push("Pseudomonas risk");
    }

    return {
      therapies: profile.therapies[riskType],
      duration: profile.duration,
      coverage,
      notes: [...profile.notes, ...contextNotes],
      warnings: [...profile.warnings, ...contextWarnings],
      idConsult: [...profile.idConsult, ...contextIdConsult],
    };
  }, [acquisition, riskAnswers, riskType, selectedSite, setting]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    const results: SearchResult[] = [];
    const pushIfMatch = (result: SearchResult) => {
      const haystack =
        `${result.title} ${result.subtitle} ${result.keywords}`.toLowerCase();

      if (haystack.includes(query)) {
        results.push(result);
      }
    };

    sites.forEach((site) => {
      const profile = protocolProfiles[site.code];
      const contextProfiles = Object.entries(contextualProtocolProfiles)
        .filter(([key]) => key.startsWith(`${site.code}|`))
        .map(([, contextProfile]) => contextProfile);
      const aliases = infectionAliases[site.code] ?? [];
      const therapyOptions = Object.entries(profile.therapies).flatMap(
        ([risk, options]) =>
          options.map((option) => ({ ...option, risk: risk as RiskType })),
      );
      const contextKeywords = contextProfiles
        .flatMap((contextProfile) => [
          contextProfile.duration,
          ...contextProfile.coverage,
          ...contextProfile.notes,
          ...contextProfile.warnings,
          ...contextProfile.idConsult,
          ...Object.values(contextProfile.therapies)
            .flat()
            .map((option) => `${option.name} ${option.dose}`),
        ])
        .join(" ");
      const sharedKeywords = [
        site.code,
        site.label,
        ...aliases,
        profile.duration,
        ...profile.coverage,
        ...profile.notes,
        ...profile.warnings,
        ...profile.idConsult,
        ...therapyOptions.map((option) => option.name),
        contextKeywords,
      ].join(" ");

      pushIfMatch({
        id: `${site.code}-infection`,
        title: site.label,
        subtitle: "Open infection workflow",
        icon: site.icon,
        site,
        target: "setting",
        keywords: sharedKeywords,
      });

      pushIfMatch({
        id: `${site.code}-protocol`,
        title: `${site.code} empiric protocol`,
        subtitle: `${site.label} recommendations`,
        icon: "□",
        site,
        target: "protocolDetails",
        detailTab: "Notes",
        keywords: sharedKeywords,
      });

      therapyOptions.forEach((option) => {
        pushIfMatch({
          id: `${site.code}-${option.risk}-${option.rank}-${option.name}`,
          title: option.name,
          subtitle: `${site.code} · ${option.risk} · ${option.dose}`,
          icon: "◉",
          site,
          target: "protocolResult",
          riskType: option.risk,
          keywords: `${sharedKeywords} ${option.name} ${option.dose}`,
        });
      });
    });

    return results.slice(0, 8);
  }, [searchQuery]);

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
    setActiveTab(tab);
    go(tabRoutes[tab]);
  };

  const openSearchResult = (result: SearchResult) => {
    setSelectedSite(result.site);
    setSearchQuery("");

    if (result.riskType) {
      setRiskType(result.riskType);
    }

    if (result.detailTab) {
      setProtocolDetailTab(result.detailTab);
    }

    go(result.target);
  };

  const sendOtp = async (target: OtpTarget) => {
    if (!isSupabaseConfigured) {
      setLoginError(
        "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setAuthLoading(true);
    setLoginError("");
    setSignupError("");
    setAuthSuccess("");

    const { error } =
      target.channel === "email"
        ? await supabase.auth.signInWithOtp({ email: target.value })
        : await supabase.auth.signInWithOtp({ phone: target.value });

    setAuthLoading(false);

    if (error) {
      setLoginError(error.message);
      setSignupError(error.message);
      return;
    }

    setOtpTarget(target);
    setOtp("");
    setOtpTimer(otpResendSeconds);
    setAuthSuccess(
      `OTP sent to ${target.channel === "email" ? target.value : target.value}.`,
    );
    go("otp");
  };

  const login = () => {
    const loginEmail = email.trim().toLowerCase();
    const loginPhone = normalizePhone(phone.trim());

    if (authChannel === "email") {
      if (!emailPattern.test(loginEmail)) {
        setLoginError("Enter a valid email address.");
        return;
      }

      void sendOtp({ channel: "email", value: loginEmail });
      return;
    }

    if (!phonePattern.test(loginPhone)) {
      setLoginError("Enter phone number with country code, e.g. +91XXXXXXXXXX.");
      return;
    }

    void sendOtp({ channel: "phone", value: loginPhone });
  };

  const signup = () => {
    const newDoctorEmail = signupEmail.trim().toLowerCase();
    const newDoctorPhone = normalizePhone(signupPhone.trim());

    if (employeeId.trim().length === 0) {
      setSignupError("Employee ID is required.");
      return;
    }

    if (!emailPattern.test(newDoctorEmail)) {
      setSignupError("Enter a valid email address.");
      return;
    }

    if (!phonePattern.test(newDoctorPhone)) {
      setSignupError("Enter phone number with country code, e.g. +91XXXXXXXXXX.");
      return;
    }

    setSignupError("");
    setEmail(newDoctorEmail);
    setPhone(newDoctorPhone);
    void sendOtp({ channel: "email", value: newDoctorEmail });
  };

  const back = () => {
    setRouteStack((current) =>
      current.length > 1 ? current.slice(0, -1) : current,
    );
  };

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, "");

    if (digits.length === 0) {
      const next = otp.split("");
      next[index] = "";
      setOtp(next.join(""));
      return;
    }

    const currentDigits = otp.padEnd(6, " ").split("");
    digits
      .slice(0, 6 - index)
      .split("")
      .forEach((digit, offset) => {
        currentDigits[index + offset] = digit;
      });

    const nextOtp = currentDigits.join("").replace(/\s/g, "").slice(0, 6);
    setOtp(nextOtp);
    const nextIndex = Math.min(index + digits.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key !== "Backspace") {
      return;
    }

    if (!otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) {
      setLoginError("Enter the 6 digit OTP.");
      return;
    }

    if (!otpTarget) {
      setLoginError("Send an OTP before verification.");
      return;
    }

    setAuthLoading(true);
    setLoginError("");
    setSignupError("");
    setAuthSuccess("");

    const { error } =
      otpTarget.channel === "email"
        ? await supabase.auth.verifyOtp({
            email: otpTarget.value,
            token: otp,
            type: "email",
          })
        : await supabase.auth.verifyOtp({
            phone: otpTarget.value,
            token: otp,
            type: "sms",
          });

    setAuthLoading(false);

    if (error) {
      setLoginError(error.message || "OTP failed or expired.");
      return;
    }
  };

  const formatOtpTimer = (remainingSeconds: number) => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0",
    )}`;
  };

  const resendOtp = () => {
    if (otpTimer > 0) {
      return;
    }

    if (!otpTarget) {
      setLoginError("Send an OTP before requesting another one.");
      return;
    }

    void sendOtp(otpTarget);
    otpRefs.current[0]?.focus();
  };

  const logout = async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    setAuthLoading(false);

    if (error) {
      setLoginError(error.message);
      return;
    }

    setIsAuthenticated(false);
    setOtpTarget(null);
    setAuthSuccess("Logged out successfully.");
    go("login", "reset");
  };

  const classify = () => {
    const hasType3Risk = riskAnswers[2] || riskAnswers[3] || riskAnswers[4];
    const hasType2Risk = riskAnswers[0] || riskAnswers[1];

    setRiskType(hasType3Risk ? "Type 3" : hasType2Risk ? "Type 2" : "Type 1");
    go("classification");
  };

  const appShell = (children: ReactNode, title?: string, progress = true) => (
    <View style={styles.appScreen}>
      <View style={styles.topBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={back}
          style={styles.topIcon}
        >
          <Text style={styles.topIconText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{title}</Text>
        <View style={styles.topIcon}>
          <Text style={styles.topIconText}>
            {screen === "protocolResult" ? "□" : ""}
          </Text>
        </View>
      </View>
      {progress && <StepDots />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenBody}
      >
        {children}
      </ScrollView>
    </View>
  );

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
        <>
          <Text style={styles.primaryButtonText}>{label}</Text>
          <Text style={styles.buttonArrow}>→</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const LogoHeader = () => (
    <View style={styles.brand}>
      <View style={styles.hospitalRow}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>H</Text>
        </View>
        <View>
          <Text style={styles.hospitalName}>P. D. HINDUJA HOSPITAL &</Text>
          <Text style={styles.hospitalName}>MEDICAL RESEARCH CENTRE</Text>
        </View>
      </View>
      <View style={styles.shield}>
        <Text style={styles.shieldText}>⌂</Text>
      </View>
      <Text style={styles.appTitle}>Hinduja{"\n"}Antibiotic Guide</Text>
      <Text style={styles.subtitle}>Evidence Based. Hospital Specific.</Text>
    </View>
  );

  const Login = () => (
    <View style={styles.centerScreen}>
      <LogoHeader />
      <View style={styles.authModeRow}>
        {(["email", "phone"] as AuthChannel[]).map((channel) => (
          <TouchableOpacity
            key={channel}
            activeOpacity={0.82}
            onPress={() => {
              setAuthChannel(channel);
              setLoginError("");
              setAuthSuccess("");
            }}
            style={[
              styles.authModeButton,
              authChannel === channel && styles.authModeButtonActive,
            ]}
          >
            <Text
              style={[
                styles.authModeText,
                authChannel === channel && styles.authModeTextActive,
              ]}
            >
              {channel === "email" ? "Email OTP" : "Phone OTP"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.inputWrap}>
        <Text style={styles.inputIcon}>{authChannel === "email" ? "✉" : "☎"}</Text>
        {authChannel === "email" ? (
          <TextInput
            testID="login-email-input"
            accessibilityLabel="Hospital email"
            value={email}
            onChangeText={setEmail}
            placeholder="doctor@hindujahospital.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            style={[styles.textInput, webTextInputReset]}
          />
        ) : (
          <TextInput
            testID="login-phone-input"
            accessibilityLabel="Phone number with country code"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91XXXXXXXXXX"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            style={[styles.textInput, webTextInputReset]}
          />
        )}
      </View>
      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: keepLoggedIn }}
        onPress={() => setKeepLoggedIn((previousValue) => !previousValue)}
        style={styles.keepRow}
      >
        <View style={[styles.checkbox, keepLoggedIn && styles.checkboxActive]}>
          {keepLoggedIn ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.keepText}>Keep me logged in</Text>
      </TouchableOpacity>
      {loginError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loginError}</Text>
        </View>
      ) : null}
      {authSuccess ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{authSuccess}</Text>
        </View>
      ) : null}
      <PrimaryButton
        label={authChannel === "email" ? "Send Email OTP" : "Send Phone OTP"}
        onPress={login}
        loading={authLoading}
      />
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          setLoginError("");
          go("signup");
        }}
        style={styles.authLinkRow}
      >
        <Text style={styles.authMuted}>New doctor?</Text>
        <Text style={styles.authLink}> Create Account</Text>
      </TouchableOpacity>
      <View style={styles.doctorOnly}>
        <Text style={styles.smallShield}>⌂</Text>
        <Text style={styles.doctorText}>
          Restricted to authorized doctors only.
        </Text>
      </View>
      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>i</Text>
        <Text style={styles.infoText}>
          This app is for authorized doctors only. All activities are audited.
        </Text>
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
        <Text style={styles.offlineDot}>●</Text>
        <Text style={styles.versionText}>Offline Enabled</Text>
      </View>
    </View>
  );

  const Signup = () => (
    <View style={styles.centerScreen}>
      <LogoHeader />
      <View style={styles.inputWrap}>
        <Text style={styles.inputIcon}>⊙</Text>
        <TextInput
          testID="signup-employee-input"
          value={employeeId}
          onChangeText={setEmployeeId}
          placeholder="Employee ID"
          placeholderTextColor="#94A3B8"
          autoCapitalize="characters"
          autoCorrect={false}
          textContentType="username"
          autoComplete="username"
          style={[styles.textInput, webTextInputReset]}
        />
      </View>
      <View style={styles.inputWrap}>
        <Text style={styles.inputIcon}>✉</Text>
        <TextInput
          testID="signup-email-input"
          value={signupEmail}
          onChangeText={setSignupEmail}
          placeholder="doctor@hindujahospital.com"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          style={[styles.textInput, webTextInputReset]}
        />
      </View>
      <View style={styles.inputWrap}>
        <Text style={styles.inputIcon}>☎</Text>
        <TextInput
          testID="signup-phone-input"
          value={signupPhone}
          onChangeText={setSignupPhone}
          placeholder="+91XXXXXXXXXX"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="telephoneNumber"
          autoComplete="tel"
          style={[styles.textInput, webTextInputReset]}
        />
      </View>
      {signupError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{signupError}</Text>
        </View>
      ) : null}
      {authSuccess ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{authSuccess}</Text>
        </View>
      ) : null}
      <PrimaryButton
        label="Create Account with Email OTP"
        onPress={signup}
        loading={authLoading}
      />
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          setSignupError("");
          go("login", "replace");
        }}
        style={styles.authLinkRow}
      >
        <Text style={styles.authMuted}>Already have an account?</Text>
        <Text style={styles.authLink}> Login</Text>
      </TouchableOpacity>
      <View style={styles.doctorOnly}>
        <Text style={styles.smallShield}>⌂</Text>
        <Text style={styles.doctorText}>
          Restricted to authorized doctors only.
        </Text>
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
        <Text style={styles.offlineDot}>●</Text>
        <Text style={styles.versionText}>Offline Enabled</Text>
      </View>
    </View>
  );

  const Otp = () => (
    <View style={styles.centerScreen}>
      <View style={styles.otpHeaderRow}>
        <TouchableOpacity activeOpacity={0.8} onPress={back}>
          <Text style={styles.otpBack}>‹</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.otpTitle}>Verify OTP</Text>
      <Text style={styles.otpSubtitle}>
        Enter the 6 digit OTP sent to{"\n"}
        {otpTarget?.value || "your registered contact"}
      </Text>
      <View style={styles.otpRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              otpRefs.current[index] = ref;
            }}
            value={otp[index] ?? ""}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={({ nativeEvent }) =>
              handleOtpKeyPress(nativeEvent.key, index)
            }
            accessibilityLabel={`OTP digit ${index + 1}`}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={index === 0 ? 6 : 1}
            selectTextOnFocus
            style={styles.otpBox}
          />
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.82}
        disabled={otpTimer > 0}
        onPress={resendOtp}
      >
        <Text style={styles.resendText}>
          {otpTimer > 0
            ? `Resend OTP in ${formatOtpTimer(otpTimer)}`
            : "Resend OTP"}
        </Text>
      </TouchableOpacity>
      {loginError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loginError}</Text>
        </View>
      ) : null}
      {authSuccess ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{authSuccess}</Text>
        </View>
      ) : null}
      <PrimaryButton
        label="Verify & Login"
        onPress={() => {
          void verifyOtp();
        }}
        loading={authLoading}
      />
      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>▣</Text>
        <Text style={styles.infoText}>
          Your session is encrypted and monitored.
        </Text>
      </View>
    </View>
  );

  const Dashboard = () => (
    <View style={styles.dashboardScreen}>
      <View style={styles.dashboardHeader}>
        <View style={styles.menuBox}>
          <Text style={styles.menuText}>≡</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Hinduja Antibiotic Guide</Text>
          <Text style={styles.headerDoctor}>Dr. Ananya Sharma</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => goTab("Alerts")}>
          <Text style={styles.bell}>⌂</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.dashboardBody}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
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
                  <Text
                    style={[
                      styles.searchResultIcon,
                      { color: result.site.tone },
                    ]}
                  >
                    {result.icon}
                  </Text>
                  <View style={styles.searchResultTextBlock}>
                    <Text style={styles.searchResultTitle}>{result.title}</Text>
                    <Text style={styles.searchResultSubtitle}>
                      {result.subtitle}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
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
        <View style={styles.cardGrid}>
          {sites.map((site) => (
            <TouchableOpacity
              key={site.code}
              activeOpacity={0.86}
              onPress={() => {
                setSelectedSite(site);
                go("setting");
              }}
              style={[
                styles.siteCard,
                site.code === "FN" && styles.siteCardWide,
              ]}
            >
              <Text style={[styles.siteIcon, { color: site.tone }]}>
                {site.icon}
              </Text>
              <Text style={styles.siteCardText}>{site.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <BottomTabs />
    </View>
  );

  const BottomTabs = () => (
    <View style={styles.bottomTabs}>
      {bottomTabs.map((tab, index) => (
        <TouchableOpacity
          key={tab}
          activeOpacity={0.82}
          onPress={() => goTab(tab)}
          style={styles.bottomTab}
        >
          <Text
            style={[
              styles.bottomIcon,
              activeTab === tab && styles.bottomIconActive,
            ]}
          >
            {["⌂", "□", "◷", "◇", "○"][index]}
          </Text>
          <Text
            style={[
              styles.bottomText,
              activeTab === tab && styles.bottomTextActive,
            ]}
          >
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const TabPage = (title: string, children: ReactNode) => (
    <View style={styles.dashboardScreen}>
      <View style={styles.dashboardHeader}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={back}
          style={styles.menuBox}
        >
          <Text style={styles.menuText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerDoctor}>Hinduja Antibiotic Guide</Text>
        </View>
        <View style={styles.menuBox} />
      </View>
      <ScrollView
        contentContainerStyle={styles.dashboardBody}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <BottomTabs />
    </View>
  );

  const Guidelines = () =>
    TabPage(
      "Guidelines",
      <View>
        {[
          "Empiric therapy by infection site",
          "Renal dose adjustment",
          "Carbapenem stewardship policy",
        ].map((item) => (
          <TouchableOpacity
            key={item}
            activeOpacity={0.86}
            style={styles.listCard}
            onPress={() => go("protocolDetails")}
          >
            <Text style={styles.listIcon}>□</Text>
            <Text style={styles.listText}>{item}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>,
    );

  const Duration = () =>
    TabPage(
      "Duration",
      <View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            {selectedSite.label} · {setting} · {acquisition}
          </Text>
          <Text style={styles.infoCardBody}>{currentProtocol.duration}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Review Trigger</Text>
          <Text style={styles.infoCardBody}>
            Reassess duration when cultures, source control, and clinical
            response are available.
          </Text>
        </View>
      </View>,
    );

  const Alerts = () =>
    TabPage(
      "Alerts",
      <View>
        <View
          style={[styles.infoCard, riskType === "Type 3" && styles.actionAlert]}
        >
          <Text
            style={[
              styles.infoCardTitle,
              riskType === "Type 3" && styles.actionTitleRed,
            ]}
          >
            Stewardship Review
          </Text>
          <Text
            style={[
              styles.infoCardBody,
              riskType === "Type 3" && styles.actionBodyRed,
            ]}
          >
            {riskType === "Type 3"
              ? "Type 3 high-risk case requires ID consult review."
              : "No critical stewardship alerts at this time."}
          </Text>
          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.actionButton,
              riskType === "Type 3" && styles.actionButtonRed,
            ]}
            onPress={() => go("stewardshipAlert")}
          >
            <Text style={styles.actionButtonText}>Open Alert</Text>
          </TouchableOpacity>
        </View>
      </View>,
    );

  const Profile = () =>
    TabPage(
      "Profile",
      <View>
        <View style={styles.profileBadge}>
          <Text style={styles.profileInitial}>AS</Text>
        </View>
        <Text style={styles.profileName}>Dr. Ananya Sharma</Text>
        <Text style={styles.profileMeta}>Infectious Disease Specialist</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Access</Text>
          <Text style={styles.infoCardBody}>
            Authorized doctor account · Offline enabled · Activity audited
          </Text>
        </View>
        <PrimaryButton
          label="Logout"
          onPress={() => {
            void logout();
          }}
          loading={authLoading}
          red
        />
      </View>,
    );

  const InfectionSite = () =>
    appShell(
      <View>
        {sites.map((site) => (
          <TouchableOpacity
            key={site.code}
            activeOpacity={0.86}
            style={styles.listCard}
            onPress={() => {
              setSelectedSite(site);
              go("setting");
            }}
          >
            <Text style={[styles.listIcon, { color: site.tone }]}>
              {site.icon}
            </Text>
            <Text style={styles.listText}>{site.label}</Text>
            <Text style={styles.chevron}>›</Text>
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
        {["ICU", "Ward"].map((item) => (
          <TouchableOpacity
            key={item}
            activeOpacity={0.86}
            style={[
              styles.choiceCard,
              setting === item && styles.choiceCardActive,
            ]}
            onPress={() => {
              setSetting(item);
              go("acquisition");
            }}
          >
            <Text style={styles.bedIcon}>▱</Text>
            <Text style={styles.choiceText}>{item}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.noteBox}>
          <Text style={styles.noteIcon}>i</Text>
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
        {["Community-acquired", "Hospital-acquired"].map((item) => (
          <TouchableOpacity
            key={item}
            activeOpacity={0.86}
            style={[
              styles.acqCard,
              acquisition === item && styles.acqCardActive,
            ]}
            onPress={() => {
              setAcquisition(item);
              go("riskAssessment");
            }}
          >
            <Text
              style={[
                styles.acqIcon,
                item === "Hospital-acquired" && styles.acqIconRed,
              ]}
            >
              {item === "Community-acquired" ? "♙" : "▥"}
            </Text>
            <View>
              <Text
                style={[
                  styles.acqTitle,
                  item === "Hospital-acquired" && styles.acqTitleRed,
                ]}
              >
                {item}
              </Text>
              <Text style={styles.acqSub}>
                {item === "Community-acquired"
                  ? "(No recent hospital exposure)"
                  : "(Recent hospital exposure)"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={styles.noteBox}>
          <Text style={styles.noteIcon}>i</Text>
          <Text style={styles.noteText}>
            Acquisition type is used along with risk factors for final
            recommendation.
          </Text>
        </View>
      </View>,
      `${selectedSite.code} - ${setting}`,
    );

  const Risk = () =>
    appShell(
      <View>
        <Text style={styles.riskHeading}>
          Please answer the following{"\n"}risk assessment questions
        </Text>
        {questions.map((question, index) => (
          <View key={question} style={styles.riskRow}>
            <Text style={styles.riskQuestion}>{question}</Text>
            <View style={styles.toggle}>
              {[false, true].map((value) => (
                <TouchableOpacity
                  key={String(value)}
                  onPress={() => {
                    const next = [...riskAnswers];
                    next[index] = value;
                    setRiskAnswers(next);
                  }}
                  style={[
                    styles.toggleOption,
                    riskAnswers[index] === value && styles.toggleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      riskAnswers[index] === value && styles.toggleTextActive,
                    ]}
                  >
                    {value ? "Yes" : "No"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <PrimaryButton label="View Result" onPress={classify} />
      </View>,
      `${selectedSite.code} - ${setting} - ${acquisition}`,
    );

  const Classification = () =>
    appShell(
      <View>
        <View style={styles.classCard}>
          <Text style={[styles.classShield, { color: riskColor }]}>⬟</Text>
          <View>
            <Text style={[styles.classType, { color: riskColor }]}>
              {riskType.toUpperCase()}
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
        {questions.map((question, index) => (
          <Text key={question} style={styles.summaryLine}>
            {riskAnswers[index] ? "△" : "●"} {question.replace("?", "")}:{" "}
            {riskAnswers[index] ? "Yes" : "No"}
          </Text>
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
            {selectedSite.code} · {setting} · {acquisition}
          </Text>
          <Text style={[styles.resultMetaRisk, { color: riskColor }]}>
            {riskType} - {riskLabel}
          </Text>
        </View>
        <Text style={styles.resultSection}>Recommended Empiric Therapy</Text>
        {currentProtocol.therapies.map((item) => (
          <View key={item.rank} style={styles.therapyCard}>
            <Text style={styles.rank}>{item.rank}</Text>
            <View>
              <Text style={styles.therapyName}>{item.name}</Text>
              <Text style={styles.therapyDose}>{item.dose}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.detailLabel}>Duration</Text>
        <Text style={styles.detailText}>{currentProtocol.duration}</Text>
        <Text style={styles.detailLabel}>Pathogen Coverage (Common)</Text>
        <View style={styles.pillRow}>
          {currentProtocol.coverage.map((pill) => (
            <Text key={pill} style={styles.pill}>
              {pill}
            </Text>
          ))}
        </View>
        {riskType === "Type 3" && (
          <View style={styles.alertStrip}>
            <Text style={styles.alertStripText}>
              Stewardship alert: ID consult advised.
            </Text>
          </View>
        )}
        <PrimaryButton
          label="View Details"
          onPress={() => go("protocolDetails")}
        />
      </View>,
      "Protocol Result",
      false,
    );

  const ProtocolDetails = () =>
    appShell(
      <View>
        <View style={styles.tabsRow}>
          {(["Notes", "Warnings", "ID Consult"] as ProtocolDetailTab[]).map(
            (tab) => (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.82}
                onPress={() => setProtocolDetailTab(tab)}
                style={styles.tabButton}
              >
                <Text
                  style={[
                    styles.tabText,
                    protocolDetailTab === tab && styles.tabActive,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>
        {protocolDetailTab === "Notes" && (
          <View>
            <Text style={styles.detailsTitle}>Clinical / Protocol Notes</Text>
            {currentProtocol.notes.map((note) => (
              <View key={note} style={styles.noteBlue}>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        )}
        {protocolDetailTab === "Warnings" && (
          <View>
            <Text style={styles.detailsTitle}>
              Stewardship Alerts & Precautions
            </Text>
            {currentProtocol.warnings.map((warning) => (
              <View key={warning} style={[styles.noteBlue, styles.actionAlert]}>
                <Text style={[styles.noteText, styles.actionBodyRed]}>
                  {warning}
                </Text>
              </View>
            ))}
          </View>
        )}
        {protocolDetailTab === "ID Consult" && (
          <View>
            <Text style={styles.detailsTitle}>
              Infectious Disease Consult Guidance
            </Text>
            {currentProtocol.idConsult.map((guidance) => (
              <TouchableOpacity
                key={guidance}
                activeOpacity={0.86}
                style={styles.listCard}
                onPress={() => go("stewardshipAlert")}
              >
                <Text style={styles.listIcon}>□</Text>
                <Text style={styles.listText}>{guidance}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <PrimaryButton label="Actions" onPress={() => go("actions")} />
      </View>,
      "Protocol Details",
      false,
    );

  const Actions = () =>
    appShell(
      <View>
        <View style={styles.actionsGrid}>
          <ActionCard
            title="Save to My Cases"
            body="Saved successfully!"
            button="View My Cases"
            icon="✓"
            onPress={() => go("savedCases")}
          />
          <ActionCard
            title="Export PDF"
            body="Hinduja Antibiotic Guide Protocol Report"
            button="Export PDF"
            icon="▧"
            onPress={() => go("reports")}
          />
          <ActionCard
            title="QR Code"
            body="Scan to view protocol"
            button="Open QR"
            icon="▦"
            onPress={() => go("qrView")}
          />
          <ActionCard
            title="Share with Team"
            body="WhatsApp  Email  Bluetooth  More"
            button="Share"
            icon="●"
            onPress={() => go("shareView")}
          />
          <ActionCard
            title="Stewardship Alert"
            body={
              riskType === "Type 3"
                ? "Type 3 (High Risk) Alert Triggered"
                : "No critical stewardship alert"
            }
            button="View Alert"
            icon="!"
            alert={riskType === "Type 3"}
            onPress={() => go("stewardshipAlert")}
          />
        </View>
      </View>,
      "Actions",
      false,
    );

  const ActionCard = ({
    title,
    body,
    button,
    icon,
    alert,
    onPress,
  }: {
    title: string;
    body: string;
    button: string;
    icon: string;
    alert?: boolean;
    onPress: () => void;
  }) => (
    <View style={[styles.actionCard, alert && styles.actionAlert]}>
      <Text style={[styles.actionTitle, alert && styles.actionTitleRed]}>
        {title}
      </Text>
      <Text style={[styles.actionIcon, alert && styles.actionIconRed]}>
        {icon}
      </Text>
      <Text style={[styles.actionBody, alert && styles.actionBodyRed]}>
        {body}
      </Text>
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onPress}
        style={[styles.actionButton, alert && styles.actionButtonRed]}
      >
        <Text style={styles.actionButtonText}>{button}</Text>
      </TouchableOpacity>
    </View>
  );

  const SavedCases = () =>
    appShell(
      <View>
        {[
          [`${selectedSite.code} · ${setting} · ${acquisition}`, riskLabel],
          ["UTI · Ward · Community-acquired", "Medium Risk"],
        ].map(([title, value]) => (
          <TouchableOpacity
            key={title}
            activeOpacity={0.86}
            style={styles.infoCard}
            onPress={() => go("protocolResult")}
          >
            <Text style={styles.infoCardTitle}>{title}</Text>
            <Text style={styles.infoCardBody}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>,
      "My Cases",
      false,
    );

  const Reports = () =>
    appShell(
      <View>
        <View style={styles.reportPreview}>
          <Text style={styles.reportTitle}>Hinduja Antibiotic Guide</Text>
          <Text style={styles.reportBody}>Protocol Report</Text>
          <Text style={styles.reportMeta}>
            {selectedSite.code} - {setting} - {riskType}
          </Text>
          <Text style={styles.reportIcon}>PDF</Text>
        </View>
        <PrimaryButton label="View Reports" onPress={() => go("savedCases")} />
      </View>,
      "Generated Report",
      false,
    );

  const QrView = () =>
    appShell(
      <View>
        <View style={styles.qrPanel}>
          <Text style={styles.qrCode}>
            ▦▦▦{"\n"}▦ ▦{"\n"}▦▦▦
          </Text>
          <Text style={styles.infoCardBody}>Scan to view protocol</Text>
        </View>
        <PrimaryButton label="Share QR" onPress={() => go("shareView")} />
      </View>,
      "QR Code",
      false,
    );

  const ShareView = () =>
    appShell(
      <View>
        {["WhatsApp", "Email", "Bluetooth", "More"].map((item) => (
          <TouchableOpacity
            key={item}
            activeOpacity={0.86}
            onPress={() => go("actions")}
            style={styles.listCard}
          >
            <Text style={styles.listIcon}>●</Text>
            <Text style={styles.listText}>{item}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>,
      "Share with Team",
      false,
    );

  const StewardshipAlert = () =>
    appShell(
      <View>
        <View style={[styles.infoCard, styles.actionAlert]}>
          <Text style={styles.actionIconRed}>!</Text>
          <Text style={styles.actionTitleRed}>
            {riskType === "Type 3"
              ? "Type 3 (High Risk) Alert Triggered"
              : "Stewardship Status"}
          </Text>
          <Text style={styles.actionBodyRed}>
            Consider ID consult and review antibiotic policy.
          </Text>
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
      case "login":
        return Login();
      case "signup":
        return Signup();
      case "otp":
        return Otp();
      case "dashboard":
        return Dashboard();
      case "guidelines":
        return Guidelines();
      case "duration":
        return Duration();
      case "alerts":
        return Alerts();
      case "profile":
        return Profile();
      case "infectionSite":
        return InfectionSite();
      case "setting":
        return Setting();
      case "acquisition":
        return Acquisition();
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
      case "qrView":
        return QrView();
      case "shareView":
        return ShareView();
      case "stewardshipAlert":
        return StewardshipAlert();
    }
  };

  if (!sessionReady) {
    return (
      <SafeAreaView style={[styles.safe, styles.authSafe]}>
        <StatusBar style="dark" />
        <View style={[styles.centerScreen, { minHeight: contentMinHeight }]}>
          <LogoHeader />
          <ActivityIndicator color={palette.blue} />
          <Text style={styles.infoText}>Restoring secure session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, isAuthScreen && styles.authSafe]}>
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
            isAuthScreen && styles.authStage,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.phone,
              { width: phoneWidth },
              isAuthScreen && styles.authPhone,
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
    authSafe: { backgroundColor: "#F7FBFF" },
    keyboard: { flex: 1 },
    stage: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    authStage: { backgroundColor: "#F7FBFF" },
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
    authPhone: { backgroundColor: "#F7FBFF" },
    centerScreen: {
      flex: 1,
      minHeight: 720,
      paddingHorizontal: 26,
      paddingVertical: 42,
      backgroundColor: "#F7FBFF",
      justifyContent: "center",
    },
    brand: { alignItems: "center", marginBottom: 22 },
    hospitalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      marginBottom: 34,
    },
    logoCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 2,
      borderColor: "#0057B8",
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: { color: "#0057B8", fontSize: 18, fontWeight: "900" },
    hospitalName: {
      color: "#004AA3",
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    shield: {
      width: 48,
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#DDEAF7",
      backgroundColor: "#EEF6FF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    shieldText: { color: "#0057B8", fontSize: 26, fontWeight: "900" },
    appTitle: {
      color: "#004AA3",
      fontSize: 28,
      lineHeight: 32,
      fontWeight: "900",
      textAlign: "center",
    },
    subtitle: {
      color: "#004AA3",
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 5,
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
    keepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 2,
      marginBottom: 8,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: "#DDEAF7",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxActive: {
      borderColor: p.blue,
      backgroundColor: p.blue,
    },
    checkboxMark: {
      color: "#FFFFFF",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
    },
    keepText: {
      color: "#0B2850",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
    },
    passwordEyeButton: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
    },
    passwordEyeIcon: {
      color: "#5C6F86",
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    otpHeaderRow: {
      height: 34,
      justifyContent: "center",
      marginBottom: 8,
    },
    otpBack: {
      color: "#0B2850",
      fontSize: 32,
      lineHeight: 34,
      fontWeight: "500",
    },
    otpTitle: {
      color: "#0B2850",
      fontSize: 24,
      lineHeight: 31,
      fontWeight: "900",
      textAlign: "center",
      marginBottom: 18,
    },
    otpSubtitle: {
      color: "#0B2850",
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 24,
    },
    otpRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 9,
      marginBottom: 20,
    },
    otpBox: {
      width: 42,
      height: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#C8D8EA",
      backgroundColor: "#FFFFFF",
      color: "#0B2850",
      textAlign: "center",
      fontSize: 19,
      fontWeight: "900",
      padding: 0,
    },
    resendText: {
      color: "#0B2850",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 22,
    },
    errorBox: {
      borderRadius: 8,
      backgroundColor: "#FEE2E2",
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 8,
    },
    authLinkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 14,
    },
    authMuted: {
      color: "#5C6F86",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
    authLink: {
      color: p.blue,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
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
    authModeRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    authModeButton: {
      flex: 1,
      height: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.card,
    },
    authModeButtonActive: {
      backgroundColor: p.blue,
      borderColor: p.blue,
    },
    authModeText: {
      color: p.muted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
    },
    authModeTextActive: {
      color: "#FFFFFF",
    },
    primaryButton: {
      height: 54,
      borderRadius: 9,
      backgroundColor: p.blue,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginTop: 6,
      shadowColor: p.blue,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.26,
      shadowRadius: 18,
      elevation: 5,
    },
    redButton: { backgroundColor: p.red, shadowColor: p.red },
    disabledButton: { opacity: 0.66 },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
    },
    buttonArrow: {
      color: "#FFFFFF",
      fontSize: 21,
      fontWeight: "900",
      marginLeft: 14,
    },
    doctorOnly: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginTop: 18,
    },
    smallShield: { color: "#0057B8", fontSize: 14, fontWeight: "900" },
    doctorText: { color: "#004AA3", fontSize: 13, fontWeight: "800" },
    infoBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 9,
      backgroundColor: "#EEF6FF",
      padding: 13,
      marginTop: 26,
    },
    infoIcon: { color: "#0057B8", fontSize: 15, fontWeight: "900" },
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
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 34,
    },
    versionText: { color: "#5C6F86", fontSize: 10, fontWeight: "700" },
    offlineDot: { color: "#1E9D61", fontSize: 10 },
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
    menuBox: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    menuText: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
    headerTextBlock: { flex: 1 },
    headerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
    headerDoctor: {
      color: "#D7E8FF",
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },
    bell: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
    dashboardBody: { padding: 14, paddingBottom: 90 },
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
    searchIcon: { color: p.muted, fontSize: 17, marginRight: 9 },
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
      fontSize: 23,
      fontWeight: "900",
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
    siteIcon: {
      fontSize: 34,
      lineHeight: 38,
      fontWeight: "900",
      marginBottom: 5,
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
      height: 72,
      backgroundColor: p.card,
      borderTopWidth: 1,
      borderTopColor: p.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
    },
    bottomTab: { flex: 1, alignItems: "center" },
    bottomIcon: {
      color: p.muted,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
    },
    bottomIconActive: { color: p.blue },
    bottomText: {
      color: p.muted,
      fontSize: 9,
      lineHeight: 14,
      fontWeight: "800",
    },
    bottomTextActive: { color: p.blue },
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
    listIcon: { width: 48, fontSize: 30, fontWeight: "900" },
    listText: {
      flex: 1,
      color: p.blue2,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
    },
    chevron: { color: p.muted, fontSize: 25, fontWeight: "900" },
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
      justifyContent: "center",
      marginBottom: 15,
      flexDirection: "row",
      gap: 22,
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    choiceCardActive: { borderColor: p.blue },
    bedIcon: { color: p.blue, fontSize: 40, fontWeight: "900" },
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
    noteIcon: { color: p.blue, fontSize: 14, fontWeight: "900" },
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
    acqCardActive: { borderColor: p.blue },
    acqIcon: { color: p.blue, fontSize: 33, width: 44, fontWeight: "900" },
    acqIconRed: { color: p.red },
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 58,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      gap: 10,
    },
    riskQuestion: {
      flex: 1,
      color: p.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
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
    classShield: { fontSize: 52, fontWeight: "900" },
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
      color: p.text,
      fontSize: 12,
      lineHeight: 23,
      fontWeight: "700",
    },
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
    therapyCard: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    rank: {
      width: 28,
      height: 28,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: p.orange,
      color: "#FFFFFF",
      textAlign: "center",
      lineHeight: 28,
      fontWeight: "900",
    },
    therapyName: {
      color: "#A83D26",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
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
    actionsGrid: { gap: 14 },
    actionCard: {
      minHeight: 154,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      alignItems: "center",
      justifyContent: "center",
      padding: 14,
    },
    actionAlert: { borderColor: "#F5C4C4", backgroundColor: "#FFF1F1" },
    actionTitle: {
      color: p.blue2,
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 12,
    },
    actionTitleRed: { color: p.red },
    actionIcon: {
      color: p.green,
      fontSize: 48,
      lineHeight: 54,
      fontWeight: "900",
      marginBottom: 8,
    },
    actionIconRed: { color: p.red },
    actionBody: {
      color: p.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 13,
    },
    actionBodyRed: { color: p.red, fontWeight: "900" },
    actionButton: {
      height: 38,
      minWidth: 128,
      borderRadius: 5,
      backgroundColor: p.blue,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    actionButtonRed: { backgroundColor: p.red },
    actionButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    reportPreview: {
      minHeight: 220,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      marginBottom: 18,
    },
    reportTitle: {
      color: p.blue2,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
      textAlign: "center",
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
      marginBottom: 20,
    },
    reportIcon: {
      width: 58,
      height: 72,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: p.red,
      color: p.red,
      textAlign: "center",
      lineHeight: 68,
      fontSize: 16,
      fontWeight: "900",
    },
    qrPanel: {
      minHeight: 250,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      marginBottom: 18,
    },
    qrCode: {
      color: "#111827",
      fontSize: 44,
      lineHeight: 48,
      fontWeight: "900",
      textAlign: "center",
      marginBottom: 16,
    },
  });
