"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  DefaultChatTransport,
  isTextUIPart,
  isToolUIPart,
} from "ai";
import { BotAvatar } from "@/components/bot-avatar";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Tool } from "@/components/ai-elements/tool";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InboxSheet } from "@/components/inbox-sheet";
import { IntegrationsSheet } from "@/components/integrations-sheet";
import { ContactsSheet } from "@/components/contacts-sheet";
import type { BotDto } from "@/lib/types";

/**
 * Chat transcripts persist to localStorage so a refresh doesn't wipe the
 * conversation. This is a view cache, not a source of truth — durable bot
 * state lives in the inbox, per the no-database thesis.
 */
const STORAGE_PREFIX = "serverless-bot:chat:";
const MAX_STORED_MESSAGES = 200;

function loadStoredMessages(botId: string): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + botId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function storeMessages(botId: string, messages: UIMessage[]) {
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + botId,
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
    );
  } catch {
    // Quota exceeded or storage unavailable — the chat still works, it
    // just won't survive a refresh.
  }
}

/** Assistant turns sit beside the bot's avatar, so the speaker is always visible. */
function AssistantRow({ bot, children }: { bot: BotDto; children: React.ReactNode }) {
  return (
    <div className="flex w-full items-start gap-3">
      <BotAvatar color={bot.color} shape={bot.shape} className="mt-1 size-6 shrink-0" />
      <MessageContent className="min-w-0 flex-1">{children}</MessageContent>
    </div>
  );
}

/** Pulsing dots shown while the bot hasn't produced any visible output yet. */
function ThinkingIndicator({ bot }: { bot: BotDto }) {
  return (
    <Message from="assistant">
      <AssistantRow bot={bot}>
        <span
          className="flex h-8 items-center gap-1 text-muted-foreground"
          aria-label={`${bot.name} is thinking`}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-current"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </AssistantRow>
    </Message>
  );
}

export function Chat({ bot, allBots }: { bot: BotDto; allBots: BotDto[] }) {
  const [input, setInput] = useState("");
  // Lazy init so localStorage is read once per mounted bot, client-side.
  const [initialMessages] = useState(() => loadStoredMessages(bot.id));

  const { messages, sendMessage, status, setMessages } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { botId: bot.id },
    }),
  });

  useEffect(() => {
    if (status === "streaming") return;
    storeMessages(bot.id, messages);
  }, [bot.id, messages, status]);

  // Fresh browser or redeploy: hydrate from the bot's chat-log email
  // thread (the durable transcript). localStorage, when present, wins —
  // it's richer (tool parts) and already on screen.
  useEffect(() => {
    if (initialMessages.length > 0) return;
    let mounted = true;
    fetch(`/api/chat/history?botId=${encodeURIComponent(bot.id)}`)
      .then(async (r) => (r.ok ? r.json() : { entries: [] }))
      .then((data: { entries?: Array<{ role: "user" | "assistant"; text: string }> }) => {
        if (!mounted || !data.entries?.length) return;
        setMessages((current) =>
          current.length > 0
            ? current
            : data.entries!.map((e, i) => ({
                id: `hist-${i}`,
                role: e.role,
                parts: [{ type: "text" as const, text: e.text }],
              })),
        );
      })
      .catch(() => {
        // History is best-effort; an empty chat is a fine fallback.
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id]);

  function clearChat() {
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + bot.id);
    } catch {
      // storage unavailable — nothing to clear
    }
  }

  const lastMessage = messages[messages.length - 1];
  // Waiting on the model: request sent, or streaming but nothing visible yet
  // (reasoning happens before the first text/tool part arrives).
  const thinking =
    status === "submitted" ||
    (status === "streaming" &&
      (lastMessage?.role !== "assistant" ||
        !lastMessage.parts.some(
          (part) => (isTextUIPart(part) && part.text) || isToolUIPart(part),
        )));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <BotAvatar color={bot.color} shape={bot.shape} className="size-8" />
          <div>
            <div className="text-sm font-medium leading-tight">{bot.name}</div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              {bot.email}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              aria-label="Clear chat"
              className="gap-1.5 text-muted-foreground"
            >
              <Trash2Icon /> Clear
            </Button>
          )}
          <IntegrationsSheet bot={bot} />
          <ContactsSheet bot={bot} allBots={allBots} />
          <InboxSheet bot={bot} />
        </div>
      </header>

      <Conversation>
        {messages.length === 0 ? (
          <ConversationEmptyState
            title={bot.name}
            description={bot.tagline || "Hand it a task, or email it directly."}
          >
            <p className="text-xs text-muted-foreground/70">{bot.email}</p>
          </ConversationEmptyState>
        ) : (
          <ConversationContent>
            {messages.map((message) => {
              const body = message.parts.map((part, i) => {
                    if (isTextUIPart(part)) {
                      if (!part.text) return null;
                      return message.role === "assistant" ? (
                        <Response key={i}>{part.text}</Response>
                      ) : (
                        <span key={i}>{part.text}</span>
                      );
                    }
                    if (isToolUIPart(part)) {
                      return (
                        <Tool
                          key={i}
                          type={part.type}
                          state={part.state}
                          input={part.input}
                          output={
                            part.state === "output-available" ? part.output : undefined
                          }
                          errorText={
                            part.state === "output-error" ? part.errorText : undefined
                          }
                        />
                      );
                    }
                    return null;
              });
              return (
                <Message key={message.id} from={message.role}>
                  {message.role === "assistant" ? (
                    <AssistantRow bot={bot}>{body}</AssistantRow>
                  ) : (
                    <MessageContent>{body}</MessageContent>
                  )}
                </Message>
              );
            })}
            {thinking && <ThinkingIndicator bot={bot} />}
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        <div className="mx-auto max-w-2xl">
          <PromptInput onSubmit={onSubmit}>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${bot.name}`}
            />
            <PromptInputSubmit status={status} disabled={!input.trim()} />
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
