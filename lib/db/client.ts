"use client";
import { createBrowserClient } from "@supabase/ssr";
export const cloudConfigured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
export function browserDb() {
  if (!cloudConfigured()) throw Error("Cloud services are not configured.");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
