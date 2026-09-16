import { serverDb } from "@/lib/db/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const safeNext =
    url.searchParams.get("next") === "/reset-password" || type === "recovery"
      ? "/reset-password"
      : "/dashboard";
  try {
    const db = await serverDb();
    if (
      tokenHash &&
      (type === "email" || type === "signup" || type === "recovery")
    ) {
      const { error } = await db.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (!error) return redirect(safeNext, url.origin);
    } else if (code) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return redirect(safeNext, url.origin);
    }
  } catch {
    /* Never echo authentication codes or tokens into logs or redirects. */
  }
  return redirect("/login?error=verification", url.origin);
}
function redirect(path: string, origin: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
