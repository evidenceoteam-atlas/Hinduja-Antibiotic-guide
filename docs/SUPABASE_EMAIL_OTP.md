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

Users must receive a numeric six digit code. In Supabase Dashboard:

1. Open **Authentication -> Email Templates**.
2. Open the **Magic Link** template. Supabase uses this template for `signInWithOtp`.
3. Include `{{ .Token }}` in the email body.
4. Do not rely only on `{{ .ConfirmationURL }}` for this app.

Recommended template:

```html
<h2>Hinduja Antibiotic Guide</h2>
<p>Your sign-in code is:</p>
<h1>{{ .Token }}</h1>
<p>This code expires shortly. Do not share it.</p>
```

Do not use only `{{ .ConfirmationURL }}` for the app OTP flow. A template that only contains a confirmation link will send users a “Confirm your email address” link-style email instead of the numeric code needed by the app.

## Confirm Signup Template

The app does not use the password signup or Confirm Signup/link flow. Doctor access in the mobile app must use the Email OTP/Magic Link template with `{{ .Token }}`.

If users receive a “Confirm your email address” link email, check these settings:

1. Confirm the deployed app is running code that calls `supabase.auth.signInWithOtp`, not `supabase.auth.signUp`.
2. In **Authentication -> Providers -> Email**, avoid password-based signup for this doctor app. If the project is dedicated to this app, disable the email confirmation signup flow and use only OTP sign-in.
3. If Confirm Signup must remain enabled for unrelated admin workflows, make sure those workflows are separate from the mobile app and do not call them from mobile.
4. Keep the Confirm Signup template link-based only for those separate workflows; it should never be the template relied on by this app.

## Production SMTP and Rate Limits

Do not rely on default Supabase email delivery for production clinical use. Configure a custom SMTP provider such as Resend, SendGrid, or AWS SES in **Project Settings -> Auth -> SMTP Settings**. Default Supabase email limits can delay or block OTP delivery during real use.

The app enforces a 60 second resend cooldown and shows friendly user messages:

- Success: “OTP sent. Please check your email inbox and spam folder.”
- Rate limit: “Too many OTP requests. Please wait a few minutes before trying again.”
- Delivery/template failure: “OTP could not be sent. Please contact administrator.”

In development builds, failed OTP requests log only safe diagnostics: the Supabase error code/message, request method, timestamp, and email domain. Full email addresses are not logged.

## Acceptance Checklist

- Clicking Sign up with Email OTP calls `signInWithOtp`, not `signUp`.
- Clicking Login with Email OTP calls the same `signInWithOtp` helper.
- No password signup path exists in the app.
- OTP verification accepts exactly six numeric digits.
- The app does not show a success message when Supabase returns an OTP request error.
- Magic Link template contains `{{ .Token }}`.
