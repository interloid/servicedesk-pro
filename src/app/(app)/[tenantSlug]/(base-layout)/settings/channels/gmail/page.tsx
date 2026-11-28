import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EmailChannelSettings } from "@/features/email-channels/components/email-channel-settings";
import {
  getChannelAdmin,
  getEmailChannelPage,
} from "@/features/email-channels/services/email-channels.service";

export const metadata: Metadata = {
  title: "Gmail channel",
  description: "Turn support emails into tickets.",
};

export default async function ChannelsPage() {
  // Tenant Admins only, checked against the live membership. RLS would show
  // anyone else an empty page; this shows them none.
  if (!(await getChannelAdmin())) {
    notFound();
  }

  const data = await getEmailChannelPage();

  return (
    <main className="h-full w-full">
      {/* useSearchParams (the OAuth result toast) needs a boundary. */}
      <Suspense>
        <EmailChannelSettings data={data} />
      </Suspense>
    </main>
  );
}
