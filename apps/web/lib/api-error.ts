import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Standardised API error responses
// { error: string, code: string } — consumed by clients for programmatic handling
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Wrap an unhandled exception into a clean 500 response.
 * Logs the original error server-side without leaking internals to the client.
 */
export function internalError(err: unknown, context?: string): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[api-error]${context ? ` ${context}` : ""}`, msg, err);
  return NextResponse.json(
    { error: "something went wrong. please try again.", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
