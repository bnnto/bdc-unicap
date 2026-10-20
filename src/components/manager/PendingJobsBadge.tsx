import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/** Selo com a quantidade de vagas aguardando revisão. */
export function PendingJobsBadge() {
  const count = useQuery(api.moderation.pendingModerationCount, {});
  if (count === undefined || count === 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only"> em revisão</span>
    </span>
  );
}