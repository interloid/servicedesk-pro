import { NextResponse } from "next/server";

import { isPlatformAdminEmail } from "@/features/platform-admin/services/platform-access";
import { invoiceDownloadUrl } from "@/features/platform-admin/services/platform-invoices.service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/**
 * Downloads any workspace's invoice PDF for the platform console. Same gate as
 * requirePlatformAdmin, answered as a status rather than a page: the bucket is
 * private and the link is signed with the service role, so the check must hold
 * before anything is signed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user?.email_confirmed_at ||
    !isPlatformAdminEmail(user.email?.toLowerCase())
  ) {
    // 404, not 403: the console's existence isn't advertised.
    return new NextResponse("Not found", { status: 404 });
  }

  const { invoiceId } = await params;

  if (!isUuid(invoiceId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const url = await invoiceDownloadUrl(invoiceId);

    if (!url) {
      return new NextResponse("This invoice has no PDF.", { status: 404 });
    }

    console.info(`[platform] invoice ${invoiceId} downloaded by ${user.email}`);

    return NextResponse.redirect(url, {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[platform] invoice download failed:", error);

    return new NextResponse("Couldn't prepare the invoice.", { status: 500 });
  }
}
