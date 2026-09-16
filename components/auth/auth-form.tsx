"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { browserDb, cloudConfigured } from "@/lib/db/client";
import { BoardPreview } from "@/components/pcb/board-preview";
import { demoDocument } from "@/lib/editor/demo";
export function AuthForm({
  mode,
}: {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
}) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("error") ===
      "verification"
    ) {
      setError(
        "The verification link could not sign you in. It may have expired, already been used, or opened in a different browser. Try signing in if your email is already confirmed, or request a fresh link below. Use the same browser and address for signup and verification.",
      );
    }
  }, []);
  async function resend() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    if (!cloudConfigured()) {
      setError("Authentication is not configured.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await browserDb().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) throw error;
      setMessage(
        "If your account needs confirmation, a fresh verification link has been sent. Open it in this browser.",
      );
    } catch {
      setError(
        "Unable to resend verification. Please wait a moment and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    login: "Welcome back.",
    signup: "Your next idea starts here.",
    "forgot-password": "Reset your password.",
    "reset-password": "Choose a new password.",
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!cloudConfigured()) {
      setError(
        "Authentication is not configured. Connect Supabase to create an account, or explore the local demo.",
      );
      return;
    }
    setBusy(true);
    try {
      const db = browserDb();
      if (mode === "login") {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else if (mode === "signup") {
        const { error } = await db.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (error) throw error;
        setMessage(
          "Check your email to verify your account before signing in.",
        );
      } else if (mode === "forgot-password") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo:
            window.location.origin + "/auth/callback?next=/reset-password",
        });
        if (error) throw error;
        setMessage("If an account exists, a reset link has been sent.");
      } else {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Your password has been updated.");
        router.push("/dashboard");
      }
    } catch (failure) {
      const code =
        typeof failure === "object" && failure && "code" in failure
          ? String(failure.code)
          : "";
      const messages: Record<string, string> = {
        email_not_confirmed:
          "Confirm your email before signing in. You can request a fresh verification email below.",
        invalid_credentials:
          "The email or password is incorrect. Try again or choose Forgot password.",
        over_request_rate_limit:
          "Too many attempts. Please wait a moment before trying again.",
        over_email_send_rate_limit:
          "The email sending limit was reached. Please wait before requesting another email.",
        signup_disabled:
          "Account registration is disabled in Supabase. Enable email signups in your project's authentication settings.",
      };
      setError(
        messages[code] ??
          "Could not complete this request. Check your details and connection, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <Logo />
        <div>
          <div className="eyebrow" style={{ marginBottom: 20 }}>
            THE WORKSPACE FOR YOUR NEXT WHAT IF.
          </div>
          <h1>
            Small components.
            <br />
            <span className="accent">
              Extraordinary
              <br />
              possibilities.
            </span>
          </h1>
          <div style={{ height: 300, maxWidth: 490, marginTop: 25 }}>
            <BoardPreview document={demoDocument()} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Build with curiosity. Design with confidence.
        </p>
      </aside>
      <main className="auth-form">
        <div className="auth-card">
          <div className="login-mobile-brand">
            <Logo />
          </div>
          <h1>{titles[mode]}</h1>
          <p className="muted">
            {mode === "login"
              ? "Sign in to your engineering workspace."
              : mode === "signup"
                ? "A workspace for every connection you’ll make."
                : "We’ll help you get back to your workspace."}
          </p>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label className="field">
                <span>Your name</span>
                <Input
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                />
              </label>
            )}
            {mode !== "reset-password" && (
              <label className="field">
                <span>Email address</span>
                <Input
                  autoComplete="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
            )}
            {mode !== "forgot-password" && (
              <label className="field">
                <span>Password</span>
                <Input
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <Button disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot-password"
                    ? "Send reset link"
                    : "Update password"}
            </Button>
          </form>
          {mode === "login" && (
            <Button variant="ghost" disabled={busy} onClick={resend}>
              Resend verification email
            </Button>
          )}
          <div className="auth-links">
            <Link href={mode === "signup" ? "/login" : "/signup"}>
              {mode === "signup"
                ? "Already have an account?"
                : "Create an account"}
            </Link>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <hr />
          <Button asChild variant="outline">
            <Link href="/project/demo-sensor">
              Explore the local demo <ArrowRight />
            </Link>
          </Button>
          <p
            className="required-note"
            style={{ marginTop: 15, textAlign: "center" }}
          >
            No account required for the local demo.
          </p>
        </div>
      </main>
    </div>
  );
}
