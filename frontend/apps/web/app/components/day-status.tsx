"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { Lines } from "../../lib/i18n/lines";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";

const messages = defineMessages({
  en: { tagline: ["A safer, healthier", "world on the move."] },
  fr: {
    tagline: ["Un monde plus sûr et plus sain,", "toujours en mouvement."],
  },
});

export function DayStatus() {
  const t = useMessages(messages);
  return (
    <div className="absolute -top-14 right-[124px] hidden items-center gap-4 xl:flex">
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
        <Lines lines={t.tagline} />
      </p>
      <span
        className="ml-1 h-px w-10"
        style={{ background: "var(--sx-accent)" }}
        aria-hidden="true"
      />
    </div>
  );
}
