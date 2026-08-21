"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AI Elements-compatible Conversation primitives.
 *
 * Drop-in shaped after https://elements.ai-sdk.dev — the official versions
 * can overlay these via `npx ai-elements@latest add conversation` without
 * touching call sites.
 */

const ConversationContext = React.createContext<{
  isAtBottom: boolean;
  scrollToBottom: () => void;
}>({ isAtBottom: true, scrollToBottom: () => {} });

export function Conversation({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const pinnedRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    pinnedRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      pinnedRef.current = atBottom;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    // Follow streamed content while the user is pinned to the bottom.
    const observer = new MutationObserver(() => {
      if (pinnedRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <ConversationContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div className={cn("relative min-h-0 flex-1", className)} {...props}>
        <div ref={viewportRef} className="h-full overflow-y-auto">
          {children}
        </div>
      </div>
    </ConversationContext.Provider>
  );
}

export function ConversationContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6", className)}
      {...props}
    />
  );
}

export function ConversationEmptyState({
  className,
  title,
  description,
  children,
  ...props
}: React.ComponentProps<"div"> & { title?: string; description?: string }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center",
        className,
      )}
      {...props}
    >
      {title && <div className="text-sm font-medium">{title}</div>}
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

export function ConversationScrollButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { isAtBottom, scrollToBottom } = React.useContext(ConversationContext);
  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={scrollToBottom}
      aria-label="Scroll to bottom"
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md",
        className,
      )}
      {...props}
    >
      <ArrowDownIcon />
    </Button>
  );
}
