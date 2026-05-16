import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { evaluateRecommendation, insufficientMessage } from "./clinicalEngine";
import { isSupabaseConfigured, supabase } from "./supabase";
import type {
  Antibiotic,
  DoctorProfile,
  Infection,
  RecommendationInput,
  RecommendationResult,
  RenalAdjustment,
  RiskFactor,
  SafetyItem,
  TreatmentGuideline,
} from "./types";

type Screen =
  | "login"
  | "otp"
  | "profile"
  | "home"
  | "antibiotics"
  | "infections"
  | "antibioticDetail"
  | "guidelineDetail"
  | "risk"
  | "renal"
  | "pregnancy"
  | "allergy"
  | "favorites"
  | "recent"
  | "admin"
  | "privacy";

type LoadState = "idle" | "loading" | "ready" | "error";

type ClinicalData = {
  antibiotics: Antibiotic[];
  infections: Infection[];
  guidelines: TreatmentGuideline[];
  riskFactors: RiskFactor[];
  renalAdjustments: RenalAdjustment[];
  pregnancySafety: SafetyItem[];
  contraindications: SafetyItem[];
  allergyCrossReactivity: SafetyItem[];
};

const emptyData: ClinicalData = {
  antibiotics: [],
  infections: [],
  guidelines: [],
  riskFactors: [],
  renalAdjustments: [],
  pregnancySafety: [],
  contraindications: [],
  allergyCrossReactivity: [],
};

const defaultInput: RecommendationInput = {
  infectionId: null,
  setting: "ICU",
  acquisition: "Community-acquired",
  severity: "Any",
  ageGroup: "adult",
  pregnancyStatus: "unknown",
  egfr: "",
  hepaticImpairment: "none",
  allergyClass: "",
  riskAnswers: {},
};

const screens: Array<{ key: Screen; label: string }> = [
  { key: "home", label: "Home" },
  { key: "infections", label: "Infections" },
  { key: "antibiotics", label: "Antibiotics" },
  { key: "risk", label: "Risk" },
  { key: "profile", label: "Profile" },
];

const isAdminRole = (role?: string | null) => role === "admin" || role === "reviewer";

export default function AppRoot() {
  const { width } = useWindowDimensions();
  const [screenStack, setScreenStack] = useState<Screen[]>(["login"]);
  const screen = screenStack[screenStack.length - 1];
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [data, setData] = useState<ClinicalData>(emptyData);
  const [query, setQuery] = useState("");
  const [selectedAntibiotic, setSelectedAntibiotic] = useState<Antibiotic | null>(null);
  const [selectedInfection, setSelectedInfection] = useState<Infection | null>(null);
  const [input, setInput] = useState<RecommendationInput>(defaultInput);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [favorites, setFavorites] = useState<Array<{ type: string; id: string; title: string }>>([]);
  const [recent, setRecent] = useState<Array<{ type: string; id: string; title: string }>>([]);
  const [notice, setNotice] = useState("");
  const [adminTitle, setAdminTitle] = useState("");
  const [adminCitation, setAdminCitation] = useState("");

  const isWide = width >= 760;
  const activeScreen = screen === "login" || screen === "otp" ? "home" : screen;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSessionReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data: authData }) => {
      const hasSession = Boolean(authData.session);
      setIsAuthenticated(hasSession);
      setScreenStack([hasSession ? "home" : "login"]);
      setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const hasSession = Boolean(nextSession);
      setIsAuthenticated(hasSession);
      setScreenStack([hasSession ? "home" : "login"]);
      if (hasSession) {
        void loadClinicalData();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadClinicalData();
    }
  }, [isAuthenticated]);

  const approvedGuidelinesForSelection = useMemo(
    () =>
      data.guidelines.filter(
        (item) =>
          !input.infectionId ||
          item.infection_id === input.infectionId ||
          item.infection?.id === input.infectionId,
      ),
    [data.guidelines, input.infectionId],
  );

  const filteredAntibiotics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return data.antibiotics;
    }
    return data.antibiotics.filter((item) =>
      [item.name, item.generic_name, item.class_name, item.spectrum_summary]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data.antibiotics, query]);

  const filteredInfections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return data.infections;
    }
    return data.infections.filter((item) =>
      [item.code, item.name, item.body_site, item.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data.infections, query]);

  const go = (next: Screen, reset = false) => {
    setNotice("");
    setScreenStack((current) => (reset ? [next] : [...current, next]));
  };

  const back = () => {
    setNotice("");
    setScreenStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  };

  const trackRecent = async (type: string, id: string, title: string) => {
    setRecent((items) => [{ type, id, title }, ...items.filter((item) => item.id !== id)].slice(0, 10));
    const userId = profile?.id;
    if (userId && isSupabaseConfigured) {
      await supabase.from("recently_viewed").insert({ user_id: userId, item_type: type, item_id: id });
    }
  };

  const addFavorite = async (type: string, id: string, title: string) => {
    setFavorites((items) =>
      items.some((item) => item.id === id) ? items : [{ type, id, title }, ...items],
    );
    const userId = profile?.id;
    if (userId && isSupabaseConfigured) {
      const { error } = await supabase
        .from("bookmarks")
        .upsert({ user_id: userId, item_type: type, item_id: id });
      if (error) {
        setNotice(error.message);
        return;
      }
    }
    setNotice("Saved to favorites.");
  };

  const sendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setAuthMessage("Enter a valid hospital email address.");
      return;
    }
    if (!isSupabaseConfigured) {
      setAuthMessage("Supabase environment variables are missing.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setAuthLoading(false);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setOtp("");
    setAuthMessage("OTP sent. Check your email.");
    go("otp");
  };

  const verifyOtp = async () => {
    const token = otp.trim();
    if (!/^\d{6}$/.test(token)) {
      setAuthMessage("Enter the 6 digit OTP from email.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setAuthLoading(false);

    if (error) {
      setAuthMessage(error.message || "OTP failed or expired.");
      return;
    }

    setOtp("");
    setAuthMessage("");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setData(emptyData);
    setRecommendation(null);
    setScreenStack(["login"]);
  };

  const loadClinicalData = async () => {
    if (!isSupabaseConfigured) {
      setLoadError("Supabase is not configured.");
      setLoadState("error");
      return;
    }

    setLoadState("loading");
    setLoadError("");

    const profilePromise = supabase.from("doctor_profiles").select("*").maybeSingle();
    const antibioticsPromise = supabase
      .from("antibiotics")
      .select("*")
      .eq("review_status", "approved")
      .order("name");
    const infectionsPromise = supabase
      .from("infections")
      .select("*")
      .eq("review_status", "approved")
      .order("name");
    const guidelinesPromise = supabase
      .from("treatment_guidelines")
      .select(
        "*, infection:infections(*), source_reference:references(*), guideline_antibiotics(*, antibiotic:antibiotics(*), source_reference:references(*))",
      )
      .eq("review_status", "approved")
      .order("title");
    const riskPromise = supabase
      .from("risk_factors")
      .select("*")
      .eq("review_status", "approved")
      .order("label");
    const renalPromise = supabase
      .from("renal_adjustments")
      .select("*, antibiotic:antibiotics(*), source_reference:references(*)")
      .eq("review_status", "approved");
    const pregnancyPromise = supabase
      .from("pregnancy_lactation_safety")
      .select("*, antibiotic:antibiotics(*), source_reference:references(*)")
      .eq("review_status", "approved");
    const contraindicationsPromise = supabase
      .from("contraindications")
      .select("*, antibiotic:antibiotics(*), source_reference:references(*)")
      .eq("review_status", "approved");
    const allergyPromise = supabase
      .from("allergy_cross_reactivity")
      .select("*, antibiotic:antibiotics(*), source_reference:references(*)")
      .eq("review_status", "approved");

    const [
      profileResult,
      antibiotics,
      infections,
      guidelines,
      riskFactors,
      renalAdjustments,
      pregnancySafety,
      contraindications,
      allergyCrossReactivity,
    ] = await Promise.all([
      profilePromise,
      antibioticsPromise,
      infectionsPromise,
      guidelinesPromise,
      riskPromise,
      renalPromise,
      pregnancyPromise,
      contraindicationsPromise,
      allergyPromise,
    ]);

    const firstError =
      profileResult.error ??
      antibiotics.error ??
      infections.error ??
      guidelines.error ??
      riskFactors.error ??
      renalAdjustments.error ??
      pregnancySafety.error ??
      contraindications.error ??
      allergyCrossReactivity.error;

    if (firstError) {
      setLoadError(firstError.message);
      setLoadState("error");
      return;
    }

    setProfile((profileResult.data as DoctorProfile | null) ?? null);
    setData({
      antibiotics: (antibiotics.data ?? []) as Antibiotic[],
      infections: (infections.data ?? []) as Infection[],
      guidelines: (guidelines.data ?? []) as unknown as TreatmentGuideline[],
      riskFactors: (riskFactors.data ?? []) as RiskFactor[],
      renalAdjustments: (renalAdjustments.data ?? []) as unknown as RenalAdjustment[],
      pregnancySafety: (pregnancySafety.data ?? []) as unknown as SafetyItem[],
      contraindications: (contraindications.data ?? []) as unknown as SafetyItem[],
      allergyCrossReactivity: (allergyCrossReactivity.data ?? []) as unknown as SafetyItem[],
    });
    setLoadState("ready");
  };

  const evaluate = () => {
    const result = evaluateRecommendation(input, approvedGuidelinesForSelection);
    setRecommendation(result);
    setNotice(result.status === "ok" ? result.message : result.message);
  };

  const createDraftReference = async () => {
    if (!adminTitle.trim() || !adminCitation.trim()) {
      setNotice("Reference title and citation are required.");
      return;
    }

    const { error } = await supabase.from("references").insert({
      title: adminTitle.trim(),
      citation: adminCitation.trim(),
      review_status: "draft",
    });
    if (error) {
      setNotice(error.message);
      return;
    }
    setAdminTitle("");
    setAdminCitation("");
    setNotice("Draft reference created. A reviewer must approve it before doctors can see dependent recommendations.");
  };

  if (!sessionReady) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator />
        <Text style={styles.muted}>Preparing secure session...</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.authScreen}>
        <StatusBar style="dark" />
        <View style={styles.authPanel}>
          <Text style={styles.brand}>Hinduja Antibiotic Guide</Text>
          <Text style={styles.subtitle}>Doctor sign-in with email OTP</Text>
          {!isSupabaseConfigured && (
            <Banner tone="danger">
              Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
            </Banner>
          )}
          {screen === "login" ? (
            <View>
              <Field
                label="Hospital email"
                value={email}
                onChangeText={setEmail}
                placeholder="doctor@hospital.org"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <PrimaryButton label="Send OTP" onPress={sendOtp} loading={authLoading} />
              <TouchableOpacity onPress={() => go("privacy")}>
                <Text style={styles.link}>Medical disclaimer and privacy notes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Field
                label="Email OTP"
                value={otp}
                onChangeText={setOtp}
                placeholder="6 digit code"
                keyboardType="number-pad"
                maxLength={6}
              />
              <PrimaryButton label="Verify OTP" onPress={verifyOtp} loading={authLoading} />
              <SecondaryButton label="Use another email" onPress={() => go("login", true)} />
            </View>
          )}
          {authMessage ? <Text style={styles.errorText}>{authMessage}</Text> : null}
          <Disclaimer />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.appFrame, isWide && styles.appFrameWide]}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandSmall}>Hinduja Antibiotic Guide</Text>
            <Text style={styles.muted}>
              {profile?.full_name || profile?.email || "Authenticated doctor"}
            </Text>
          </View>
          <TouchableOpacity style={styles.smallButton} onPress={logout}>
            <Text style={styles.smallButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        <Disclaimer compact />
        {notice ? <Banner tone={recommendation?.status === "insufficient" ? "danger" : "info"}>{notice}</Banner> : null}
        {loadState === "loading" ? (
          <View style={styles.centerPanel}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading approved clinical data...</Text>
          </View>
        ) : loadState === "error" ? (
          <View style={styles.centerPanel}>
            <Banner tone="danger">{loadError}</Banner>
            <PrimaryButton label="Retry" onPress={loadClinicalData} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {screen === "home" && <Home />}
            {screen === "profile" && <Profile />}
            {screen === "antibiotics" && <Antibiotics />}
            {screen === "infections" && <Infections />}
            {screen === "antibioticDetail" && <AntibioticDetail />}
            {screen === "guidelineDetail" && <GuidelineDetail />}
            {screen === "risk" && <RiskAssessment />}
            {screen === "renal" && <RenalAdjustments />}
            {screen === "pregnancy" && <PregnancySafety />}
            {screen === "allergy" && <AllergyWarnings />}
            {screen === "favorites" && <ListScreen title="Favorites" items={favorites} empty="No bookmarks yet." />}
            {screen === "recent" && <ListScreen title="Recently viewed" items={recent} empty="No recently viewed records yet." />}
            {screen === "admin" && <Admin />}
            {screen === "privacy" && <Privacy />}
          </ScrollView>
        )}
        <View style={styles.bottomTabs}>
          {screens.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.tab, activeScreen === item.key && styles.activeTab]}
              onPress={() => go(item.key, true)}
            >
              <Text style={[styles.tabText, activeScreen === item.key && styles.activeTabText]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );

  function Home() {
    return (
      <View>
        <Text style={styles.h1}>Clinical dashboard</Text>
        <View style={styles.metricsRow}>
          <Metric label="Approved antibiotics" value={data.antibiotics.length} />
          <Metric label="Approved infections" value={data.infections.length} />
          <Metric label="Approved guidelines" value={data.guidelines.length} />
        </View>
        <View style={styles.grid}>
          <NavCard title="Search antibiotics" body="Approved drug records, warnings, and source traceability." onPress={() => go("antibiotics")} />
          <NavCard title="Search disease/infection" body="Browse approved infection records and treatment guidelines." onPress={() => go("infections")} />
          <NavCard title="Risk assessment" body="Rule-based match that fails closed when data is missing." onPress={() => go("risk")} />
          <NavCard title="Renal dose adjustment" body="Source-linked renal adjustment records." onPress={() => go("renal")} />
          <NavCard title="Pregnancy/lactation safety" body="Reviewed safety notes only." onPress={() => go("pregnancy")} />
          <NavCard title="Allergy warnings" body="Contraindications and cross-reactivity checks." onPress={() => go("allergy")} />
          <NavCard title="Favorites/bookmarks" body="Saved clinical records." onPress={() => go("favorites")} />
          <NavCard title="Recently viewed" body="Recent approved records opened on this device." onPress={() => go("recent")} />
          {isAdminRole(profile?.role) && (
            <NavCard title="Admin/content review" body="Create draft source records and review content gates." onPress={() => go("admin")} />
          )}
        </View>
        <EmptyIfNeeded />
      </View>
    );
  }

  function Profile() {
    return (
      <View>
        <BackTitle title="Doctor profile" />
        <Card>
          <Text style={styles.cardTitle}>{profile?.full_name || "Doctor profile incomplete"}</Text>
          <Text style={styles.body}>{profile?.email}</Text>
          <Text style={styles.body}>{profile?.department || "Department not set"}</Text>
          <Text style={styles.body}>{profile?.designation || "Designation not set"}</Text>
          <Text style={styles.badge}>{profile?.role || "doctor"}</Text>
        </Card>
        <PrimaryButton label="Refresh profile and clinical data" onPress={loadClinicalData} />
        <SecondaryButton label="Privacy and disclaimer" onPress={() => go("privacy")} />
      </View>
    );
  }

  function Antibiotics() {
    return (
      <View>
        <BackTitle title="Search antibiotics" />
        <SearchBox />
        {filteredAntibiotics.length === 0 ? (
          <Empty text="No approved antibiotic records found." />
        ) : (
          filteredAntibiotics.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                setSelectedAntibiotic(item);
                void trackRecent("antibiotic", item.id, item.name);
                go("antibioticDetail");
              }}
            >
              <Card>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.body}>{item.class_name || "Class not documented"}</Text>
                <Text style={styles.trace}>Reviewed: {item.last_reviewed_at || "date not recorded"}</Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  }

  function Infections() {
    return (
      <View>
        <BackTitle title="Search disease/infection" />
        <SearchBox />
        {filteredInfections.length === 0 ? (
          <Empty text="No approved infection records found." />
        ) : (
          filteredInfections.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                setSelectedInfection(item);
                setInput((current) => ({ ...current, infectionId: item.id }));
                void trackRecent("infection", item.id, item.name);
                go("guidelineDetail");
              }}
            >
              <Card>
                <Text style={styles.cardTitle}>
                  {item.code} - {item.name}
                </Text>
                <Text style={styles.body}>{item.description || "No description documented."}</Text>
                <Text style={styles.trace}>Reviewed: {item.last_reviewed_at || "date not recorded"}</Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  }

  function AntibioticDetail() {
    if (!selectedAntibiotic) {
      return <Empty text="Select an antibiotic first." />;
    }

    const renal = data.renalAdjustments.filter((item) => item.antibiotic?.id === selectedAntibiotic.id);
    const pregnancy = data.pregnancySafety.filter((item) => item.antibiotic?.id === selectedAntibiotic.id);
    const contraindications = data.contraindications.filter((item) => item.antibiotic?.id === selectedAntibiotic.id);

    return (
      <View>
        <BackTitle title="Antibiotic detail" />
        <Card>
          <Text style={styles.h1}>{selectedAntibiotic.name}</Text>
          <Text style={styles.body}>{selectedAntibiotic.spectrum_summary || "Spectrum summary not documented."}</Text>
          {selectedAntibiotic.black_box_warning ? (
            <Banner tone="danger">{selectedAntibiotic.black_box_warning}</Banner>
          ) : null}
          <Text style={styles.trace}>Review status: {selectedAntibiotic.review_status}</Text>
          <Text style={styles.trace}>Last reviewed: {selectedAntibiotic.last_reviewed_at || "not recorded"}</Text>
        </Card>
        <PrimaryButton label="Bookmark antibiotic" onPress={() => addFavorite("antibiotic", selectedAntibiotic.id, selectedAntibiotic.name)} />
        <Section title="Renal adjustments" count={renal.length} onOpen={() => go("renal")} />
        <Section title="Pregnancy/lactation safety" count={pregnancy.length} onOpen={() => go("pregnancy")} />
        <Section title="Contraindications" count={contraindications.length} onOpen={() => go("allergy")} />
      </View>
    );
  }

  function GuidelineDetail() {
    const infection = selectedInfection ?? data.infections.find((item) => item.id === input.infectionId) ?? null;
    const guidelines = data.guidelines.filter((item) => item.infection_id === infection?.id);
    return (
      <View>
        <BackTitle title="Infection/treatment guideline" />
        {infection ? (
          <Card>
            <Text style={styles.h1}>{infection.name}</Text>
            <Text style={styles.body}>{infection.description || "No description documented."}</Text>
            <Text style={styles.trace}>Only approved, source-linked guidelines are shown below.</Text>
          </Card>
        ) : (
          <Empty text="Select an infection to view guidelines." />
        )}
        {guidelines.length === 0 ? (
          <Empty text="No approved treatment guidelines for this infection." />
        ) : (
          guidelines.map((item) => (
            <Card key={item.id}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.body}>
                {item.setting} / {item.acquisition} / {item.severity}
              </Text>
              <Text style={styles.body}>{item.summary || "No summary documented."}</Text>
              <Text style={styles.trace}>Source: {item.source_reference?.citation || "missing source"}</Text>
              <Text style={styles.trace}>Strength: {item.strength_of_recommendation || "not documented"}</Text>
            </Card>
          ))
        )}
        {infection && <PrimaryButton label="Use in risk assessment" onPress={() => go("risk")} />}
      </View>
    );
  }

  function RiskAssessment() {
    return (
      <View>
        <BackTitle title="Risk assessment" />
        <Card>
          <PickerField
            label="Infection"
            value={input.infectionId ?? ""}
            options={data.infections.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))}
            onChange={(value) => {
              const infection = data.infections.find((item) => item.id === value) ?? null;
              setSelectedInfection(infection);
              setInput((current) => ({ ...current, infectionId: value || null }));
            }}
          />
          <Segmented label="Setting" value={input.setting} options={["ICU", "Ward", "Emergency", "Any"]} onChange={(value) => setInput((current) => ({ ...current, setting: value }))} />
          <Segmented label="Acquisition" value={input.acquisition} options={["Community-acquired", "Hospital-acquired", "Healthcare-associated", "Any"]} onChange={(value) => setInput((current) => ({ ...current, acquisition: value }))} />
          <Segmented label="Severity" value={input.severity} options={["Any", "mild", "moderate", "severe"]} onChange={(value) => setInput((current) => ({ ...current, severity: value }))} />
          <Segmented label="Age group" value={input.ageGroup} options={["adult", "pediatric", "neonate"]} onChange={(value) => setInput((current) => ({ ...current, ageGroup: value as RecommendationInput["ageGroup"] }))} />
          <Segmented label="Pregnancy" value={input.pregnancyStatus} options={["not_pregnant", "pregnant", "unknown"]} onChange={(value) => setInput((current) => ({ ...current, pregnancyStatus: value as RecommendationInput["pregnancyStatus"] }))} />
          <Field label="eGFR/CrCl, if relevant" value={input.egfr} onChangeText={(value) => setInput((current) => ({ ...current, egfr: value }))} placeholder="e.g. 45" keyboardType="numeric" />
          <Segmented label="Hepatic impairment" value={input.hepaticImpairment} options={["none", "mild", "moderate", "severe"]} onChange={(value) => setInput((current) => ({ ...current, hepaticImpairment: value }))} />
          <Field label="Allergy class/history" value={input.allergyClass} onChangeText={(value) => setInput((current) => ({ ...current, allergyClass: value }))} placeholder="e.g. penicillin anaphylaxis" />
          {data.riskFactors.length > 0 ? (
            data.riskFactors.map((risk) => (
              <Segmented
                key={risk.id}
                label={risk.label}
                value={input.riskAnswers[risk.key] ? "Yes" : "No"}
                options={["No", "Yes"]}
                onChange={(value) =>
                  setInput((current) => ({
                    ...current,
                    riskAnswers: { ...current.riskAnswers, [risk.key]: value === "Yes" },
                  }))
                }
              />
            ))
          ) : (
            <Banner tone="info">No approved risk factors are configured.</Banner>
          )}
          <PrimaryButton label="Evaluate recommendation" onPress={evaluate} />
        </Card>
        <RecommendationPanel />
      </View>
    );
  }

  function RecommendationPanel() {
    if (!recommendation) {
      return <Empty text="No recommendation evaluated yet." />;
    }

    if (recommendation.status === "insufficient") {
      return (
        <Card>
          <Text style={styles.cardTitle}>No validated recommendation</Text>
          <Banner tone="danger">{insufficientMessage}</Banner>
          {recommendation.warnings.map((warning) => (
            <Text key={warning} style={styles.body}>- {warning}</Text>
          ))}
        </Card>
      );
    }

    return (
      <Card>
        <Text style={styles.cardTitle}>Recommended first-line antibiotic</Text>
        {recommendation.firstLine.map((item) => (
          <View key={item.id} style={styles.resultRow}>
            <Text style={styles.bodyStrong}>{item.antibiotic?.name}</Text>
            <Text style={styles.body}>{item.dose_text || "Dose not documented"}</Text>
            <Text style={styles.body}>{item.route || "Route not documented"} / {item.duration_text || "Duration not documented"}</Text>
          </View>
        ))}
        {recommendation.alternatives.length > 0 && <Text style={styles.cardTitle}>Alternatives</Text>}
        {recommendation.alternatives.map((item) => (
          <Text key={item.id} style={styles.body}>{item.antibiotic?.name}: {item.conditions || "conditions not documented"}</Text>
        ))}
        {recommendation.warnings.map((warning) => (
          <Banner key={warning} tone="info">{warning}</Banner>
        ))}
        <Text style={styles.cardTitle}>Sources</Text>
        {recommendation.sources.map((source) => (
          <Text key={source.id} style={styles.trace}>{source.citation}</Text>
        ))}
      </Card>
    );
  }

  function RenalAdjustments() {
    return (
      <View>
        <BackTitle title="Renal dose adjustment" />
        {data.renalAdjustments.length === 0 ? (
          <Empty text="No approved renal adjustment records found." />
        ) : (
          data.renalAdjustments.map((item) => (
            <Card key={item.id}>
              <Text style={styles.cardTitle}>{item.antibiotic?.name || "Antibiotic not linked"}</Text>
              <Text style={styles.body}>{item.adjustment_text}</Text>
              <Text style={styles.body}>{item.monitoring_text || "No monitoring note documented."}</Text>
              <Text style={styles.trace}>Source: {item.source_reference?.citation || "missing source"}</Text>
            </Card>
          ))
        )}
      </View>
    );
  }

  function PregnancySafety() {
    return (
      <View>
        <BackTitle title="Pregnancy/lactation safety" />
        {data.pregnancySafety.length === 0 ? (
          <Empty text="No approved pregnancy/lactation records found." />
        ) : (
          data.pregnancySafety.map((item) => (
            <Card key={item.id}>
              <Text style={styles.cardTitle}>{item.antibiotic?.name || "Antibiotic not linked"}</Text>
              <Text style={styles.body}>Pregnancy: {item.pregnancy_status || "unknown"}</Text>
              <Text style={styles.body}>Lactation: {item.lactation_status || "unknown"}</Text>
              <Text style={styles.body}>{item.trimester_notes || item.lactation_notes || "No note documented."}</Text>
              <Text style={styles.trace}>Source: {item.source_reference?.citation || "missing source"}</Text>
            </Card>
          ))
        )}
      </View>
    );
  }

  function AllergyWarnings() {
    const items = [...data.contraindications, ...data.allergyCrossReactivity];
    return (
      <View>
        <BackTitle title="Allergy/contraindication warnings" />
        {items.length === 0 ? (
          <Empty text="No approved allergy or contraindication records found." />
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <Text style={styles.cardTitle}>{item.antibiotic?.name || "Antibiotic not linked"}</Text>
              <Text style={styles.bodyStrong}>{item.contraindication || item.allergy_class || "Warning"}</Text>
              <Text style={styles.body}>{item.action_text || item.risk_text || "No action documented."}</Text>
              <Text style={styles.trace}>Source: {item.source_reference?.citation || "missing source"}</Text>
            </Card>
          ))
        )}
      </View>
    );
  }

  function Admin() {
    if (!isAdminRole(profile?.role)) {
      return <Empty text="Admin/content review requires reviewer or admin role." />;
    }

    return (
      <View>
        <BackTitle title="Admin/content review" />
        <Banner tone="info">
          Draft content is not visible to doctors until reviewed and marked approved in Supabase.
        </Banner>
        <Card>
          <Text style={styles.cardTitle}>Create draft source reference</Text>
          <Field label="Reference title" value={adminTitle} onChangeText={setAdminTitle} placeholder="Institutional guideline title" />
          <Field label="Citation" value={adminCitation} onChangeText={setAdminCitation} placeholder="Citation / policy code / version" multiline />
          <PrimaryButton label="Create draft reference" onPress={createDraftReference} />
        </Card>
      </View>
    );
  }

  function Privacy() {
    return (
      <View>
        <BackTitle title="Medical disclaimer" />
        <Disclaimer />
        <Card>
          <Text style={styles.cardTitle}>Privacy and safety</Text>
          <Text style={styles.body}>
            This app should avoid unnecessary patient identifiers. Authentication is handled by Supabase Auth using the public anon key only. Admin content changes are audited by database triggers.
          </Text>
        </Card>
      </View>
    );
  }

  function EmptyIfNeeded() {
    if (data.antibiotics.length || data.infections.length || data.guidelines.length) {
      return null;
    }
    return (
      <Banner tone="info">
        No approved clinical content is available. Add source-linked content in Supabase and mark it approved after review.
      </Banner>
    );
  }

  function SearchBox() {
    return (
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search approved content..."
        placeholderTextColor="#6B7280"
        style={styles.input}
        autoCapitalize="none"
      />
    );
  }

  function BackTitle({ title }: { title: string }) {
    return (
      <View style={styles.backRow}>
        <TouchableOpacity onPress={back} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.h1}>{title}</Text>
      </View>
    );
  }
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        style={[styles.input, multiline && styles.textArea]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        multiline={multiline}
      />
    </View>
  );
}

function PickerField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmentWrap}>
        {options.length === 0 ? (
          <Text style={styles.muted}>No approved options configured.</Text>
        ) : (
          options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.segment, value === option.value && styles.segmentActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmentWrap}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.segment, value === option && styles.segmentActive]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.segmentText, value === option && styles.segmentTextActive]}>
              {option.replaceAll("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity disabled={loading} onPress={onPress} style={styles.primaryButton}>
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Banner({ children, tone }: { children: React.ReactNode; tone: "info" | "danger" }) {
  return (
    <View style={[styles.banner, tone === "danger" && styles.bannerDanger]}>
      <Text style={[styles.bannerText, tone === "danger" && styles.bannerDangerText]}>{children}</Text>
    </View>
  );
}

function Disclaimer({ compact }: { compact?: boolean }) {
  return (
    <Banner tone="danger">
      {compact
        ? "Clinical decision support only. Verify approved sources and apply clinical judgment."
        : "Medical disclaimer: This app is clinical decision support for qualified doctors. It does not replace clinical judgment, local institutional policy, microbiology data, patient-specific assessment, or ID specialist review. Recommendations must be source-linked and approved before use."}
    </Banner>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{text}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function NavCard({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.navCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, count, onOpen }: { title: string; count: number; onOpen: () => void }) {
  return (
    <TouchableOpacity onPress={onOpen}>
      <Card>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.body}>{count} approved record(s)</Text>
      </Card>
    </TouchableOpacity>
  );
}

function ListScreen({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ type: string; id: string; title: string }>;
  empty: string;
}) {
  return (
    <View>
      <Text style={styles.h1}>{title}</Text>
      {items.length === 0 ? (
        <Empty text={empty} />
      ) : (
        items.map((item) => (
          <Card key={`${item.type}-${item.id}`}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.trace}>{item.type}</Text>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EDF4F8",
  },
  authScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF4F8",
    padding: 16,
  },
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  authPanel: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderWidth: 1,
    borderColor: "#D7E3EA",
  },
  appFrame: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "#F8FBFD",
  },
  appFrameWide: {
    maxWidth: 980,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#D7E3EA",
  },
  topBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#D7E3EA",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    color: "#08324C",
  },
  brandSmall: {
    fontSize: 18,
    fontWeight: "800",
    color: "#08324C",
  },
  subtitle: {
    color: "#51606B",
    marginTop: 4,
    marginBottom: 16,
  },
  h1: {
    fontSize: 24,
    fontWeight: "800",
    color: "#08324C",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D7E3EA",
    padding: 14,
    marginBottom: 12,
  },
  navCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D7E3EA",
    padding: 14,
    marginBottom: 12,
    minHeight: 112,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F2F45",
    marginBottom: 6,
  },
  body: {
    color: "#344755",
    lineHeight: 21,
  },
  bodyStrong: {
    color: "#0F2F45",
    fontWeight: "800",
    lineHeight: 22,
  },
  muted: {
    color: "#6B7280",
  },
  trace: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E6F2FF",
    color: "#07599B",
    fontWeight: "800",
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C9D8E2",
    paddingHorizontal: 12,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#0067A8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#9CB5C7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#0F4E7A",
    fontWeight: "800",
  },
  smallButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#9CB5C7",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  smallButtonText: {
    color: "#0F4E7A",
    fontWeight: "800",
  },
  link: {
    color: "#0067A8",
    fontWeight: "800",
    marginTop: 8,
  },
  errorText: {
    color: "#B42318",
    marginTop: 8,
    lineHeight: 20,
  },
  banner: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#B7D5EA",
    backgroundColor: "#E8F5FF",
  },
  bannerText: {
    color: "#0B4A6F",
    lineHeight: 20,
  },
  bannerDanger: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F0B4B4",
  },
  bannerDangerText: {
    color: "#8A1F1F",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  metric: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D7E3EA",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0067A8",
  },
  metricLabel: {
    color: "#51606B",
    fontSize: 12,
    marginTop: 4,
  },
  grid: {
    gap: 0,
  },
  bottomTabs: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 66,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: "#D7E3EA",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  activeTab: {
    backgroundColor: "#E8F5FF",
  },
  tabText: {
    color: "#51606B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  activeTabText: {
    color: "#0067A8",
  },
  centerPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  empty: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D7E3EA",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginVertical: 8,
  },
  emptyTitle: {
    color: "#51606B",
    lineHeight: 22,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  backButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#9CB5C7",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backText: {
    color: "#0F4E7A",
    fontWeight: "800",
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  segment: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C9D8E2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  segmentActive: {
    backgroundColor: "#0067A8",
    borderColor: "#0067A8",
  },
  segmentText: {
    color: "#334155",
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  resultRow: {
    borderTopWidth: 1,
    borderColor: "#E5EEF4",
    paddingTop: 10,
    marginTop: 10,
  },
});
