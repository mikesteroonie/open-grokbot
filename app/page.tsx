"use client";

import { useEffect, useState } from "react";
import { BotSidebar } from "@/components/bot-sidebar";
import { Chat } from "@/components/chat";
import { NewBotScreen } from "@/components/new-bot-screen";
import { ErrorNotice, readApiError, toApiErrorDto } from "@/components/error-notice";
import type { ApiErrorDto, BotDto, BotTemplateDto } from "@/lib/types";

export default function Home() {
  const [bots, setBots] = useState<BotDto[]>([]);
  const [templates, setTemplates] = useState<BotTemplateDto[]>([]);
  const [offline, setOffline] = useState(false);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorDto | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/bots")
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r, "Failed to load bots");
        const data = await r.json();
        if (!mounted) return;
        setBots(data.bots ?? []);
        setTemplates(data.templates ?? []);
        setOffline(!!data.offline);
        setPrincipal(data.principal ?? null);
        setDomain(typeof data.domain === "string" ? data.domain : undefined);
        if (data.bots?.length) {
          setSelectedId(data.bots[0].id);
        } else {
          setCreating(true);
        }
      })
      .catch((err) => {
        if (mounted) setLoadError(toApiErrorDto(err, "Failed to load bots"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selected = bots.find((b) => b.id === selectedId) ?? null;

  function handleCreated(bot: BotDto) {
    setBots((prev) => {
      const without = prev.filter((b) => b.id !== bot.id);
      return [...without, bot];
    });
    setSelectedId(bot.id);
    setCreating(false);
  }

  return (
    <main className="flex h-dvh overflow-hidden">
      <BotSidebar
        bots={bots}
        loading={loading}
        offline={offline}
        principal={principal}
        selectedId={selectedId}
        creating={creating}
        onSelect={(bot) => {
          setSelectedId(bot.id);
          setCreating(false);
        }}
        onNewBot={() => setCreating(true)}
      />

      <div className="flex min-w-0 flex-1 border-l">
        {loadError ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <ErrorNotice error={loadError} className="max-w-md" />
          </div>
        ) : creating || (!loading && !selected) ? (
          <NewBotScreen templates={templates} domain={domain} onCreated={handleCreated} />
        ) : (
          // One mounted Chat per bot so each conversation survives switching.
          bots.map((bot) => (
            <div
              key={bot.id}
              className={
                selected && bot.id === selected.id ? "flex min-w-0 flex-1" : "hidden"
              }
            >
              <Chat bot={bot} allBots={bots} />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
