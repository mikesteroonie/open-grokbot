"use client";

import { UserIcon } from "lucide-react";
import { BotAvatar } from "@/components/bot-avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BotDto } from "@/lib/types";

export function BotSidebar({
  bots,
  loading,
  offline,
  principal,
  selectedId,
  creating,
  onSelect,
  onNewBot,
}: {
  bots: BotDto[];
  loading: boolean;
  offline: boolean;
  principal: string | null;
  selectedId: string | null;
  creating: boolean;
  onSelect: (bot: BotDto) => void;
  onNewBot: () => void;
}) {
  const empty = !loading && bots.length === 0;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col bg-black/40">
      <div className="p-3">
        <button
          type="button"
          onClick={onNewBot}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border bg-card/70 px-4 py-3.5 text-left transition-colors hover:bg-accent/60",
            creating && "bg-accent/60",
          )}
        >
          <BotAvatar color="blue" shape="circle" className="size-7" />
          <span className="text-[15px] font-medium">
            {empty ? "Create your first Bot" : "New Bot"}
          </span>
          {offline && (
            <Badge variant="outline" className="ml-auto text-[10px] uppercase">
              offline
            </Badge>
          )}
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : empty ? (
          <div className="flex h-full items-center justify-center px-6 py-24 text-[15px] text-muted-foreground">
            No chats yet
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {bots.map((bot) => {
              const active = !creating && bot.id === selectedId;
              return (
                <li key={bot.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(bot)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                      active ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <BotAvatar color={bot.color} shape={bot.shape} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{bot.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {bot.email}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary">
          <UserIcon className="size-4 text-muted-foreground" />
        </span>
        <span className="text-sm">{principal ?? "You"}</span>
      </div>
    </aside>
  );
}
