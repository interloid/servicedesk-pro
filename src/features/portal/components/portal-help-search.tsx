"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  LifeBuoy,
  MessageCircle,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PORTAL_CHAT_OPEN_EVENT } from "@/features/chatbot/chatbot";
import {
  helpTopics,
  type HelpQuestion,
  type HelpTopic,
} from "@/features/portal/help-topics";
import { cn } from "@/lib/utils";

/** The questions picked for "Popular questions", as topic slug + question id. */
const POPULAR: Array<[string, string]> = [
  ["getting-started", "raise-a-request"],
  ["troubleshooting", "waiting-on-you"],
  ["troubleshooting", "problem-came-back"],
  ["using-the-product", "attach-files"],
  ["security", "set-password"],
];

/**
 * The help centre: a search box, the topics, popular questions, and a way to
 * reach the team.
 *
 * Searching filters the topics (their titles, descriptions, keywords and the
 * questions on them) and never navigates by itself: typing and pressing enter
 * used to land on the request form with the words in the subject, which told a
 * customer who had not decided they wanted a ticket that they had just raised
 * one. Creating the request is something the customer does on purpose -- from
 * a topic page, the panel at the bottom, or the fallback when nothing matches.
 */
export function PortalHelpSearch({
  productName,
  helpPath,
  newRequest,
  chatEnabled = false,
}: {
  /** The tenant's name, so a topic can say "Using <product>". */
  productName: string;
  /** The chat is on the page (signed in, chatbot on): offer it. */
  chatEnabled?: boolean;
  /** Path of the help centre, for the topic pages under it. */
  helpPath: string;
  /** Path of the request form, built on the server. */
  newRequest: string;
}) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;
  const topics = helpTopics(productName);
  const matches = isSearching
    ? topics.filter((topic) => topicMatches(topic, trimmed))
    : topics;
  const nothingFound = isSearching && matches.length === 0;

  const popular = POPULAR.flatMap(([slug, id]) => {
    const topic = topics.find((t) => t.slug === slug);
    const question = topic?.questions.find((q) => q.id === id);
    return topic && question ? [{ topic, question }] : [];
  });

  /**
   * The form is a plain GET to the request form, so it still works with no
   * JavaScript -- but only as the fallback. Filtering is live, so there is
   * nothing to submit while there are results; the button is drawn only once
   * the search has come up empty.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!nothingFound) event.preventDefault();
  }

  const status = !isSearching
    ? ""
    : nothingFound
      ? `No topic matches ${trimmed}. Create a request instead.`
      : `${matches.length} topic${matches.length === 1 ? "" : "s"} match ${trimmed}.`;

  return (
    <form
      action={newRequest}
      method="get"
      role="search"
      onSubmit={handleSubmit}
    >
      {/* The Input primitive's focus treatment, on the bar rather than the
          bare input inside it: the bar is the box that gets drawn. */}
      <div className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-xl border bg-card p-1.5 pl-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 focus-within:outline-none">
        <Search
          aria-hidden
          className="size-4.5 shrink-0 text-muted-foreground"
        />
        <label htmlFor="portal-help-search" className="sr-only">
          Search help topics
        </label>
        <input
          id="portal-help-search"
          name="subject"
          type="search"
          value={query}
          maxLength={200}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for answers, e.g. password, invoice, attachment"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {isSearching ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuery("")}
            className="border-0 bg-transparent hover:bg-transparent hover:text-foreground"
          >
            <X aria-hidden />
            <span className="sr-only">Clear search</span>
          </Button>
        ) : null}
        {nothingFound ? (
          <Button type="submit" className="h-10 shrink-0 px-4 font-semibold">
            Ask us
          </Button>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {nothingFound ? (
        <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <span
            aria-hidden
            className="mx-auto flex size-11 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground"
          >
            <LifeBuoy className="size-5" />
          </span>
          <h2 className="mt-4 text-sm font-semibold">
            Nothing here covers &ldquo;{trimmed}&rdquo;
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">
            Send the question to our team and you&apos;ll get a reply on the
            request.
          </p>
          {/* Submits the form above, so the request opens with what the
              customer just typed already in the subject. */}
          <Button type="submit" className="mt-5 h-10 px-4 font-semibold">
            Create a request
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-10 flex items-end justify-between gap-3 sm:mt-12">
            <h2 className="text-base font-semibold text-foreground">
              Browse by topic
            </h2>
            {isSearching ? (
              <p className="text-xs text-muted-foreground">
                {matches.length} topic{matches.length === 1 ? "" : "s"} matching
                &ldquo;{trimmed}&rdquo;
              </p>
            ) : null}
          </div>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {matches.map((topic) => (
              <li key={topic.slug}>
                <TopicCard topic={topic} href={`${helpPath}/${topic.slug}`} />
              </li>
            ))}
          </ul>

          {!isSearching ? (
            <section className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="overflow-hidden rounded-xl border bg-card">
                <h2 className="border-b px-5 py-3.5 text-sm font-semibold text-foreground">
                  Popular questions
                </h2>
                <ul className="divide-y">
                  {popular.map(({ topic, question }) => (
                    <li key={question.id}>
                      <QuestionLink
                        href={`${helpPath}/${topic.slug}#${question.id}`}
                        question={question}
                        topicTitle={topic.title}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              <StillNeedHelp
                newRequest={newRequest}
                chatEnabled={chatEnabled}
              />
            </section>
          ) : null}
        </>
      )}
    </form>
  );
}

function TopicCard({ topic, href }: { topic: HelpTopic; href: string }) {
  const Icon = topic.icon;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl border bg-card p-5 text-foreground transition-colors outline-none hover:border-foreground/20 hover:bg-muted/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent/30"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          topic.tone,
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="mt-4 block text-sm font-semibold">{topic.title}</span>
      <span className="mt-1 block flex-1 text-xs leading-5 text-muted-foreground">
        {topic.body}
      </span>
      <span className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
        <span className="text-muted-foreground">
          {topic.questions.length} question
          {topic.questions.length === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-brand-ink">
          Read more
          <ArrowRight
            aria-hidden
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  );
}

function QuestionLink({
  href,
  question,
  topicTitle,
}: {
  href: string;
  question: HelpQuestion;
  topicTitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-5 py-3.5 text-foreground transition-colors outline-none hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{question.question}</span>
        <span className="block text-xs text-muted-foreground">
          {topicTitle}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/**
 * The way out of the help centre to a person: the request form, or the chat
 * for a quick answer. Shared with the topic pages.
 */
export function StillNeedHelp({
  newRequest,
  chatEnabled = false,
  className,
}: {
  /** The request form, with a topic's subject already in it if there is one. */
  newRequest: string;
  /** Only where the chat widget is on the page, or the button does nothing. */
  chatEnabled?: boolean;
  className?: string;
}) {
  return (
    <aside className={cn("rounded-xl border bg-card p-5", className)}>
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
      >
        <LifeBuoy className="size-5" />
      </span>
      <h2 className="mt-4 text-sm font-semibold text-foreground">
        Still need help?
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Our team replies on your request, and you can follow the whole
        conversation under Your requests.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button asChild className="h-10 font-semibold">
          <Link href={newRequest}>Create a request</Link>
        </Button>
        {chatEnabled ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              window.dispatchEvent(new Event(PORTAL_CHAT_OPEN_EVENT))
            }
            className="h-10 gap-2 font-semibold hover:bg-brand-accent/10 hover:text-brand-accent"
          >
            <MessageCircle aria-hidden className="size-4" />
            Chat with us
          </Button>
        ) : null}
      </div>
    </aside>
  );
}

/**
 * Every word the customer typed has to appear somewhere on the topic -- its
 * title, description, keywords or questions -- so "invoice" and "billing"
 * narrow the list while "invoice billing" still finds the one topic that
 * covers both.
 */
function topicMatches(topic: HelpTopic, query: string): boolean {
  const haystack = [
    topic.title,
    topic.body,
    topic.keywords,
    ...topic.questions.map((q) => q.question),
  ]
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
