export function aiProviderError(
  error: unknown,
): { status: number; message: string } | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { status?: number; code?: string; name?: string };
  if (e.code === "credit_balance_exhausted" || e.code === "insufficient_quota")
    return {
      status: 503,
      message:
        "OpenAI API credits or quota are exhausted. Check API billing at https://platform.openai.com/settings/organization/billing and your project spending limits. ChatGPT subscriptions do not include API credits.",
    };
  if (e.status === 429)
    return {
      status: 429,
      message: "OpenAI is rate limiting requests. Wait a moment and try again.",
    };
  if (e.status === 401)
    return {
      status: 503,
      message:
        "OpenAI rejected the server API key. Check OPENAI_API_KEY in your server environment.",
    };
  if (e.status === 403 || e.code === "model_not_found")
    return {
      status: 503,
      message:
        "The OpenAI key does not have access to the configured model or project. Check OPENAI_MODEL and your API project permissions.",
    };
  if (e.name === "APIConnectionError" || e.name === "APIConnectionTimeoutError")
    return {
      status: 503,
      message:
        "The server could not reach OpenAI. Check its network connection and try again.",
    };
  return null;
}
