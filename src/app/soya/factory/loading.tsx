import { AppShellSkeleton } from "@/components/layout/AppShellSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SoyaFactoryLoading() {
  return (
    <AppShellSkeleton>
      <Skeleton className="h-16 w-72" />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-[460px] w-full" />
    </AppShellSkeleton>
  );
}
