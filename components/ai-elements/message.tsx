"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * AI Elements-compatible Message primitives (shaped after
 * https://elements.ai-sdk.dev).
 */

export function Message({
  className,
  from,
  ...props
}: React.ComponentProps<"div"> & { from: "user" | "assistant" | "system" }) {
  return (
    <div
      data-role={from}
      className={cn(
        "group flex w-full flex-col",
        from === "user" ? "items-end" : "items-start",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-xl text-[15px] leading-relaxed",
        "group-data-[role=user]:bg-secondary group-data-[role=user]:px-4 group-data-[role=user]:py-2.5 group-data-[role=user]:whitespace-pre-wrap",
        "group-data-[role=assistant]:w-full group-data-[role=assistant]:max-w-none",
        className,
      )}
      {...props}
    />
  );
}
