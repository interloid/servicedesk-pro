import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChannelsOverview } from "@/features/email-channels/components/channels-overview";
import {
  getChannelAdmin,
  getEmailChannelPage,
} from "@/features/email-channels/services/email-channels.service";

export const metadata: Metadata = {
  title: "Channels & Integrations",
  description: "Connect the channels your customers reach you on.",
};

export default async function ChannelsPage() {
  // Tenant Admins only, checked against the live membership.
  if (!(await getChannelAdmin())) {
    notFound();
  }

  const gmail = await getEmailChannelPage();

  return (
    <main className="h-full w-full">
      <ChannelsOverview gmail={gmail} />
    </main>
  );
}
