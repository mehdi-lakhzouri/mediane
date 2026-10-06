import { ArrowRight, Check } from "lucide-react";
import { demoHref, PLANS, salesHref } from "../_lib/content";
import { PopIn, Reveal } from "./motion";

export function Plans() {
  return (
    <section id="pricing" className="relative scroll-mt-20 overflow-hidden lp-section-wash" aria-labelledby="pricing-title">
      <div className="lp-container py-[clamp(72px,6.4vw,112px)]">
        <Reveal className="mx-auto max-w-[920px] text-center">
          <p className="lp-eyebrow">Plans</p>
          <h2 id="pricing-title" className="lp-title mt-[clamp(16px,1.6vw,26px)]">
            One platform, <span className="lp-accent">sized to you.</span>
          </h2>
          <p className="lp-lead mx-auto mt-[clamp(14px,1.2vw,20px)] max-w-[620px]">
            From one family car to a national fleet. Pricing depends on vehicles and units, so we quote it with you.
          </p>
        </Reveal>

        <ul className="mx-auto mt-[clamp(40px,3.6vw,60px)] grid max-w-[1240px] items-stretch gap-5 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <li key={plan.name}>
              <Reveal delay={index * 0.08} className="h-full">
                <article
                  className={`relative flex h-full flex-col rounded-[24px] p-[clamp(24px,2vw,34px)] transition-transform duration-300 hover:-translate-y-1 ${
                    plan.featured
                      ? "bg-[linear-gradient(165deg,#2f6bff_0%,#1048e8_55%,#0b36b8_100%)] text-white shadow-[0_40px_80px_-36px_rgba(18,83,253,0.8)]"
                      : "border border-[var(--lp-line)] bg-white shadow-[var(--lp-shadow-card)]"
                  }`}
                >
                  {plan.featured ? (
                    <span className="absolute right-6 top-6 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
                      Recommended
                    </span>
                  ) : null}
                  <h3 className={`text-[26px] font-extrabold tracking-[-0.03em] ${plan.featured ? "" : "text-[var(--lp-ink)]"}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-2 text-[15.5px] leading-relaxed ${plan.featured ? "text-white/80" : "text-[var(--lp-body)]"}`}>
                    {plan.audience}
                  </p>
                  <ul className={`mt-7 space-y-3.5 border-t pt-7 ${plan.featured ? "border-white/20" : "border-[var(--lp-line)]"}`}>
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-[15.5px]">
                        <span
                          className={`mt-0.5 grid size-5 flex-none place-items-center rounded-full ${
                            plan.featured ? "bg-white/20 text-white" : "bg-[var(--lp-blue-soft)] text-[var(--lp-blue)]"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className={plan.featured ? "" : "text-[var(--lp-ink-soft)]"}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <PopIn delay={0.15 + index * 0.08} className="mt-auto flex pt-9">
                    <a
                      href={plan.cta === "Request a demo" ? demoHref : salesHref}
                      className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] text-[16px] font-semibold transition-[background,border-color,color] duration-300 ${
                        plan.featured
                          ? "bg-white text-[var(--lp-blue-strong)] hover:bg-[#eef3ff]"
                          : "border border-[var(--lp-line-strong)] text-[var(--lp-ink)] hover:border-[var(--lp-blue-line)] hover:text-[var(--lp-blue)]"
                      }`}
                    >
                      {plan.cta} <ArrowRight size={17} />
                    </a>
                  </PopIn>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
