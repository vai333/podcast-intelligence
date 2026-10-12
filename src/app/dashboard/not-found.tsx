import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[760px]">
      <EmptyState title="We couldn't find that" action={<LinkButton href="/dashboard" variant="primary">Back to the latest brief</LinkButton>}>
        It may have been merged or renamed, or the link is out of date.
      </EmptyState>
    </div>
  );
}
