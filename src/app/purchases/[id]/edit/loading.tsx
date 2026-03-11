import { AppShellSkeleton } from "@/components/layout/AppShellSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditPurchaseLoading() {
  return (
    <AppShellSkeleton>
      <Skeleton className="h-16 w-80" />
      <Skeleton className="h-[640px] w-full" />
    </AppShellSkeleton>
  );
}

