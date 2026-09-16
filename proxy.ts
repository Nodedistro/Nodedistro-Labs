import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (
    configured &&
    request.method === "GET" &&
    !request.nextUrl.pathname.startsWith("/auth/") &&
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    const canonical = new URL(configured);
    const incoming = new URL(
      request.nextUrl.protocol +
        "//" +
        (request.headers.get("host") ?? request.nextUrl.host),
    );
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (
      loopback.has(incoming.hostname) &&
      loopback.has(canonical.hostname) &&
      incoming.origin !== canonical.origin
    ) {
      const target = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        canonical.origin,
      );
      return NextResponse.redirect(target, 307);
    }
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return NextResponse.next();
  let response = NextResponse.next({ request });
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            }),
          );
        },
      },
    },
  );
  const { data } = await db.auth.getClaims();
  const path = request.nextUrl.pathname;
  const protectedPath =
    (path.startsWith("/project/") && !path.startsWith("/project/demo-")) ||
    path.startsWith("/settings") ||
    path.startsWith("/billing");
  if (protectedPath && !data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
