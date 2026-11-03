import { PlatformOverviewSkeleton } from "@/features/platform-admin/components/platform-skeletons";

// In (overview) so it covers only this page, not the sub-routes' own skeletons.
export default function Loading() {
  return <PlatformOverviewSkeleton />;
}
