import { SupportSkeleton } from "@/features/support/components/support-skeleton";

/**
 * Every Help & Support page awaits its requests on the server. Without this
 * file a click leaves the previous screen up until they arrive, which reads as
 * a dead link.
 */
export default function Loading() {
  return <SupportSkeleton />;
}
