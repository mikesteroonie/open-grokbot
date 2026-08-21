"use client";

import * as React from "react";
import { useState } from "react";
import type { ToolUIPart } from "ai";
import {
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AI Elements-compatible Tool primitives (shaped after
 * https://elements.ai-sdk.dev). Renders one tool invocation with a
 * collapsible input/output view.
 */

const LABELS: Record<string, string> = {
  send_email: "Sending email",
  reply_to_email: "Replying",
  list_threads: "Reading inbox",
  get_thread: "Reading thread",
  web_search: "Searching the web",
  notify_principal: "Emailing principal",
};

function StatusIcon({ state }: { state: ToolUIPart["state"] | string }) {
  if (state === "input-streaming" || state === "input-available") {
    return <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />;
  }
  if (state === "output-error") {
    return <XIcon className="size-3.5 text-destructive" />;
  }
  return <CheckIcon className="size-3.5 text-muted-foreground" />;
}

export function Tool({
  className,
  type,
  state,
  input,
  output,
  errorText,
}: {
  className?: string;
  type: string;
  state: ToolUIPart["state"] | string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = type.replace(/^tool-/, "");
  const label = LABELS[name] ?? name.replace(/_/g, " ");
  const working = state === "input-streaming" || state === "input-available";
  const hasDetail = input !== undefined || output !== undefined || errorText;

  return (
    <div className={cn("my-1.5 overflow-hidden rounded-lg border bg-card/60", className)}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground",
          hasDetail && "hover:bg-accent/40",
        )}
      >
        <StatusIcon state={state} />
        <span className="flex-1">
          {label}
          {working && "…"}
        </span>
        {hasDetail && (
          <ChevronDownIcon
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
          />
        )}
      </button>
      {open && hasDetail && (
        <div className="space-y-2 border-t px-3 py-2">
          {input !== undefined && (
            <ToolIO label="input" value={input} />
          )}
          {output !== undefined && <ToolIO label="output" value={output} />}
          {errorText && (
            <div className="text-xs text-destructive">{errorText}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolIO({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
