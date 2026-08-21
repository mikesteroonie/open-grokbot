"use client";

import { useEffect, useState } from "react";
import { ChevronRightIcon, InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ApiErrorDto, BotDto, ThreadMessageDto, ThreadSummaryDto } from "@/lib/types";
import { ErrorNotice, readApiError, toApiErrorDto } from "@/components/error-notice";

function formatTime(iso?: string): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

function ThreadMessages({ botId, threadId }: { botId: string; threadId: string }) {
  const [messages, setMessages] = useState<ThreadMessageDto[] | null>(null);
  const [error, setError] = useState<ApiErrorDto | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/threads/${encodeURIComponent(threadId)}?botId=${encodeURIComponent(botId)}`)
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r, "Failed to load thread");
        const data = await r.json();
        if (mounted) setMessages(data.thread?.messages ?? []);
      })
      .catch((err) => {
        if (mounted) setError(toApiErrorDto(err, "Failed to load thread"));
      });
    return () => {
      mounted = false;
    };
  }, [botId, threadId]);

  if (error) return <ErrorNotice error={error} className="mx-3 my-2" />;
  if (!messages)
    return (
      <div className="space-y-2 px-3 py-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );

  return (
    <div className="space-y-2 px-3 pb-3">
      {messages.map((m) => (
        <article key={m.messageId} className="rounded-lg border bg-card px-3 py-2">
          <header className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-medium">{m.from}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatTime(m.timestamp)}
            </span>
          </header>
          <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {m.text || "(no content)"}
          </div>
        </article>
      ))}
    </div>
  );
}

export function InboxSheet({ bot }: { bot: BotDto }) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiErrorDto | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Reset here (event handler) rather than in the fetch effect so the
      // previous open's data never flashes.
      setThreads(null);
      setError(null);
      setExpanded(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    fetch(`/api/threads?botId=${encodeURIComponent(bot.id)}`)
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r, "Failed to load inbox");
        const data = await r.json();
        if (mounted) setThreads(data.threads ?? []);
      })
      .catch((err) => {
        if (mounted) setError(toApiErrorDto(err, "Failed to load inbox"));
      });
    return () => {
      mounted = false;
    };
  }, [open, bot.id]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <InboxIcon /> Inbox
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{bot.name}&apos;s inbox</SheetTitle>
          <SheetDescription className="text-xs">{bot.email}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          {error ? (
            <ErrorNotice error={error} className="mx-4 my-4" />
          ) : threads === null ? (
            <div className="space-y-3 px-4 py-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nothing here yet. Email{" "}
              <span className="text-foreground">{bot.email}</span> and watch
              it show up.
            </p>
          ) : (
            <ul className="px-2 pb-4">
              {threads.map((t) => {
                const isOpen = expanded === t.threadId;
                return (
                  <li key={t.threadId} className="border-b border-border/50 last:border-0">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : t.threadId)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-3 text-left hover:bg-accent/50"
                    >
                      <ChevronRightIcon
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {t.subject || "(no subject)"}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatTime(t.timestamp)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {t.senders.join(", ")} · {t.messageCount}{" "}
                          {t.messageCount === 1 ? "message" : "messages"}
                        </span>
                        {t.preview && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground/70">
                            {t.preview}
                          </span>
                        )}
                      </span>
                    </button>
                    {isOpen && <ThreadMessages botId={bot.id} threadId={t.threadId} />}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
