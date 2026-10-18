import { Check, X } from "lucide-react";
import { defineMessages } from "../../../lib/i18n/messages";
import { getMessages } from "../../../lib/i18n/server";
import { marketingContent } from "../_lib/content";
import { Icon } from "./icons";
import { Reveal } from "./motion";

const messages = defineMessages({
  en: {
    eyebrow: "Privacy & security",
    title: "Families know you need help.",
    accent: "Not why.",
    lead: "Health data is the most personal data there is. CabinGuard shares only what someone needs to act, and forgets the rest on a schedule.",
    familySeesTitle: "Family sees",
    familySees: ["Who needs help", "When the alert started", "Where they are, while help is called", "When they are safe again"],
    privateTitle: "Stays with the driver",
    staysPrivate: ["Heart rate and other readings", "What the cabin unit detected", "Medical history", "Location after the alert ends"],
  },
  fr: {
    eyebrow: "Confidentialité et sécurité",
    title: "La famille sait que vous avez besoin d’aide.",
    accent: "Pas pourquoi.",
    lead: "Les données de santé sont les plus personnelles qui soient. CabinGuard ne partage que ce dont chacun a besoin pour agir, et efface le reste selon un calendrier défini.",
    familySeesTitle: "Ce que voit la famille",
    familySees: ["Qui a besoin d’aide", "Quand l’alerte a commencé", "Où se trouve la personne, pendant l’appel des secours", "Quand elle est de nouveau en sécurité"],
    privateTitle: "Reste au conducteur",
    staysPrivate: ["Rythme cardiaque et autres mesures", "Ce que le boîtier a détecté", "Antécédents médicaux", "Position après la fin de l’alerte"],
  },
});

export async function Privacy() {
  const t = await getMessages(messages);
  const { PRIVACY } = await getMessages(marketingContent);
  return (
    <section id="privacy" className="relative scroll-mt-20 bg-white" aria-labelledby="privacy-title">
      <div className="lp-container grid gap-12 py-[clamp(72px,6.4vw,112px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-[clamp(40px,4vw,80px)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="lp-eyebrow">{t.eyebrow}</p>
            <h2 id="privacy-title" className="lp-title mt-[clamp(16px,1.6vw,26px)]">
              {t.title}
              <br />
              <span className="lp-accent">{t.accent}</span>
            </h2>
            <p className="lp-lead mt-[clamp(14px,1.2vw,20px)] max-w-[560px]">{t.lead}</p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-9 grid overflow-hidden rounded-[22px] border border-[var(--lp-line)] sm:grid-cols-2">
              <div className="bg-[var(--lp-blue-tint)] p-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[var(--lp-blue-strong)]">{t.familySeesTitle}</p>
                <ul className="mt-4 space-y-3">
                  {t.familySees.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[15px] text-[var(--lp-ink-soft)]">
                      <Check size={18} className="mt-0.5 flex-none text-[var(--lp-green)]" strokeWidth={2.6} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-[var(--lp-line)] bg-white p-6 sm:border-l sm:border-t-0">
                <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[var(--lp-muted)]">{t.privateTitle}</p>
                <ul className="mt-4 space-y-3">
                  {t.staysPrivate.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[15px] text-[var(--lp-ink-soft)]">
                      <X size={18} className="mt-0.5 flex-none text-[var(--lp-faint)]" strokeWidth={2.6} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>

        <ul className="grid content-start gap-4 sm:grid-cols-2">
          {PRIVACY.map((item, index) => (
            <li key={index}>
              <Reveal delay={(index % 2) * 0.08} y={20} className="h-full">
                <div className="h-full rounded-[20px] border border-[var(--lp-line)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-[clamp(20px,1.6vw,28px)] shadow-[var(--lp-shadow-card)]">
                  <span className="lp-tile size-12 rounded-[14px]">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <h3 className="mt-5 text-[18px] font-bold tracking-[-0.02em] text-[var(--lp-ink)]">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--lp-body)]">{item.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
