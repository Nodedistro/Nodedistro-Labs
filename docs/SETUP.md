# Cloud setup and verification recovery

## Current local address

Use http://localhost:3000 consistently. The application redirects other loopback hostnames to NEXT_PUBLIC_APP_URL. Cookies set for localhost are separate from cookies set for 127.0.0.1. Start a fresh sign-in flow after changing the hostname.

## Database

The configured Supabase endpoint returned PGRST205: public.pcb_projects is missing. In **that project's** SQL Editor, execute `supabase/schema.sql`, then `supabase/services.sql`. These are bootstrap scripts for a new installation, not scripts to rerun against an existing installation. The schema enables RLS and restricts cloud projects to their members unless the owner explicitly publishes them.

The configured project is not among the projects accessible through the connected Supabase integration. Do not substitute another project's URL or apply the schema to an unrelated database.

## Auth URL configuration

In Supabase Authentication > URL Configuration:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/callback?next=/reset-password`
- Set NEXT_PUBLIC_APP_URL to the same origin. Restart Next.js after changing environment variables.

The default PKCE email flow requires opening the link in the same browser used to sign up. An in-app browser and your regular browser have separate cookies. If the email is already confirmed, try signing in with your password. Otherwise enter your email on the login screen and choose **Resend verification email**.

For verification links that work across browsers, configure Supabase's **Confirm signup** email template link as:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email</a>
```

Configure the **Reset password** template link as:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

The app supports both token-hash verification and the default PKCE callback. Expired or previously consumed tokens cannot be reused. Never share a verification URL: it contains a login credential.

## OpenAI

Put your own key in the server environment as OPENAI_API_KEY. Never prefix it with NEXT_PUBLIC_ or enter it in source code. Choose OPENAI_MODEL according to your account's available models. AI cloud features also need Supabase configured and a signed-in user; the local demo does not send AI requests.

## Console messages

- React DevTools and Fast Refresh/HMR messages are development information.
- `content.js` / `No Listener: tabs:outgoing.message.ready` is likely injected browser-extension code; it is not a Nodedistro Labs source file.
- A private API's 401 means no valid session. The dashboard now checks for a session before requesting private projects; the API continues to enforce authentication.
- Explore's 503 means the database setup or service is unavailable. The UI now shows its explanation and keeps the curated local example accessible.

References: https://supabase.com/docs/guides/auth/sessions/pkce-flow and https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
