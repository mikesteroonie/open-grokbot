/** Client-side mirrors of the API payloads. */

/** Structured error payload returned by every API route on failure. */
export type ApiErrorDto = {
  error: string;
  code?: string;
  fix?: string;
  suggestions?: string[];
  docs?: string;
};

export type ContactDto = {
  name: string;
  email: string;
  description: string;
};

export type IntegrationDto = {
  name: string;
  baseUrl: string;
  docsUrl: string;
  /** Display-only: "••••1234". The real key never reaches the browser. */
  apiKeyMasked: string;
  apiKeyHeader: string;
};

export type BotDto = {
  id: string;
  name: string;
  tagline: string;
  personality: string;
  contacts: ContactDto[];
  integrations: IntegrationDto[];
  color: string;
  shape: string;
  email: string;
  inboxId: string;
  createdAt: string;
};

export type BotTemplateDto = {
  username: string;
  name: string;
  tagline: string;
  color: string;
  shape: string;
  personality: string;
};

export type ThreadSummaryDto = {
  threadId: string;
  subject?: string;
  preview?: string;
  senders: string[];
  recipients: string[];
  messageCount: number;
  timestamp: string;
};

export type ThreadMessageDto = {
  messageId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  timestamp: string;
  text: string;
};
