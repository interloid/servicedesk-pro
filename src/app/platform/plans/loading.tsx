import { PlatformListSkeleton } from "@/features/platform-admin/components/platform-skeletons";

export default function Loading() {
  return <PlatformListSkeleton label="Loading plans…" stats={3} />;
}
