import type { Metadata } from "next";

import { isChatbotEnabled } from "@/features/chatbot/providers";
import { PortalHelpSearch } from "@/features/portal/components/portal-help-search";
import { PORTAL_ROUTES, portalPath } from "@/features/portal/portal";
import {
  getPortalIdentity,
  getPortalTenant,
} from "@/features/portal/services/portal.service";

export const metadata: Metadata = {
  title: "Help centre",
};

/**
 * The page supplies the tenant's name -- which one topic is named after -- and
 * the paths the topics and the request form live at; the search box, topics
 * and popular questions are in PortalHelpSearch, and each topic's questions
 * are on its own page (./[topic]).
 */
export default async function PortalHelpPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const [tenant, identity] = await Promise.all([
    getPortalTenant(tenantSlug),
    getPortalIdentity(tenantSlug),
  ]);
  // Same condition as the layout's: the chat is only on the page then.
  const chatEnabled = identity !== null && isChatbotEnabled();

  return (
    <div className="mx-auto w-full max-w-7xl md:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-[0.08em] text-brand-ink uppercase">
          Help centre
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          How can we help?
        </h1>
        <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">
          Search the answers below or browse by topic. If nothing fits, our team
          is a request away.
        </p>
      </div>

      <PortalHelpSearch
        productName={tenant?.name ?? "the product"}
        helpPath={portalPath(tenantSlug, PORTAL_ROUTES.HELP)}
        newRequest={portalPath(tenantSlug, PORTAL_ROUTES.NEW_REQUEST)}
        chatEnabled={chatEnabled}
      />
    </div>
  );
}
