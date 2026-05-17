import { StatusBar } from "expo-status-bar";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { User } from "@supabase/supabase-js";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
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
  | "editProfile"
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
  | "shareView"
  | "stewardshipAlert"
  | "caseReport";

type RiskType = "Type 1" | "Type 2" | "Type 3";

type InfectionSite = {
  code: string;
  label: string;
  icon: string;
  tone: string;
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
  review_status: "approved";
  source_filename: string;
  page_number: number | null;
  section_heading: string | null;
  source_quote: string;
  extracted_at: string;
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
type DrawerMenuItem = {
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
  action: () => void;
  danger?: boolean;
};
type OtpTarget = {
  value: string;
};

type DoctorProfile = {
  name: string;
  email: string;
};

type SavedClinicalCase = {
  id: string;
  infectionSite: string;
  setting: string;
  acquisition: string;
  riskLevel: string;
  riskType: RiskType;
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
  "Alerts",
  "Profile",
];

const bottomTabIcons: Record<BottomTab, ComponentProps<typeof Feather>["name"]> = {
  Home: "home",
  Guidelines: "book-open",
  Duration: "clock",
  Alerts: "bell",
  Profile: "user",
};

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

const otpResendSeconds = 10;
const otpLength = 6;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;
const otpPattern = new RegExp(`^\\d{${otpLength}}$`);
const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");
const otpCooldownText = (remainingSeconds: number) =>
  `Resend available in ${remainingSeconds}s`;
const otpRequestReceivedMessage =
  "OTP request received. Please check your email inbox or try again later.";

const friendlyAuthError = (message: string | undefined, fallback: string) => {
  const normalized = (message ?? "").toLowerCase();

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return otpRequestReceivedMessage;
  }

  if (
    normalized.includes("invalid") ||
    normalized.includes("expired") ||
    normalized.includes("token")
  ) {
    return "Invalid OTP. Please try again.";
  }

  return fallback;
};

const profileFromUser = (user: User | null): DoctorProfile => {
  const metadata = user?.user_metadata ?? {};
  const metadataName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.display_name === "string"
        ? metadata.display_name
        : typeof metadata.name === "string"
          ? metadata.name
          : "";
  const userEmail = user?.email ?? "";
  const fallbackName = userEmail ? userEmail.split("@")[0] : "";

  return {
    name: metadataName.trim() || fallbackName,
    email: userEmail,
  };
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

const clinicalFieldScore = (value: string | null | undefined) =>
  hasDisplayValue(value) ? 1 : 0;

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile>({
    name: "",
    email: "",
  });
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [otpTarget, setOtpTarget] = useState<OtpTarget | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  const [otpTimer, setOtpTimer] = useState(0);
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
  const [sourceRecommendations, setSourceRecommendations] = useState<
    SourceRecommendation[]
  >([]);
  const [sourceRecommendationLoading, setSourceRecommendationLoading] =
    useState(false);
  const [sourceRecommendationError, setSourceRecommendationError] =
    useState("");
  const [savedCases, setSavedCases] = useState<SavedClinicalCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<SavedClinicalCase | null>(
    null,
  );
  const [actionMessage, setActionMessage] = useState("");
  const isAuthScreen =
    screen === "login" || screen === "signup" || screen === "otp";

  const applyUserProfile = (user: User | null) => {
    const nextProfile = profileFromUser(user);

    setCurrentUser(user);
    setDoctorProfile(nextProfile);
    setProfileNameInput(nextProfile.name);
    setProfileError("");
    setProfileSuccess("");
  };

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
        setLoginError(
          friendlyAuthError(error.message, "Unable to restore your session. Please login again."),
        );
      }

      const hasSession = Boolean(data.session);
      setIsAuthenticated(hasSession);
      applyUserProfile(data.session?.user ?? null);
      setRouteStack([hasSession ? "dashboard" : "login"]);
      setSessionReady(true);
      if (hasSession) {
        void loadApprovedSourceRecommendations();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = Boolean(session);
      setIsAuthenticated(hasSession);
      applyUserProfile(session?.user ?? null);
      setRouteStack([hasSession ? "dashboard" : "login"]);
      setActiveTab("Home");
      if (hasSession) {
        setAuthSuccess("Login successful.");
        setLoginError("");
        setOtp("");
        void loadApprovedSourceRecommendations();
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
    if (otpTimer <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setOtpTimer((remainingSeconds) => Math.max(remainingSeconds - 1, 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [otpTimer]);

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
  const fieldMatches = (value: string | null, expected: string) => {
    const normalizedValue = normalizeMatchText(value);
    const normalizedExpected = normalizeMatchText(expected);

    if (!normalizedValue || !normalizedExpected) {
      return true;
    }

    return (
      normalizedValue === normalizedExpected ||
      normalizedValue.includes(normalizedExpected) ||
      normalizedExpected.includes(normalizedValue) ||
      hasSharedToken(normalizedValue, normalizedExpected)
    );
  };

  const infectionMatchesSelection = (item: SourceRecommendation) => {
    const sourceCategory =
      canonicalInfectionCategory(item.infection_site) ??
      canonicalInfectionCategory(item.syndrome) ??
      canonicalInfectionCategory(item.section_heading) ??
      canonicalInfectionCategory(item.source_quote);
    const selectedCategory =
      canonicalInfectionCategory(selectedSite.code) ??
      canonicalInfectionCategory(selectedSite.label);

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

    const selectedInfection = normalizeMatchText(
      `${selectedSite.code} ${selectedSite.label}`,
    );
    const selectedAliases = normalizeMatchText(
      infectionAliases[selectedSite.code]?.join(" ") ?? "",
    );
    const selectedWithAliases = normalizeMatchText(
      `${selectedInfection} ${selectedAliases}`,
    );

    return (
      sourceInfection.includes(normalizeMatchText(selectedSite.code)) ||
      sourceInfection.includes(selectedInfection) ||
      selectedWithAliases.includes(sourceInfection) ||
      hasSharedToken(sourceInfection, selectedWithAliases)
    );
  };

  const applyProgressiveFilter = (
    rows: SourceRecommendation[],
    predicate: (item: SourceRecommendation) => boolean,
  ) => {
    const filteredRows = rows.filter(predicate);

    return filteredRows.length > 0 ? filteredRows : rows;
  };

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
    });

    return results.slice(0, 8);
  }, [searchQuery, sourceRecommendations]);

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
    setProfileError("");
    setProfileSuccess("");
    go("editProfile");
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

  const selectedSourceRecommendations = useMemo(() => {
    const infectionRows = sourceRecommendations.filter(infectionMatchesSelection);

    if (infectionRows.length === 0) {
      return [];
    }

    let matchedRows = infectionRows;

    matchedRows = applyProgressiveFilter(matchedRows, (item) =>
      fieldMatches(item.setting, setting),
    );
    matchedRows = applyProgressiveFilter(matchedRows, (item) =>
      fieldMatches(item.acquisition, acquisition),
    );
    matchedRows = applyProgressiveFilter(matchedRows, (item) =>
      fieldMatches(item.risk_type, riskType),
    );

    const recommendationScore = (item: SourceRecommendation) => {
      const scenarioScore =
        (item.setting && fieldMatches(item.setting, setting) ? 3 : 0) +
        (item.acquisition && fieldMatches(item.acquisition, acquisition)
          ? 3
          : 0) +
        (item.risk_type && fieldMatches(item.risk_type, riskType) ? 4 : 0);
      const completenessScore =
        clinicalFieldScore(item.dose) * 3 +
        clinicalFieldScore(item.route) * 2 +
        clinicalFieldScore(item.frequency) * 2 +
        clinicalFieldScore(item.duration);
      const safetyScore =
        (hasMeaningfulText(item.renal_adjustment) ? 1 : 0) +
        (hasMeaningfulText(item.allergy_warning) ? 1 : 0) +
        (hasMeaningfulText(item.stewardship_note) ? 1 : 0) +
        (hasMeaningfulText(item.id_consult_trigger) ? 1 : 0);

      return scenarioScore + completenessScore + safetyScore;
    };

    const cleanRows = cleanRecommendationRows(matchedRows)
      .sort((left, right) => recommendationScore(right) - recommendationScore(left))
      .slice(0, 6);

    return cleanRows;
  }, [
    acquisition,
    riskType,
    selectedSite,
    setting,
    sourceRecommendations,
  ]);

  const failClosedMessage =
    "No approved recommendation available. Refer institutional guideline / ID specialist.";
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
  const hasStewardshipGuidance =
    meaningfulWarningRecommendations.length > 0 ||
    meaningfulConsultRecommendations.length > 0;
  const isHighRiskCase = riskType === "Type 3";
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
    riskLevel: `${riskType} - ${riskLabel}`,
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
  const buildReportText = (reportCase = activeReportCase) => {
    const protocolLines = reportCase.recommendations
      .flatMap((item, index) => [
        `${index + 1}. ${item.drug?.trim()}`,
        ...recommendationLines(item).slice(1).map((line) => `   ${line}`),
      ])
      .join("\n");
    const stewardshipLines = [
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

    return [
      "Hinduja Antibiotic Guide Protocol Report",
      "",
      `Doctor: ${reportCase.doctorName || "Authenticated doctor"}`,
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
    if (selectedSourceRecommendations.length === 0) {
      setActionMessage(failClosedMessage);
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
    const html = buildReportHtml(text, Platform.OS === "web");

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
  const clearAuthMessages = () => {
    setLoginError("");
    setSignupError("");
    setAuthSuccess("");
  };

  const updateLoginEmail = (value: string) => {
    setEmail(value);
    clearAuthMessages();
  };

  const updateSignupEmail = (value: string) => {
    setSignupEmail(value);
    clearAuthMessages();
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
    setOtpTimer(otpResendSeconds);

    const { error } = await supabase.auth.signInWithOtp({
      email: target.value,
    });

    setAuthLoading(false);

    if (error) {
      const message = friendlyAuthError(
        error.message,
        "Unable to send OTP. Please check your email address and try again.",
      );
      if (message === otpRequestReceivedMessage) {
        setAuthSuccess(message);
      } else {
        setLoginError(message);
        setSignupError(message);
      }
      return;
    }

    setOtpTarget(target);
    setOtp("");
    setOtpTimer(otpResendSeconds);
    setAuthSuccess("OTP sent to your email.");
    go("otp");
  };

  const login = () => {
    const loginEmail = email.trim().toLowerCase();

    if (!emailPattern.test(loginEmail)) {
      setLoginError("Enter a valid hospital email address.");
      return;
    }

    void sendOtp({ value: loginEmail });
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
    void sendOtp({ value: newDoctorEmail });
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

    const currentDigits = otp.padEnd(otpLength, " ").split("");
    digits
      .slice(0, otpLength - index)
      .split("")
      .forEach((digit, offset) => {
        currentDigits[index + offset] = digit;
      });

    const nextOtp = currentDigits
      .join("")
      .replace(/\s/g, "")
      .slice(0, otpLength);
    setOtp(nextOtp);
    const nextIndex = Math.min(index + digits.length, otpLength - 1);
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
    if (!otpPattern.test(otp)) {
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

    const { error } = await supabase.auth.verifyOtp({
      email: otpTarget.value,
      token: otp,
      type: "email",
    });

    setAuthLoading(false);

    if (error) {
      setLoginError("Invalid OTP. Please try again.");
      return;
    }
  };

  const updateProfile = async () => {
    const trimmedName = profileNameInput.trim();

    if (!trimmedName) {
      setProfileError("Name is required.");
      setProfileSuccess("");
      return;
    }

    if (!currentUser) {
      setProfileError("Please login again before updating your profile.");
      setProfileSuccess("");
      return;
    }

    setProfileLoading(true);
    setProfileError("");
    setProfileSuccess("");

    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: trimmedName,
        display_name: trimmedName,
      },
    });

    setProfileLoading(false);

    if (error) {
      setProfileError(
        friendlyAuthError(error.message, "Unable to update profile. Please try again."),
      );
      return;
    }

    applyUserProfile(data.user ?? currentUser);
    setDoctorProfile((previousProfile) => ({
      ...previousProfile,
      name: trimmedName,
    }));
    setProfileNameInput(trimmedName);
    setProfileSuccess("Profile has been updated.");
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
    setDrawerOpen(false);
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    setAuthLoading(false);

    if (error) {
      setLoginError(friendlyAuthError(error.message, "Unable to logout. Please try again."));
      return;
    }

    setIsAuthenticated(false);
    applyUserProfile(null);
    setSourceRecommendations([]);
    setSourceRecommendationError("");
    setSavedCases([]);
    setSelectedCase(null);
    setActionMessage("");
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
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={goHome}
          style={styles.topIcon}
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          <Feather name="home" size={21} strokeWidth={2.5} color="#FFFFFF" />
        </TouchableOpacity>
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
      <View style={styles.inputWrap}>
        <Text style={styles.inputIcon}>✉</Text>
        <TextInput
          testID="login-email-input"
          accessibilityLabel="Hospital email"
          value={email}
          onChangeText={updateLoginEmail}
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
      {otpTimer > 0 ? (
        <Text style={styles.cooldownText}>{otpCooldownText(otpTimer)}</Text>
      ) : null}
      <PrimaryButton
        label="Send Email OTP"
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
          onChangeText={updateSignupEmail}
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
        {Array.from({ length: otpLength }, (_, index) => (
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
            maxLength={index === 0 ? otpLength : 1}
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
            ? otpCooldownText(otpTimer)
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

  const drawerMenuItems: DrawerMenuItem[] = [
    { label: "Home", icon: "home", action: goHome },
    { label: "Guidelines", icon: "book-open", action: () => goTab("Guidelines") },
    { label: "Duration", icon: "clock", action: () => goTab("Duration") },
    { label: "Alerts", icon: "bell", action: () => goTab("Alerts") },
    { label: "Profile", icon: "user", action: () => goTab("Profile") },
    { label: "Edit Profile", icon: "edit-3", action: goEditProfile },
    {
      label: "Logout",
      icon: "log-out",
      action: () => {
        void logout();
      },
      danger: true,
    },
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
        <Feather name="menu" size={22} strokeWidth={2.6} color="#FFFFFF" />
      </TouchableOpacity>
      <View style={styles.headerTextBlock}>
        <Text style={styles.headerTitle}>Hinduja Antibiotic Guide</Text>
        <Text style={styles.headerDoctor}>
          {doctorProfile.name || doctorProfile.email || "Authenticated doctor"}
        </Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={goHome}
        style={styles.headerButton}
        accessibilityRole="button"
        accessibilityLabel="Go to home"
      >
        <Feather name="home" size={21} strokeWidth={2.5} color="#FFFFFF" />
      </TouchableOpacity>
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
                {doctorProfile.name || "Authenticated doctor"}
              </Text>
              <Text style={styles.drawerEmail}>
                {doctorProfile.email || "Email not available"}
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
                <Feather
                  name={item.icon}
                  size={19}
                  strokeWidth={2.4}
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
                <Feather
                  name="chevron-right"
                  size={18}
                  strokeWidth={2.2}
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
              <Feather
                name={bottomTabIcons[tab]}
                size={20}
                strokeWidth={2.4}
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

  const SourceRecommendationCard = ({
    item,
    index,
  }: {
    item: SourceRecommendation;
    index: number;
  }) => (
    <View style={styles.therapyCard}>
      <Text style={styles.rank}>{index + 1}</Text>
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
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            {selectedSite.label} · {setting} · {acquisition}
          </Text>
          {selectedSourceRecommendations.length === 0 ? (
            <Text style={styles.infoCardBody}>
              {sourceRecommendationError || failClosedMessage}
            </Text>
          ) : (
            selectedSourceRecommendations
              .filter((item) => hasDisplayValue(item.duration))
              .map((item) => (
              <View key={item.id} style={styles.durationRow}>
                <Text style={styles.infoCardTitle}>{item.drug?.trim()}</Text>
                <Text style={styles.infoCardBody}>{item.duration?.trim()}</Text>
              </View>
            ))
          )}
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
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Stewardship Review</Text>
          {sourceRecommendationLoading ? (
            <ActivityIndicator color={palette.blue} />
          ) : selectedSourceRecommendations.length === 0 ? (
            <Text style={styles.infoCardBody}>
              {sourceRecommendationError || failClosedMessage}
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
          {doctorProfile.email || "Email not available"}
        </Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Access</Text>
          <Text style={styles.infoCardBody}>
            Authorized doctor account · Offline enabled · Activity audited
          </Text>
        </View>
        <PrimaryButton
          label="Edit Profile"
          onPress={() => {
            setProfileNameInput(doctorProfile.name);
            setProfileError("");
            setProfileSuccess("");
            go("editProfile");
          }}
        />
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
            <Text style={styles.inputIcon}>○</Text>
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
          <Text style={styles.fieldLabel}>Email *</Text>
          <View style={[styles.inputWrap, styles.readOnlyInputWrap]}>
            <Text style={styles.inputIcon}>✉</Text>
            <TextInput
              value={doctorProfile.email}
              editable={false}
              selectTextOnFocus={false}
              placeholder="Authenticated email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={[styles.textInput, styles.readOnlyTextInput, webTextInputReset]}
            />
          </View>
          <Text style={styles.readOnlyHint}>
            Email changes require a verified Supabase email update flow.
          </Text>
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
        <Text style={styles.resultSection}>Recommended Treatment Protocol</Text>
        {sourceRecommendationLoading ? (
          <View style={styles.noteBlue}>
            <Text style={styles.noteText}>Loading approved treatment data...</Text>
          </View>
        ) : selectedSourceRecommendations.length === 0 ? (
          <View style={[styles.noteBlue, styles.actionAlert]}>
            <Text style={[styles.noteText, styles.actionBodyRed]}>
              {sourceRecommendationError || failClosedMessage}
            </Text>
          </View>
        ) : (
          <View>
            {recommendedTreatmentRecommendations.map((item, index) => (
              <SourceRecommendationCard key={item.id} item={item} index={index} />
            ))}
            {alternativeTreatmentRecommendations.length > 0 ? (
              <View style={styles.alternativeSection}>
                <Text style={styles.resultSection}>Alternative Options</Text>
                {alternativeTreatmentRecommendations.map((item, index) => (
                  <SourceRecommendationCard
                    key={item.id}
                    item={item}
                    index={index}
                  />
                ))}
              </View>
            ) : null}
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
            <Text style={styles.detailsTitle}>Recommended Treatment Protocol</Text>
            {selectedSourceRecommendations.length === 0 ? (
              <View style={[styles.noteBlue, styles.actionAlert]}>
                <Text style={[styles.noteText, styles.actionBodyRed]}>
                  {failClosedMessage}
                </Text>
              </View>
            ) : (
              <View>
                {recommendedTreatmentRecommendations.map((item, index) => (
                  <SourceRecommendationCard
                    key={item.id}
                    item={item}
                    index={index}
                  />
                ))}
                {alternativeTreatmentRecommendations.length > 0 ? (
                  <View style={styles.alternativeSection}>
                    <Text style={styles.resultSection}>Alternative Options</Text>
                    {alternativeTreatmentRecommendations.map((item, index) => (
                      <SourceRecommendationCard
                        key={item.id}
                        item={item}
                        index={index}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}
        {protocolDetailTab === "Warnings" && (
          <View>
            <Text style={styles.detailsTitle}>Clinical Warnings</Text>
            {selectedSourceRecommendations.length === 0 ? (
              <View style={[styles.noteBlue, styles.actionAlert]}>
                <Text style={[styles.noteText, styles.actionBodyRed]}>
                  {failClosedMessage}
                </Text>
              </View>
            ) : meaningfulWarningRecommendations.length === 0 ? (
              <View style={styles.noteBlue}>
                <Text style={styles.noteText}>
                  No specific warnings documented in approved data for the current recommendations.
                </Text>
              </View>
            ) : (
              meaningfulWarningRecommendations.map((item) => {
                const warnings = ([
                  ["Renal adjustment", item.renal_adjustment],
                  ["Hepatic adjustment", item.hepatic_adjustment],
                  [
                    "Pregnancy/lactation caution",
                    item.pregnancy_lactation_caution,
                  ],
                  ["Allergy warning", item.allergy_warning],
                  ["Contraindication", item.contraindication],
                  ["Stewardship note", item.stewardship_note],
                ] as Array<[string, string | null]>).filter(([, value]) =>
                  hasMeaningfulText(value),
                );

                return (
                  <View key={item.id} style={[styles.noteBlue, styles.actionAlert]}>
                    <Text style={styles.therapyName}>{item.drug?.trim()}</Text>
                    {warnings.map(([label, value]) => (
                      <RecommendationField
                        key={`${item.id}-${label}`}
                        label={label}
                        value={value}
                      />
                    ))}
                  </View>
                );
              })
            )}
          </View>
        )}
        {protocolDetailTab === "ID Consult" && (
          <View>
            <Text style={styles.detailsTitle}>
              Infectious Disease Consult Guidance
            </Text>
            {selectedSourceRecommendations.length === 0 ? (
              <View style={[styles.noteBlue, styles.actionAlert]}>
                <Text style={[styles.noteText, styles.actionBodyRed]}>
                  {failClosedMessage}
                </Text>
              </View>
            ) : meaningfulConsultRecommendations.length === 0 ? (
              <View style={styles.noteBlue}>
                <Text style={styles.noteText}>
                  No specific ID consult trigger documented in approved data for the current recommendations.
                </Text>
              </View>
            ) : (
              meaningfulConsultRecommendations.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.86}
                    style={styles.listCard}
                    onPress={() => go("stewardshipAlert")}
                  >
                    <Text style={styles.listIcon}>□</Text>
                    <Text style={styles.listText}>
                      {item.id_consult_trigger?.trim()}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))
            )}
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
        {actionMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{actionMessage}</Text>
          </View>
        ) : null}
        <View style={styles.actionsGrid}>
          <ActionCard
            title="Save to My Cases"
            body="Save this selected scenario and approved protocol as a case report."
            button="Save Case"
            icon="save"
            onPress={saveCurrentCase}
          />
          <ActionCard
            title="Export PDF"
            body="Generate a professional PDF report of this case."
            button="Export PDF"
            icon="file-text"
            onPress={() => {
              setSelectedCase(currentCaseSnapshot());
              void exportReportPdf();
            }}
          />
          <ActionCard
            title="Share with Team"
            body="Share this clinical report via WhatsApp, Email, or other apps."
            button="Share"
            icon="share-2"
            onPress={() => {
              setSelectedCase(currentCaseSnapshot());
              go("shareView");
            }}
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
    icon: ComponentProps<typeof Feather>["name"];
    alert?: boolean;
    onPress: () => void;
  }) => (
    <View style={[styles.actionCard, alert && styles.actionAlert]}>
      <Text style={[styles.actionTitle, alert && styles.actionTitleRed]}>
        {title}
      </Text>
      <Feather
        name={icon}
        size={44}
        strokeWidth={2.2}
        color={alert ? palette.red : palette.green}
        style={styles.actionIcon}
      />
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
        {actionMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{actionMessage}</Text>
          </View>
        ) : null}
        {savedCases.length === 0 ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>No saved cases yet</Text>
            <Text style={styles.infoCardBody}>
              Save a selected protocol from Actions to create a case report.
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
          icon="whatsapp"
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
          icon="bluetooth"
          onPress={shareBluetooth}
        />
        <ShareRow
          title="More"
          subtitle="Open native share or copy report text"
          icon="more-horizontal"
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
    icon: "whatsapp" | ComponentProps<typeof Feather>["name"];
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
        {icon === "whatsapp" ? (
          <FontAwesome name="whatsapp" size={22} color="#FFFFFF" />
        ) : (
          <Feather
            name={icon}
            size={21}
            strokeWidth={2.3}
            color={brandColor ? "#FFFFFF" : palette.blue}
          />
        )}
      </View>
      <View style={styles.shareTextBlock}>
        <Text style={styles.listText}>{title}</Text>
        <Text style={styles.infoCardBody}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
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
            <Feather name="file-text" size={24} color={palette.red} />
            <Text style={styles.reportIconText}>PDF</Text>
          </View>
        </View>
        <View style={styles.reportSection}>
          <Text style={styles.detailsTitle}>Doctor</Text>
          <Text style={styles.infoCardBody}>
            {reportCase.doctorName || "Authenticated doctor"}
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
            reportCase.recommendations.map((item, index) => (
              <SourceRecommendationCard key={item.id} item={item} index={index} />
            ))
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
          {sourceRecommendationLoading ? (
            <ActivityIndicator color={palette.blue} />
          ) : selectedSourceRecommendations.length === 0 ? (
            <Text style={styles.infoCardBody}>
              {sourceRecommendationError || failClosedMessage}
            </Text>
          ) : !shouldShowStewardshipAlert ? (
            <Text style={styles.infoCardBody}>
              No stewardship alert is triggered for the current approved
              recommendations.
            </Text>
          ) : (
            <View>
              <Text style={styles.detailLabel}>Risk level</Text>
              <Text style={styles.infoCardBody}>
                {riskType} - {riskLabel}
              </Text>
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
      case "editProfile":
        return EditProfile();
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
    cooldownText: {
      color: p.muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 8,
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
    readOnlyInputWrap: {
      backgroundColor: "#F1F6FC",
      borderColor: "#CADBEC",
    },
    readOnlyTextInput: {
      color: p.muted,
    },
    readOnlyHint: {
      color: p.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: -6,
      marginBottom: 14,
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
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTextBlock: { flex: 1, paddingHorizontal: 12 },
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
    alternativeSection: {
      marginTop: 8,
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
    durationRow: {
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
    actionsGrid: { gap: 14 },
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
      marginBottom: 8,
    },
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
