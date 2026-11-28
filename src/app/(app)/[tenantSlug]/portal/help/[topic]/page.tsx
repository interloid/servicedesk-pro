import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

import { isChatbotEnabled } from "@/features/chatbot/providers";
import { PortalHelpQuestionOpener } from "@/features/portal/components/portal-help-question-opener";
import { StillNeedHelp } from "@/features/portal/components/portal-help-search";
import {
  findHelpTopic,
  helpTopicRequestHref,
  helpTopics,
} from "@/features/portal/help-topics";
import { PORTAL_ROUTES, portalPath } from "@/features/portal/portal";
import {
  getPortalIdentity,
  getPortalTenant,
} from "@/features/portal/services/portal.service";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ tenantSlug: string; topic: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { tenantSlug, topic: slug } = await params;
  const tenant = await getPortalTenant(tenantSlug);
  const topic = findHelpTopic(tenant?.name ?? "the product", slug);

  return { title: topic ? `${topic.title} · Help centre` : "Help centre" };
}

/**
 * One help topic: its questions as an expandable list (plain <details>, so
 * they open with no JavaScript and each can be linked to by its id), the way
 * to the team with the topic's subject already in the request form, and the
 * other topics.
 */
export default async function PortalHelpTopicPage({ params }: PageProps) {
  const { tenantSlug, topic: slug } = await params;
  const [tenant, identity] = await Promise.all([
    getPortalTenant(tenantSlug),
    getPortalIdentity(tenantSlug),
  ]);
  const productName = tenant?.name ?? "the product";
  // Same condition as the layout's: the chat is only on the page then.
  const chatEnabled = identity !== null && isChatbotEnabled();
  const topic = findHelpTopic(productName, slug);

  if (!topic) notFound();

  const helpPath = portalPath(tenantSlug, PORTAL_ROUTES.HELP);
  const newRequest = portalPath(tenantSlug, PORTAL_ROUTES.NEW_REQUEST);
  const others = helpTopics(productName).filter((t) => t.slug !== topic.slug);
  const Icon = topic.icon;

  return (
    <div className="mx-auto w-full max-w-7xl md:px-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link
              href={helpPath}
              className="font-medium text-muted-foreground hover:text-brand-accent"
            >
              Help centre
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li
            aria-current="page"
            className="truncate font-medium text-foreground"
          >
            {topic.title}
          </li>
        </ol>
      </nav>

      <header className="mt-5 flex items-start gap-4 border-b pb-6">
        <span
          aria-hidden
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            topic.tone,
          )}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
            {topic.title}
          </h1>
          <p className="mt-1 text-sm leading-[1.6] text-muted-foreground">
            {topic.body} {topic.questions.length} question
            {topic.questions.length === 1 ? "" : "s"} answered below.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Questions" className="min-w-0">
          <PortalHelpQuestionOpener />
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {topic.questions.map((item, index) => (
              <li key={item.id} id={item.id} className="scroll-mt-24">
                <details className="group" open={index === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-left outline-none hover:bg-muted/30 focus-visible:bg-muted/40 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                      {item.question}
                    </span>
                    <ChevronDown
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <StillNeedHelp
            newRequest={helpTopicRequestHref(newRequest, topic)}
            chatEnabled={chatEnabled}
          />

          <nav
            aria-label="Other topics"
            className="overflow-hidden rounded-xl border bg-card"
          >
            <h2 className="border-b px-5 py-3 text-sm font-semibold text-foreground">
              Other topics
            </h2>
            <ul className="divide-y">
              {others.map((other) => {
                const OtherIcon = other.icon;
                return (
                  <li key={other.slug}>
                    <Link
                      href={`${helpPath}/${other.slug}`}
                      className="group flex items-center gap-3 px-5 py-3 text-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          other.tone,
                        )}
                      >
                        <OtherIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {other.title}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
