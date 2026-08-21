"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Streamed assistant markdown, styled with theme tokens. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>
        ),
        h1: ({ children }) => (
          <h1 className="mt-4 mb-2 text-base font-semibold first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-4 mb-2 text-[15px] font-semibold first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 decoration-muted-foreground/50 hover:decoration-foreground"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="my-2 ml-5 list-disc space-y-1 marker:text-muted-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-muted-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ className, children }) => {
          const isBlock =
            typeof className === "string" && className.startsWith("language-");
          return (
            <code
              className={
                isBlock
                  ? "font-mono text-[13px]"
                  : "rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]"
              }
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-lg border bg-muted/50 p-3 text-[13px]">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4" />,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/50 px-3 py-2 align-top">{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
