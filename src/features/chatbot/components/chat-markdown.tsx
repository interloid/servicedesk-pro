"use client";

import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { isInternal } from "@/features/chatbot/lib/links";

/**
 * The assistant's replies, rendered as Markdown with GitHub tables.
 *
 * The text comes from a model that has read ticket contents, so it is treated
 * as untrusted: raw HTML is never rendered (react-markdown's default, kept by
 * `skipHtml`), and only links into this site are clickable. The model is told
 * to link requests by the relative url its tools return; anything else -- an
 * external address copied from a ticket, say -- shows as plain text.
 */
const components: Components = {
  p: ({ children }) => (
    <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <p className="mt-3 mb-1.5 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mt-3 mb-1.5 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mt-3 mb-1.5 font-semibold">{children}</p>,
  h4: ({ children }) => <p className="mt-3 mb-1.5 font-semibold">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
  a: ({ href, children }) =>
    isInternal(href) ? (
      <Link
        href={href}
        className="font-semibold text-brand-ink underline decoration-current/30 underline-offset-2 hover:decoration-current"
      >
        {children}
      </Link>
    ) : (
      <span>{children}</span>
    ),
  table: ({ children }) => (
    <div className="my-2.5 overflow-x-auto rounded-xl border bg-background">
      <table className="w-full border-collapse text-left text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/60 text-xs text-muted-foreground">
      {children}
    </thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  img: ({ alt }) => <span>{alt}</span>,
};

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
      {text}
    </Markdown>
  );
}
