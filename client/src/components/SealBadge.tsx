import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type SealStatus = "verified" | "in_progress" | "not_verified";

interface SealBadgeProps {
  status: SealStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  verified: {
    label: "VERIFIED",
    sublabel: "Swiss Product Seal",
    icon: ShieldCheck,
    bg: "bg-white",
    border: "border-[#C8102E]",
    iconColor: "text-[#C8102E]",
    badgeBg: "bg-[#2E7D32]",
    badgeText: "text-white",
  },
  in_progress: {
    label: "IN PROGRESS",
    sublabel: "Swiss Product Seal",
    icon: ShieldAlert,
    bg: "bg-white",
    border: "border-amber-500",
    iconColor: "text-amber-500",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
  },
  not_verified: {
    label: "NOT VERIFIED",
    sublabel: "Swiss Product Seal",
    icon: ShieldOff,
    bg: "bg-white",
    border: "border-gray-400",
    iconColor: "text-gray-400",
    badgeBg: "bg-gray-400",
    badgeText: "text-white",
  },
};

const SIZE_CONFIG = {
  sm: {
    wrapper: "w-24",
    shield: "p-2",
    icon: 24,
    sublabel: "text-[7px]",
    badge: "text-[8px] py-0.5 px-1",
  },
  md: {
    wrapper: "w-36",
    shield: "p-3",
    icon: 36,
    sublabel: "text-[9px]",
    badge: "text-[10px] py-1 px-2",
  },
  lg: {
    wrapper: "w-52",
    shield: "p-5",
    icon: 52,
    sublabel: "text-xs",
    badge: "text-sm py-1.5 px-3",
  },
};

export function SealBadge({ status, size = "md", showLabel = true, className }: SealBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const sz = SIZE_CONFIG[size];
  const Icon = cfg.icon;

  return (
    <div className={cn("flex flex-col items-center select-none", sz.wrapper, className)}>
      {/* Shield shape */}
      <div
        className={cn(
          "w-full rounded-t-full rounded-b-[30%] border-2 flex flex-col items-center justify-center gap-0.5",
          cfg.bg,
          cfg.border,
          sz.shield
        )}
        style={{ clipPath: "polygon(50% 0%, 100% 15%, 100% 70%, 50% 100%, 0% 70%, 0% 15%)" }}
      >
        <Icon size={sz.icon} className={cn("shrink-0", cfg.iconColor)} strokeWidth={1.5} />
        {showLabel && (
          <span className={cn("font-bold tracking-widest uppercase text-center leading-none text-gray-800", sz.sublabel)}>
            {cfg.sublabel}
          </span>
        )}
      </div>
      {/* Status banner */}
      {showLabel && (
        <div className={cn("w-full text-center font-extrabold tracking-widest uppercase rounded-b", cfg.badgeBg, cfg.badgeText, sz.badge)}>
          {cfg.label}
        </div>
      )}
    </div>
  );
}

// ─── Inline compact badge (for lists / headers) ───────────────────────────────

interface SealStatusPillProps {
  status: SealStatus;
  className?: string;
}

export function SealStatusPill({ status, className }: SealStatusPillProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
        cfg.badgeBg,
        cfg.badgeText,
        className
      )}
    >
      <Icon size={12} strokeWidth={2} />
      {cfg.label}
    </span>
  );
}
