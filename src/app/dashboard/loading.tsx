import { RowSkeletons, Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px]" aria-busy="true">
      <Skeleton className="mb-2 h-9 w-56" />
      <Skeleton className="mb-6 h-4 w-72" />
      <Skeleton className="mb-6 h-32 w-full" />
      <RowSkeletons count={4} />
    </div>
  );
}
