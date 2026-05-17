# Supabase Email OTP Setup

The mobile app uses Supabase Email OTP only. It does not call `signUp`, does not use password signup, and does not intentionally start the Confirm Signup link flow.

## App Auth Flow

Both Sign up and Login request an email code with:

```ts
supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true },
});
```

The OTP screen verifies the manually entered six digit code with:

```ts
supabase.auth.verifyOtp({
  email,
  token,
  type: "email",
});
```

If a doctor entered a name on the Sign up screen, the app saves that name as user metadata only after OTP verification succeeds.

## Required Supabase Email Template

In Supabase Dashboard, configure the Email OTP/Magic Link template to include the numeric token:

```html
<p>Your Hinduja Antibiotic Guide verification code is:</p>
<h2>{{ .Token }}</h2>
<p>This code expires shortly. Do not share it.</p>
```

Do not use only `{{ .ConfirmationURL }}` for the app OTP flow. A template that only contains a confirmation link will send users a “Confirm your email address” link-style email instead of the numeric code needed by the app.

## Confirm Signup Template

The app does not use the password signup or Confirm Signup/link flow. Keep any Confirm Signup template for unrelated admin workflows only; doctor access in the mobile app must use the Email OTP template with `{{ .Token }}`.
