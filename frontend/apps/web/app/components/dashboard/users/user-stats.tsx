import {
  CircleX,
  Mail,
  ShieldCheck,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface UserStatsValue {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  admins: number;
}

type Tone = "blue" | "green" | "purple" | "red";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[#e9efff] text-[#3047d9]",
  green: "bg-[#eaf8f0] text-[#159455]",
  purple: "bg-[#f2eaff] text-[#7f3ce5]",
  red: "bg-[#feedee] text-[#d92d3a]",
};

function percentage(value: number, total: number): string {
  return total === 0
    ? "0% of total"
    : `${Math.round((value / total) * 100)}% of total`;
}

export function UserStats({ stats }: { stats: UserStatsValue }) {
  const cards: Array<{
    label: string;
    value: number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
    positive?: boolean;
  }> = [
    {
      label: "Total users",
      value: stats.total,
      detail: "+2 this month",
      icon: Users,
      tone: "blue",
      positive: true,
    },
    {
      label: "Active users",
      value: stats.active,
      detail: percentage(stats.active, stats.total),
      icon: UserRoundCheck,
      tone: "green",
    },
    {
      label: "Invited",
      value: stats.invited,
      detail: percentage(stats.invited, stats.total),
      icon: Mail,
      tone: "purple",
    },
    {
      label: "Suspended",
      value: stats.suspended,
      detail: percentage(stats.suspended, stats.total),
      icon: CircleX,
      tone: "red",
    },
    {
      label: "Admins",
      value: stats.admins,
      detail: percentage(stats.admins, stats.total),
      icon: ShieldCheck,
      tone: "blue",
    },
  ];

  return (
    <section
      aria-label="User statistics"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ label, value, detail, icon: Icon, tone, positive }) => (
        <article
          key={label}
          className={`flex min-h-[112px] items-start gap-4 rounded-xl border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.02),0_4px_12px_rgba(16,24,40,.025)] ${label === "Total users" ? "border-[#ccd9fb]" : "border-border"}`}
        >
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}
          >
            <Icon className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-[12px] text-[#526180]">{label}</p>
            <p className="mt-0.5 text-[24px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
              {value}
            </p>
            <p
              className={`mt-2 truncate text-[11px] ${positive ? "font-medium text-[#159455]" : "text-muted-foreground"}`}
            >
              {positive ? "↑ " : ""}
              {detail}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
