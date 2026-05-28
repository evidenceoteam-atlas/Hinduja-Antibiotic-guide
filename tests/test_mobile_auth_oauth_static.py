from pathlib import Path

APP_ROOT = Path("mobile/src/AppRoot.tsx")


def app_source() -> str:
    return APP_ROOT.read_text()


def test_mobile_auth_uses_google_oauth():
    source = app_source()

    assert "supabase.auth.signInWithOAuth" in source
    assert 'provider: "google"' in source
    assert "supabase.auth.signUp" not in source
    assert "supabase.auth.signInWithOtp" not in source


def test_mobile_oauth_has_web_redirect_to():
    source = app_source()

    assert (
        'typeof window !== "undefined" ? window.location.origin : undefined'
        in source
    )
    assert "redirectTo," in source


def test_mobile_oauth_button_is_labelled():
    source = app_source()

    assert 'accessibilityLabel="Continue with Google"' in source
    assert "Continue with Google" in source


def test_mobile_oauth_surfaces_misconfiguration():
    source = app_source()

    assert "EXPO_PUBLIC_SUPABASE_URL" in source
    assert "EXPO_PUBLIC_SUPABASE_ANON_KEY" in source
    assert "Supabase is not configured" in source


def test_mobile_oauth_does_not_fake_success_on_errors():
    source = app_source()

    assert (
        "Google login failed. Please try again or contact administrator."
        in source
    )
