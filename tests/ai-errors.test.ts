import { test } from "node:test";
import assert from "node:assert/strict";
import { aiProviderError } from "../lib/ai/errors";
test("OpenAI credit exhaustion is distinct from transient rate limiting", () => {
  assert.match(
    aiProviderError({ status: 429, code: "credit_balance_exhausted" })!.message,
    /credits or quota/,
  );
  assert.equal(
    aiProviderError({ status: 429, code: "rate_limit_exceeded" })!.status,
    429,
  );
  assert.doesNotMatch(
    aiProviderError({ status: 429, code: "rate_limit_exceeded" })!.message,
    /billing/,
  );
});
test("Provider diagnostics never echo raw errors or credentials", () => {
  assert.doesNotMatch(
    aiProviderError({ status: 401, message: "secret-value" })!.message,
    /secret-value/,
  );
  assert.equal(aiProviderError(new Error("unrelated")), null);
});
