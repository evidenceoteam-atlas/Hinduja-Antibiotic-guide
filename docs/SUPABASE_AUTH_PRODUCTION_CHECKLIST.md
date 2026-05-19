# Supabase Auth Production Checklist

Use this checklist when Email OTP works on one device but not another.

## Supabase URL Configuration

1. Open **Supabase Dashboard -> Authentication -> URL Configuration**.
2. Set **Site URL** to the production Vercel URL.
3. Add redirect URLs for:
   - Production Vercel URL
   - Local Expo web URL, for example `http://localhost:8081`
   - Any preview URL used for testing
4. The production app must use this Supabase project:
   `https://ebnmtviysnhljrymfngc.supabase.co`

## Email Templates

1. Open **Authentication -> Email Templates -> Magic Link**.
2. Include `{{ .Token }}` in the template body.
3. Do not rely only on `{{ .ConfirmationURL }}` for this app.
4. Recommended subject: `Hinduja Antibiotic Guide OTP`
5. Recommended body:

```html
<h2>Hinduja Antibiotic Guide</h2>
<p>Your sign-in code is:</p>
<h1>{{ .Token }}</h1>
<p>This code expires shortly. Do not share it.</p>
```

## Confirm Signup

The app must not trigger Confirm Signup. It calls `signInWithOtp` for Sign up
and Login, and verifies with `verifyOtp({ type: "email" })`.

If users receive “Confirm your email address” link emails:

1. Confirm the deployed build does not call `signUp`.
2. Avoid password signup for this doctor-facing app.
3. Keep Confirm Signup/link workflows separate from the mobile app.

## OTP Length

Set Email OTP length to `6`. The app accepts exactly six numeric digits.

## SMTP

Configure custom SMTP for production in **Project Settings -> Auth -> SMTP
Settings**. Use a provider such as Resend, SendGrid, or AWS SES.

Verify:

- Sender domain is verified.
- SPF is configured.
- DKIM is configured.
- DMARC is configured.
- Provider logs show delivery attempts for affected users.

## Rate Limits

1. Check Supabase Auth logs for `429` or rate-limit errors.
2. Keep the app cooldown at 60 seconds.
3. Ask users to avoid repeated refresh/click attempts during an active cooldown.

## Vercel Environment

Production Vercel environment variables must include:

- `EXPO_PUBLIC_SUPABASE_URL=https://ebnmtviysnhljrymfngc.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Optional: `EXPO_PUBLIC_APP_BUILD_ID` or `EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA`

After changing any environment variable, redeploy production.

## Browser and Device Testing

1. Test in incognito/private mode.
2. Test another device and another network.
3. Open the app with `?debugAuth=true`.
4. Use **Auth Health Check** to send a test OTP.
5. Confirm the diagnostics show:
   - Correct Supabase hostname
   - Correct build ID
   - Button click fired
   - `signInWithOtp` called
   - Supabase success or sanitized Supabase error
   - Service worker/cache status

The app sets `Cache-Control: no-store` for `/` and `/index.html` in
`mobile/vercel.json` so browsers do not keep serving stale auth JavaScript.
