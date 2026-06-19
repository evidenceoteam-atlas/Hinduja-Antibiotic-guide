from pathlib import Path

APP_ROOT = Path("mobile/src/AppRoot.tsx")
SUPABASE_CLIENT = Path("mobile/src/supabase.ts")
PACKAGE = Path("mobile/package.json")
APP_CONFIG = Path("mobile/app.json")
PUBLIC_READ_MIGRATION = Path(
    "supabase/migrations/20260619_zz_public_approved_clinical_read.sql"
)


def test_mobile_has_no_google_or_oauth_flow():
    source = APP_ROOT.read_text()
    supabase = SUPABASE_CLIENT.read_text()

    forbidden = (
        "Google",
        "google",
        "OAuth",
        "oauth",
        "signInWithOAuth",
        "exchangeCodeForSession",
        "onAuthStateChange",
        "getSession",
        "setSession",
        "signOut",
    )

    for value in forbidden:
        assert value not in source
        assert value not in supabase


def test_mobile_opens_without_authentication_gate():
    source = APP_ROOT.read_text()

    assert '| "login"' not in source
    assert 'useState<Screen[]>(["doctorDetails"])' in source
    assert "hasCompleteDoctorProfile" in source
    assert "AsyncStorage.getItem(DOCTOR_PROFILE_STORAGE_KEY)" in source
    assert "AsyncStorage.setItem(" in source


def test_doctor_profile_is_local_and_not_authorization():
    source = APP_ROOT.read_text()

    assert "Stored on this device for report personalization" in source
    assert "It does not authenticate or authorize access" in source
    assert "supabase.auth" not in source


def test_oauth_dependencies_and_callback_config_are_removed():
    package = PACKAGE.read_text()
    app_config = APP_CONFIG.read_text()

    assert "expo-linking" not in package
    assert "expo-web-browser" not in package
    assert "expo-secure-store" not in package
    assert '"scheme"' not in app_config
    assert "auth/callback" not in app_config


def test_supabase_public_config_remains_data_only():
    source = SUPABASE_CLIENT.read_text()

    assert "EXPO_PUBLIC_SUPABASE_URL" in source
    assert "EXPO_PUBLIC_SUPABASE_ANON_KEY" in source
    assert "fetch(url" in source
    assert "method: \"GET\"" in source
    assert "createClient" not in source
    assert "flowType" not in source
    assert "persistSession" not in source
    assert "@supabase/supabase-js" not in PACKAGE.read_text()


def test_public_data_client_is_read_only_and_has_no_session_header():
    source = SUPABASE_CLIENT.read_text()

    assert 'method: "GET"' in source
    assert 'operator: "eq" | "ilike" | "in"' in source
    assert "safeIdentifier" in source
    assert "Authorization" not in source
    assert 'method: "POST"' not in source
    assert 'method: "PATCH"' not in source
    assert 'method: "DELETE"' not in source


def test_backend_public_access_is_read_only_and_approval_gated():
    migration = PUBLIC_READ_MIGRATION.read_text()

    assert PUBLIC_READ_MIGRATION.name > "20260619_versioned_csv_release_flow.sql"
    assert "to anon, authenticated" in migration
    assert "review_status = 'approved'" in migration
    assert "release.status = 'active'" in migration
    assert "release.valid_through >= current_date" in migration
    assert "grant select on" in migration
    assert "grant insert" not in migration
    assert "grant update" not in migration
    assert "grant delete" not in migration


def test_backend_has_no_google_oauth_integration():
    roots = (Path("services"), Path("shared"), Path("supabase"))
    source = "\n".join(
        path.read_text(errors="ignore")
        for root in roots
        for path in root.rglob("*")
        if path.is_file()
    ).lower()

    assert "sign_in_with_google" not in source
    assert "provider: google" not in source
    assert "accounts.google.com" not in source
    assert "oauth/callback" not in source
