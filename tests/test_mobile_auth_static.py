from pathlib import Path


APP_ROOT = Path("mobile/src/AppRoot.tsx")


def app_source() -> str:
    return APP_ROOT.read_text()


def test_mobile_auth_uses_email_otp_only():
    source = app_source()

    assert "supabase.auth.signUp" not in source
    assert "password" not in source.lower()
    assert "supabase.auth.signInWithOtp" in source
    assert "options: { shouldCreateUser: true }" in source
    assert 'type: "email"' in source
    assert "supabase.auth.verifyOtp" in source


def test_mobile_otp_request_is_button_driven_and_rate_limited():
    source = app_source()

    assert "const otpResendSeconds = 60;" in source
    assert 'label="Sign up with Email OTP"' in source
    assert 'label="Login with Email OTP"' in source
    assert "disabled={otpTimer > 0}" in source
    assert "onChangeText={updateSignupEmail}" in source
    assert "onChangeText={updateLoginEmail}" in source
    assert "void sendOtp" not in source.split("onChangeText={updateSignupEmail}")[1].split(
        "placeholder="
    )[0]
    assert "void sendOtp" not in source.split("onChangeText={updateLoginEmail}")[1].split(
        "placeholder="
    )[0]


def test_mobile_otp_user_messages_do_not_fake_success_on_errors():
    source = app_source()

    assert (
        'const otpSentMessage = "OTP sent. Please check your email inbox and spam folder.";'
        in source
    )
    assert (
        '"Too many OTP requests. Please wait a few minutes before trying again.";'
        in source
    )
    assert '"OTP could not be sent. Please contact administrator.";' in source
    assert "OTP request received. Please check your email inbox or try again later." not in source
    assert "setAuthSuccess(message)" not in source


def test_mobile_otp_screen_accepts_six_numeric_digits():
    source = app_source()

    assert "const otpLength = 6;" in source
    assert 'setLoginError("Enter the 6 digit OTP.");' in source
    assert 'inputMode="numeric"' in source
    assert 'keyboardType="number-pad"' in source
