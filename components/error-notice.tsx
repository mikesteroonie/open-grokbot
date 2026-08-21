"use client";

import { AlertCircleIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiErrorDto } from "@/lib/types";

/**
 * Turn a failed fetch Response (or thrown value) into an ApiErrorDto.
 * Falls back to a plain message when the body isn't structured JSON.
 */
export async function readApiError(
  res: Response,
  fallback: string,
): Promise<ApiErrorDto> {
  try {
    const data = (await res.json()) as Partial<ApiErrorDto>;
    if (data && typeof data.error === "string") return data as ApiErrorDto;
  } catch {
    // non-JSON body
  }
  return { error: `${fallback} (${res.status})` };
}

export function toApiErrorDto(err: unknown, fallback = "Something went wrong"): ApiErrorDto {
  if (err && typeof err === "object" && "error" in err && typeof (err as ApiErrorDto).error === "string") {
    return err as ApiErrorDto;
  }
  if (err instanceof Error) return { error: err.message || fallback };
  return { error: fallback };
}

/** Compact, readable error card: message, optional fix, suggestions, docs. */
export function ErrorNotice({
  error,
  onSuggestion,
  className,
}: {
  error: ApiErrorDto;
  /** When provided, suggestions render as clickable chips. */
  onSuggestion?: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-medium text-destructive">{error.error}</p>
          {error.fix && (
            <p className="text-[13px] leading-snug text-muted-foreground">
              {stripSuggestionList(error.fix, error.suggestions)}
            </p>
          )}
          {error.suggestions && error.suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-xs text-muted-foreground">Try:</span>
              {error.suggestions.map((s) =>
                onSuggestion ? (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSuggestion(s)}
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-xs transition-colors hover:bg-accent"
                  >
                    {s}
                  </button>
                ) : (
                  <span
                    key={s}
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    {s}
                  </span>
                ),
              )}
            </div>
          )}
          {error.docs && (
            <a
              href={error.docs}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Learn more <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AgentMail's `fix` text often ends with the same list we render as chips
 * ("… these usernames are currently available: a, b, c."). Trim that tail
 * so it isn't shown twice.
 */
function stripSuggestionList(fix: string, suggestions?: string[]): string {
  if (!suggestions?.length) return fix;
  const idx = fix.search(/\s*[—–-]?\s*these [a-z ]+ are currently available:/i);
  if (idx > 0) return fix.slice(0, idx).replace(/[.\s]+$/, "") + ".";
  return fix;
}
