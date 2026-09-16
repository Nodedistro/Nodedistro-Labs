import { aiProviderError } from "./ai/errors";
import "server-only";
import { readLimitedText } from "./limits";
import { HttpError, authenticate } from "./db/server";
import { ZodError } from "zod";
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send JSON content.");
  const raw = await readLimitedText(request.body, 2_000_000);
  if (Buffer.byteLength(raw) > 2_000_000)
    throw new HttpError(413, "Request is too large.");
  return JSON.parse(raw);
}
export function sameOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured)
    throw new HttpError(503, "Application URL is not configured.");
  if (request.headers.get("origin") !== new URL(configured).origin)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function rateLimit(scope: string, limit = 60) {
  const { db } = await authenticate();
  const { data, error } = await db.rpc("pcb_consume_rate_limit", {
    p_scope: scope,
    p_limit: limit,
  });
  if (error)
    throw new HttpError(503, "Request limits are temporarily unavailable.");
  if (!data)
    throw new HttpError(
      429,
      "Too many requests. Please try again in a minute.",
    );
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError)
    return Response.json(
      { error: "Invalid request. Check the fields and try again." },
      { status: 400 },
    );
  const providerError = aiProviderError(error);
  if (providerError)
    return Response.json(
      { error: providerError.message },
      { status: providerError.status },
    );
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
