import { MoonStar, SunMedium } from "lucide-react";

export function DayStatus() {
  return (
    <div className="absolute -top-14 right-0 hidden items-center gap-4 xl:flex">
      <SunMedium
        className="sx-sun-only size-7"
        style={{ color: "var(--sx-accent)" }}
      />
      <MoonStar
        className="sx-moon-only size-7"
        style={{ color: "var(--sx-accent)" }}
      />
      <span
        className="h-8 w-px"
        style={{ background: "var(--sx-divider-soft)" }}
        aria-hidden="true"
      />
      <p className="text-xs leading-4" style={{ color: "var(--sx-eyebrow)" }}>
        A safer, healthier
        <br />
        world on the move.
      </p>
      <span
        className="ml-1 h-px w-10"
        style={{ background: "var(--sx-accent)" }}
        aria-hidden="true"
      />
    </div>
  );
}
