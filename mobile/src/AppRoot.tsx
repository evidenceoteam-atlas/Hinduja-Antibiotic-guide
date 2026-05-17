import { StatusBar } from "expo-status-bar";
import Feather from "@expo/vector-icons/Feather";
import type { User } from "@supabase/supabase-js";
import type { ComponentProps, ReactNode } from "react";
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
type OtpTarget = {
  value: string;
};

type DoctorProfile = {
  name: string;
  email: string;
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
const notSpecifiedInSource = "Not specified in source";

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
]);

const splitMatchTokens = (value: string | null | undefined) =>
  normalizeMatchText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !matchStopWords.has(token));

const hasSharedToken = (left: string, right: string) => {
  const leftTokens = new Set(splitMatchTokens(left));
  return splitMatchTokens(right).some((token) => leftTokens.has(token));
};

const sourceValue = (value: string | null | undefined) =>
  value?.trim() || notSpecifiedInSource;

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
    const sourceInfection = normalizeMatchText(
      `${item.infection_site ?? ""} ${item.syndrome ?? ""}`,
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
    label: string,
    predicate: (item: SourceRecommendation) => boolean,
  ) => {
    const filteredRows = rows.filter(predicate);

    console.log(
      `[clinical recommendations] ${label} filter retained ${filteredRows.length}/${rows.length} rows`,
    );

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

  const loadApprovedSourceRecommendations = async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    setSourceRecommendationLoading(true);
    setSourceRecommendationError("");

    console.log(
      "[clinical recommendations] Supabase query: approved_clinical_recommendations_with_source select * order syndrome asc",
    );

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

    console.log(
      `[clinical recommendations] Supabase rows returned: ${(data ?? []).length}`,
    );
    setSourceRecommendations((data ?? []) as SourceRecommendation[]);
  };

  const selectedSourceRecommendations = useMemo(() => {
    console.log("[clinical recommendations] selected filters", {
      infectionSiteCode: selectedSite.code,
      infectionSiteLabel: selectedSite.label,
      setting,
      acquisition,
      riskType,
      approvedRowsLoaded: sourceRecommendations.length,
    });

    const infectionRows = sourceRecommendations.filter(infectionMatchesSelection);

    console.log(
      `[clinical recommendations] infection/syndrome base match returned ${infectionRows.length} rows`,
    );

    let matchedRows = infectionRows;

    matchedRows = applyProgressiveFilter(matchedRows, "setting", (item) =>
      fieldMatches(item.setting, setting),
    );
    matchedRows = applyProgressiveFilter(matchedRows, "acquisition", (item) =>
      fieldMatches(item.acquisition, acquisition),
    );
    matchedRows = applyProgressiveFilter(matchedRows, "risk", (item) =>
      fieldMatches(item.risk_type, riskType),
    );

    console.log(
      `[clinical recommendations] progressive matching returned ${matchedRows.length} rows`,
    );

    return matchedRows;
  }, [acquisition, riskType, selectedSite, setting, sourceRecommendations]);

  const failClosedMessage =
    "No approved recommendation available. Refer institutional guideline / ID specialist.";
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

  const Dashboard = () => (
    <View style={styles.dashboardScreen}>
      <View style={styles.dashboardHeader}>
        <View style={styles.menuBox}>
          <Text style={styles.menuText}>≡</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Hinduja Antibiotic Guide</Text>
          <Text style={styles.headerDoctor}>
            {doctorProfile.name || doctorProfile.email || "Authenticated doctor"}
          </Text>
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

  const RecommendationField = ({
    label,
    value,
  }: {
    label: string;
    value: string | null | undefined;
  }) => (
    <View style={styles.recommendationField}>
      <Text style={styles.recommendationFieldLabel}>{label}</Text>
      <Text style={styles.recommendationFieldValue}>{sourceValue(value)}</Text>
    </View>
  );

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
        <Text style={styles.therapyName}>{sourceValue(item.drug)}</Text>
        <RecommendationField label="Dose" value={item.dose} />
        <RecommendationField label="Route" value={item.route} />
        <RecommendationField label="Frequency" value={item.frequency} />
        <RecommendationField label="Duration" value={item.duration} />
        <RecommendationField
          label="Renal adjustment"
          value={item.renal_adjustment}
        />
        <RecommendationField label="Allergy warning" value={item.allergy_warning} />
        <RecommendationField
          label="Stewardship note"
          value={item.stewardship_note}
        />
        <View style={styles.sourceQuoteBox}>
          <Text style={styles.recommendationFieldLabel}>Source quote</Text>
          <Text style={styles.detailText}>{sourceValue(item.source_quote)}</Text>
          <Text style={styles.detailText}>
            {item.source_filename}
            {item.page_number ? ` · page ${item.page_number}` : ""}
            {item.section_heading ? ` · ${item.section_heading}` : ""}
          </Text>
        </View>
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
            selectedSourceRecommendations.map((item) => (
              <View key={item.id} style={styles.durationRow}>
                <Text style={styles.infoCardTitle}>{sourceValue(item.drug)}</Text>
                <Text style={styles.infoCardBody}>
                  {sourceValue(item.duration)}
                </Text>
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
          ) : (
            selectedSourceRecommendations.map((item) => (
              <View key={item.id} style={styles.durationRow}>
                <Text style={styles.infoCardTitle}>{sourceValue(item.drug)}</Text>
                <Text style={styles.infoCardBody}>
                  Stewardship: {sourceValue(item.stewardship_note)}
                </Text>
                <Text style={styles.infoCardBody}>
                  Allergy: {sourceValue(item.allergy_warning)}
                </Text>
                <Text style={styles.infoCardBody}>
                  Renal: {sourceValue(item.renal_adjustment)}
                </Text>
                <Text style={styles.detailText}>
                  Source: {item.source_filename}
                  {item.page_number ? ` · page ${item.page_number}` : ""}
                </Text>
              </View>
            ))
          )}
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.actionButton}
            onPress={() => go("stewardshipAlert")}
          >
            <Text style={styles.actionButtonText}>Open Source Review</Text>
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
        <Text style={styles.resultSection}>Approved Source-Based Therapy</Text>
        {sourceRecommendationLoading ? (
          <View style={styles.noteBlue}>
            <Text style={styles.noteText}>Loading approved source data...</Text>
          </View>
        ) : selectedSourceRecommendations.length === 0 ? (
          <View style={[styles.noteBlue, styles.actionAlert]}>
            <Text style={[styles.noteText, styles.actionBodyRed]}>
              {sourceRecommendationError || failClosedMessage}
            </Text>
          </View>
        ) : (
          selectedSourceRecommendations.map((item, index) => (
            <SourceRecommendationCard key={item.id} item={item} index={index} />
          ))
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
            <Text style={styles.detailsTitle}>Source Evidence</Text>
            {selectedSourceRecommendations.length === 0 ? (
              <View style={[styles.noteBlue, styles.actionAlert]}>
                <Text style={[styles.noteText, styles.actionBodyRed]}>
                  {failClosedMessage}
                </Text>
              </View>
            ) : (
              selectedSourceRecommendations.map((item) => (
                <View key={item.id} style={styles.noteBlue}>
                  <Text style={styles.noteText}>
                    {item.source_quote || "Source quote missing"}
                  </Text>
                  <Text style={styles.detailText}>
                    {item.source_filename}
                    {item.page_number ? ` · page ${item.page_number}` : ""}
                    {item.section_heading ? ` · ${item.section_heading}` : ""}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
        {protocolDetailTab === "Warnings" && (
          <View>
            <Text style={styles.detailsTitle}>Source-Linked Warnings</Text>
            {selectedSourceRecommendations.length === 0 ? (
              <View style={[styles.noteBlue, styles.actionAlert]}>
                <Text style={[styles.noteText, styles.actionBodyRed]}>
                  {failClosedMessage}
                </Text>
              </View>
            ) : (
              selectedSourceRecommendations.map((item) => (
                <View key={item.id} style={[styles.noteBlue, styles.actionAlert]}>
                  <RecommendationField
                    label="Renal adjustment"
                    value={item.renal_adjustment}
                  />
                  <RecommendationField
                    label="Hepatic adjustment"
                    value={item.hepatic_adjustment}
                  />
                  <RecommendationField
                    label="Pregnancy/lactation caution"
                    value={item.pregnancy_lactation_caution}
                  />
                  <RecommendationField
                    label="Allergy warning"
                    value={item.allergy_warning}
                  />
                  <RecommendationField
                    label="Contraindication"
                    value={item.contraindication}
                  />
                  <RecommendationField
                    label="Stewardship note"
                    value={item.stewardship_note}
                  />
                </View>
              ))
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
            ) : (
              selectedSourceRecommendations.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.86}
                  style={styles.listCard}
                  onPress={() => go("stewardshipAlert")}
                >
                  <Text style={styles.listIcon}>□</Text>
                  <Text style={styles.listText}>
                    {sourceValue(item.id_consult_trigger)}
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
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Source-Linked Stewardship</Text>
          {sourceRecommendationLoading ? (
            <ActivityIndicator color={palette.blue} />
          ) : selectedSourceRecommendations.length === 0 ? (
            <Text style={styles.infoCardBody}>
              {sourceRecommendationError || failClosedMessage}
            </Text>
          ) : (
            selectedSourceRecommendations.map((item) => (
              <View key={item.id} style={styles.durationRow}>
                <Text style={styles.infoCardTitle}>{sourceValue(item.drug)}</Text>
                <Text style={styles.infoCardBody}>
                  Stewardship: {sourceValue(item.stewardship_note)}
                </Text>
                <Text style={styles.infoCardBody}>
                  ID consult: {sourceValue(item.id_consult_trigger)}
                </Text>
                <Text style={styles.infoCardBody}>
                  Contraindication: {sourceValue(item.contraindication)}
                </Text>
                <Text style={styles.detailText}>
                  Source: {item.source_filename}
                  {item.page_number ? ` · page ${item.page_number}` : ""}
                </Text>
              </View>
            ))
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
    recommendationField: {
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
    sourceQuoteBox: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      paddingTop: 8,
      marginTop: 2,
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
