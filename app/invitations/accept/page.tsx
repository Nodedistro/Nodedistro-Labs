"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
function Accept() {
  const params = useSearchParams(),
    router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    try {
      const r = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.get("token") }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      router.push("/project/" + d.projectId);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Invitation could not be accepted.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="empty" style={{ height: "100vh" }}>
      <Logo />
      <h1>You’re invited to the workbench.</h1>
      <p>Sign in with the invited email, then accept to join the project.</p>
      <div className="row">
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button onClick={accept} disabled={busy}>
          {busy ? "Joining…" : "Accept invitation"}
        </Button>
      </div>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<div className="empty">Loading invitation…</div>}>
      <Accept />
    </Suspense>
  );
}
