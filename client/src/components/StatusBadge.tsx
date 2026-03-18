import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Status =
  | "open"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "clarification_needed"
  | "approved"
  | "rejected"
  | "completed";

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useLang();
  const label = (t.status as any)[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        `status-${status}`,
        className
      )}
    >
      {label}
    </span>
  );
}

interface CompletenessBarProps {
  score: number;
  showLabel?: boolean;
  className?: string;
}

export function CompletenessBar({ score, showLabel = true, className }: CompletenessBarProps) {
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 50
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground w-10 text-right">
          {score}%
        </span>
      )}
    </div>
  );
}
