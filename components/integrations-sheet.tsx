"use client";

import { useEffect, useState } from "react";
import {
  BellIcon,
  GlobeIcon,
  LoaderCircleIcon,
  MailIcon,
  PlusIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ApiErrorDto, BotDto, IntegrationDto } from "@/lib/types";
import { ErrorNotice, readApiError, toApiErrorDto } from "@/components/error-notice";

/**
 * Per-bot API integrations: paste an llms.txt docs URL, a base URL, and an
 * API key, and the bot gets read_api_docs + api_request tools for that
 * service. Keys are stored server-side; the browser only ever sees a
 * masked tail, and an empty key on save means "keep the stored one".
 */
type Builtin = { email: string; webSearch: boolean; principal: string | null };

export function IntegrationsSheet({ bot }: { bot: BotDto }) {
  const [open, setOpen] = useState(false);
  const [builtin, setBuiltin] = useState<Builtin | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationDto[]>(
    bot.integrations ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorDto | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyHeader, setApiKeyHeader] = useState("");

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    fetch(`/api/bots/${encodeURIComponent(bot.id)}/integrations`)
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r, "Failed to load integrations");
        const data = await r.json();
        if (mounted) {
          setIntegrations(data.integrations ?? []);
          setBuiltin(data.builtin ?? null);
        }
      })
      .catch((err) => {
        if (mounted) setError(toApiErrorDto(err, "Failed to load integrations"));
      });
    return () => {
      mounted = false;
    };
  }, [open, bot.id]);

  async function save(next: Array<IntegrationDto & { apiKey?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(bot.id)}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrations: next.map((i) => ({
            name: i.name,
            baseUrl: i.baseUrl,
            docsUrl: i.docsUrl,
            apiKeyHeader: i.apiKeyHeader,
            apiKey: i.apiKey ?? "",
          })),
        }),
      });
      if (!res.ok) throw await readApiError(res, "Failed to save integrations");
      const data = await res.json();
      setIntegrations(data.integrations ?? []);
      return true;
    } catch (err) {
      setError(toApiErrorDto(err, "Failed to save integrations"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim() || !docsUrl.trim()) return;
    const ok = await save([
      ...integrations,
      {
        name: name.trim().toLowerCase(),
        baseUrl: baseUrl.trim(),
        docsUrl: docsUrl.trim(),
        apiKey: apiKey.trim(),
        apiKeyHeader: apiKeyHeader.trim() || "Authorization",
        apiKeyMasked: "",
      },
    ]);
    if (ok) {
      setName("");
      setBaseUrl("");
      setDocsUrl("");
      setApiKey("");
      setApiKeyHeader("");
    }
  }

  function remove(target: IntegrationDto) {
    save(integrations.filter((i) => i.name !== target.name));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <WrenchIcon /> Tools
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{bot.name}&apos;s tools</SheetTitle>
          <SheetDescription>
            Give this bot an API: paste the service&apos;s llms.txt (or any
            plain-text docs) URL, its API base URL, and a key. The bot reads
            the docs and calls the API itself.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-4 pb-4">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Built in
              </div>
              <ul className="space-y-2">
                <BuiltinRow
                  icon={<MailIcon className="size-4" />}
                  name="Email (AgentMail)"
                  detail={`send_email · reply_to_email · list_threads · get_thread — all pinned to ${builtin?.email ?? bot.email}`}
                  status="on"
                />
                <BuiltinRow
                  icon={<GlobeIcon className="size-4" />}
                  name="Web search (Exa)"
                  detail="web_search — current sources with titles, URLs, snippets"
                  status={builtin ? (builtin.webSearch ? "on" : "off") : "loading"}
                  hint="Set EXA_API_KEY in .env.local"
                />
                <BuiltinRow
                  icon={<BellIcon className="size-4" />}
                  name="Escalation"
                  detail={
                    builtin?.principal
                      ? `notify_principal — emails ${builtin.principal}`
                      : "notify_principal — emails your principal"
                  }
                  status={builtin ? (builtin.principal ? "on" : "off") : "loading"}
                  hint="Set PRINCIPAL_EMAIL in .env.local"
                />
              </ul>
            </div>

            <Separator />

            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Add an API
              </div>
              <form onSubmit={addManual} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                    }
                    placeholder="Name, e.g. stripe"
                    aria-label="Integration name"
                    maxLength={40}
                  />
                  <Input
                    value={apiKeyHeader}
                    onChange={(e) => setApiKeyHeader(e.target.value)}
                    placeholder="Auth header (Authorization)"
                    aria-label="API key header"
                    maxLength={60}
                  />
                </div>
                <Input
                  value={docsUrl}
                  onChange={(e) => setDocsUrl(e.target.value)}
                  placeholder="Docs URL — https://docs.example.com/llms.txt"
                  aria-label="Docs URL"
                  type="url"
                  maxLength={300}
                />
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="API base URL — https://api.example.com"
                  aria-label="API base URL"
                  type="url"
                  maxLength={300}
                />
                <div className="flex gap-2">
                  <Input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API key — blank only for public APIs"
                    aria-label="API key"
                    type="password"
                    maxLength={300}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="icon"
                    aria-label="Add integration"
                    disabled={busy || !name.trim() || !baseUrl.trim() || !docsUrl.trim()}
                    className="shrink-0"
                  >
                    {busy ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
                  </Button>
                </div>
              </form>
            </div>

            {error && <ErrorNotice error={error} />}

            <Separator />

            {integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tools yet. Web search and email come built in; anything
                with an HTTP API and docs can be added here.
              </p>
            ) : (
              <ul className="space-y-2">
                {integrations.map((i) => (
                  <li
                    key={i.name}
                    className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{i.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {i.baseUrl}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        docs: {i.docsUrl}
                        {i.apiKeyMasked && ` · key ${i.apiKeyMasked}`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${i.name}`}
                      disabled={busy}
                      onClick={() => remove(i)}
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function BuiltinRow({
  icon,
  name,
  detail,
  status,
  hint,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  status: "on" | "off" | "loading";
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          {status === "on" && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              active
            </Badge>
          )}
          {status === "off" && (
            <Badge
              variant="outline"
              className="h-5 border-destructive/40 px-1.5 text-[10px] text-destructive"
            >
              not configured
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detail}</div>
        {status === "off" && hint && (
          <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
        )}
      </div>
    </li>
  );
}
