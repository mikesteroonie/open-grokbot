"use client";

import { memo } from "react";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

/**
 * AI Elements-compatible Response: renders streamed assistant markdown.
 */
export const Response = memo(function Response({
  className,
  children,
}: {
  className?: string;
  children: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Markdown>{children}</Markdown>
    </div>
  );
});
