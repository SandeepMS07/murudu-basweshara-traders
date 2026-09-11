import { AppShellSkeleton } from "@/components/layout/AppShellSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SoyaDashboardLoading() {
  return (
    <AppShellSkeleton>
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </AppShellSkeleton>
  );
}
