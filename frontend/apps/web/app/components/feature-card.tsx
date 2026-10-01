import { ArrowRight, type LucideIcon } from "lucide-react";

type FeatureCardProps = {
  accent: string;
  description: React.ReactNode;
  icon: LucideIcon;
  title: string;
};

export function FeatureCard({
  accent,
  description,
  icon: Icon,
  title,
}: FeatureCardProps) {
  return (
    <article
      className="feature-glass group flex min-h-[190px] flex-1 flex-col rounded-2xl px-5 py-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-500/50 xl:h-[212px] xl:min-h-0"
      style={{ color: "var(--sx-ink)" }}
    >
      <div
        className="grid size-[68px] place-items-center rounded-full border shadow-[0_0_28px_currentColor]"
        style={{
          color: accent,
          borderColor: `${accent}99`,
          background: `${accent}18`,
        }}
      >
        <Icon className="size-8" strokeWidth={1.8} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.025em] sm:text-xl">
            {title}
          </h2>
          <p
            className="mt-1.5 max-w-[190px] text-sm leading-[1.45] sm:text-[15px] xl:text-sm"
            style={{ color: "var(--sx-body)" }}
          >
            {description}
          </p>
        </div>
        <ArrowRight
          className="mb-2 size-5 shrink-0 transition-transform group-hover:translate-x-1"
          style={{ color: "var(--sx-icon-soft)" }}
        />
      </div>
    </article>
  );
}
