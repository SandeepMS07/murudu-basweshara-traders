import { ListPageSkeleton } from "@/components/layout/PageSkeletons";

export default function UsersLoading() {
  return <ListPageSkeleton cards={0} showFilters={false} />;
}
