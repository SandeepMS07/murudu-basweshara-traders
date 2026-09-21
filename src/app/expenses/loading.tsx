import { ListPageSkeleton } from "@/components/layout/PageSkeletons";

export default function ExpensesLoading() {
  return <ListPageSkeleton cards={3} />;
}
