import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function serverDb() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new HttpError(
      503,
      "Cloud services are not configured. Demo projects are available locally.",
    );
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, {
                ...options,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
              }),
            );
          } catch {
            /* Proxy refreshes cookies for server component reads. */
          }
        },
      },
    },
  );
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authenticate() {
  const db = await serverDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (
    error &&
    (error.name === "AuthRetryableFetchError" ||
      error.name === "AuthUnknownError" ||
      (error.status ?? 0) >= 500 ||
      error.status === 429)
  ) {
    throw new HttpError(
      503,
      "The server cannot verify your session right now. Check its connection to Supabase and try again. You do not need to create another account.",
    );
  }
  if (error || !user)
    throw new HttpError(
      401,
      "Your session is missing or expired. Sign in to continue.",
    );
  return { db, user };
}
export async function authorizeProject(id: string, write = false) {
  const { db, user } = await authenticate();
  const { data: p, error } = await db
    .from("pcb_projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !p)
    throw new HttpError(404, "Project not found or access denied.");
  let role = "viewer";
  if (p.owner_id === user.id) role = "owner";
  else {
    const { data: m } = await db
      .from("pcb_project_members")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    role = m?.role ?? "viewer";
  }
  if (write && !["owner", "editor"].includes(role))
    throw new HttpError(403, "This project is read-only for your account.");
  return { db, user, project: p, role };
}
