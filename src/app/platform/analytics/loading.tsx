import { PlatformListSkeleton } from "@/features/platform-admin/components/platform-skeletons";

export default function Loading() {
  return <PlatformListSkeleton label="Loading analytics…" stats={4} />;
}
