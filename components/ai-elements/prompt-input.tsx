"use client";

import * as React from "react";
import type { ChatStatus } from "ai";
import { ArrowUpIcon, LoaderCircleIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AI Elements-compatible PromptInput primitives (shaped after
 * https://elements.ai-sdk.dev).
 */

export function PromptInput({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form
      className={cn(
        "flex items-end gap-2 rounded-xl border bg-card p-2 shadow-sm transition-colors focus-within:border-ring/40",
        className,
      )}
      {...props}
    />
  );
}

export function PromptInputTextarea({
  className,
  onChange,
  placeholder = "Say something...",
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      name="message"
      placeholder={placeholder}
      rows={1}
      onChange={onChange}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      className={cn(
        "field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function PromptInputSubmit({
  className,
  status,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { status?: ChatStatus }) {
  const streaming = status === "streaming";
  const submitted = status === "submitted";
  return (
    <Button
      type="submit"
      size="icon"
      aria-label="Send"
      disabled={disabled || submitted}
      className={cn("size-9 shrink-0 rounded-lg", className)}
      {...props}
    >
      {submitted ? (
        <LoaderCircleIcon className="animate-spin" />
      ) : streaming ? (
        <SquareIcon />
      ) : (
        <ArrowUpIcon />
      )}
    </Button>
  );
}
