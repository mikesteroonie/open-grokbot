import { NextResponse } from "next/server";
import { AgentMailError } from "agentmail";
import type { ApiErrorDto } from "./types";

/**
 * Normalize anything thrown in a route handler into a structured, human
 * readable error payload. AgentMail SDK errors carry a rich body
 * ({ message, fix, suggestions, docs, code }) — surface that instead of the
 * raw "Status code: 403 Body: {...}" dump the SDK puts in `.message`.
 */
export function toApiError(error: unknown, fallbackStatus = 500): {
  status: number;
  body: ApiErrorDto;
} {
  if (error instanceof AgentMailError) {
    const b = (error.body ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    const suggestions = Array.isArray(b.suggestions)
      ? b.suggestions.filter((s): s is string => typeof s === "string")
      : undefined;
    return {
      status: error.statusCode ?? fallbackStatus,
      body: {
        error: str(b.message) ?? humanize(error.message),
        code: str(b.code) ?? str(b.name),
        fix: str(b.fix),
        suggestions: suggestions?.length ? suggestions : undefined,
        docs: str(b.docs),
      },
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { status: fallbackStatus, body: { error: message } };
}

export function apiErrorResponse(error: unknown, fallbackStatus = 500) {
  const { status, body } = toApiError(error, fallbackStatus);
  return NextResponse.json(body, { status });
}

/** Strip the SDK's "Status code: NNN\nBody: {...}" framing if that's all we have. */
function humanize(message: string): string {
  const firstLine = message.split("\n")[0]?.trim();
  if (!firstLine || /^status code:/i.test(firstLine)) return "Request to AgentMail failed";
  return firstLine;
}
