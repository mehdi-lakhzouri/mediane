"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChartColumn, ChevronDown, MessageSquare, ShieldCheck, UsersRound } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { demoHref, FAQ, salesHref } from "../_lib/content";
import { Icon } from "./icons";
import { EASE, PopIn, Reveal, usePrefersReducedMotion } from "./motion";

const PROMISES = [
  { icon: <ShieldCheck size={24} />, title: ["Real-time", "protection"], caption: "On every journey" },
  { icon: <UsersRound size={24} />, title: ["Families stay", "informed"], caption: "When it matters" },
  { icon: <ChartColumn size={24} />, title: ["Safer roads", "together"], caption: "For a brighter tomorrow" },
];

export function Faq() {
  return (
    <section id="faq" className="relative scroll-mt-20 overflow-hidden bg-[linear-gradient(180deg,#fafcff_0%,#f3f7fe_100%)]" aria-labelledby="faq-title">
      <div className="lp-container relative grid gap-12 py-[clamp(48px,4vw,64px)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:gap-[clamp(24px,2.6vw,44px)]">
        <div>
          <Reveal>
            <p className="lp-eyebrow">Answers for a safer tomorrow</p>
            <h2 id="faq-title" className="lp-title mt-[clamp(18px,1.9vw,30px)]">
              Frequently asked <span className="lp-accent">questions</span>
            </h2>
            <p className="lp-lead mt-[clamp(14px,1.3vw,22px)] max-w-[740px]">
              Everything you need to know about how CabinGuard helps keep drivers, families, and organizations safer
              on the road.
            </p>
          </Reveal>
          <Accordion />
        </div>

        <div className="flex flex-col">
          <div className="relative hidden xl:-mr-[clamp(20px,4.4vw,74px)] xl:-mt-[8px] xl:block" style={{ aspectRatio: "1544 / 692" }} aria-hidden="true">
            <Image
              src="/landing/scene-faq.webp"
              alt=""
              fill
              sizes="48vw"
              className="object-cover"
              style={{
                maskImage: "linear-gradient(90deg, transparent 0%, #000 14%), linear-gradient(180deg, transparent 0%, #000 14%, #000 88%, transparent 100%)",
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }}
            />
          </div>

          <ul className="relative z-10 grid gap-3 sm:grid-cols-3 xl:-mt-[2%] xl:gap-[18px]">
            {PROMISES.map((promise, index) => (
              <li key={promise.caption}>
                <Reveal delay={index * 0.07} y={16} className="h-full">
                  <div className="flex h-full gap-3.5 rounded-[18px] border border-white/90 bg-white/90 p-[clamp(14px,1.1vw,18px)] shadow-[var(--lp-shadow-card)] backdrop-blur-sm">
                    <span className="lp-tile size-[clamp(44px,3.2vw,54px)] rounded-[14px]">{promise.icon}</span>
                    <span className="leading-tight">
                      <span className="block text-[clamp(14px,0.98vw,16.5px)] font-bold tracking-[-0.015em] text-[var(--lp-ink)]">
                        {promise.title[0]}
                        <br />
                        {promise.title[1]}
                      </span>
                      <span className="mt-1.5 block whitespace-nowrap text-[clamp(11.5px,0.76vw,13px)] text-[var(--lp-muted)]">{promise.caption}</span>
                    </span>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <Reveal y={30} className="mt-[clamp(18px,1.6vw,26px)] flex-1">
            <CtaPanel />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Accordion() {
  const [open, setOpen] = useState(0);
  const reduced = usePrefersReducedMotion();
  const base = useId();

  return (
    <ul className="mt-[clamp(28px,2.4vw,40px)] space-y-[clamp(12px,1vw,18px)]">
      {FAQ.map((item, index) => {
        const expanded = open === index;
        const panelId = `${base}-panel-${index}`;
        const buttonId = `${base}-button-${index}`;
        return (
          <li key={item.question}>
            <Reveal delay={index * 0.05} y={16}>
              <div
                className={`rounded-[18px] border-2 bg-white/90 shadow-[var(--lp-shadow-card)] backdrop-blur-sm transition-[border-color,box-shadow] duration-300 ${
                  expanded ? "border-[#cddcfb] shadow-[0_24px_50px_-28px_rgba(18,83,253,0.35)]" : "border-white/80 hover:border-[var(--lp-line-strong)]"
                }`}
              >
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? -1 : index)}
                    className="flex w-full items-center gap-[clamp(14px,1.6vw,26px)] px-[clamp(14px,1.1vw,18px)] py-[clamp(12px,0.9vw,14px)] text-left"
                  >
                    <span className={`lp-tile size-[clamp(44px,3.2vw,52px)] rounded-[13px] ${item.icon === "siren" ? "lp-tile-red" : ""}`}>
                      <Icon name={item.icon} size={24} />
                    </span>
                    <span className="flex-1 text-[clamp(16px,1.24vw,20.5px)] font-bold tracking-[-0.02em] text-[var(--lp-ink)]">
                      {item.question}
                    </span>
                    <motion.span
                      animate={{ rotate: expanded ? 180 : 0 }}
                      transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
                      className="mr-[clamp(4px,1vw,16px)] text-[var(--lp-blue)]"
                    >
                      <ChevronDown size={22} strokeWidth={2.2} />
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="pb-[clamp(18px,1.6vw,26px)] pl-[calc(clamp(14px,1.1vw,18px)+clamp(44px,3.2vw,52px)+clamp(14px,1.6vw,26px))] pr-[clamp(18px,3vw,56px)] pt-1 text-[clamp(14.5px,1vw,16.5px)] leading-[1.55] text-[var(--lp-body)]">
                        {item.answer}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}

function CtaPanel() {
  return (
    <div className="relative h-full overflow-hidden rounded-[26px] border border-white/90 bg-[linear-gradient(135deg,#eef4ff_0%,#e3ecfd_55%,#dbe7fc_100%)] p-[clamp(24px,2.2vw,38px)] shadow-[var(--lp-shadow-card)]">
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 top-0 hidden w-[34%] sm:block 2xl:w-[42%]">
        <Image
          src="/landing/scene-cta.webp"
          alt=""
          fill
          sizes="20vw"
          className="object-cover"
          style={{ maskImage: "linear-gradient(90deg, transparent 0%, #000 28%)" }}
        />
      </div>
      <div className="relative max-w-[440px] sm:max-w-[66%] 2xl:max-w-[440px]">
        <p className="lp-eyebrow text-[clamp(10.5px,0.8vw,13.5px)]">Safer drivers. Stronger families.</p>
        <h2 className="mt-[clamp(14px,1.2vw,20px)] text-[clamp(32px,3.1vw,52px)] font-extrabold leading-[1.04] tracking-[-0.045em] text-[var(--lp-ink)]">
          Ready to make
          <br />
          <span className="lp-accent">every trip safer?</span>
        </h2>
        <p className="mt-[clamp(12px,1vw,16px)] text-[clamp(15px,1.06vw,17.5px)] leading-[1.45] text-[var(--lp-body)]">
          See how CabinGuard can help your organization protect drivers, support families, and prevent emergencies
          before they happen.
        </p>
        <div className="mt-[clamp(20px,1.8vw,30px)] flex flex-wrap gap-4">
          <PopIn delay={0.1}>
            <a href={demoHref} className="lp-btn-primary h-[58px] px-8 text-[17px]">
              Request demo <ArrowRight size={19} />
            </a>
          </PopIn>
          <PopIn delay={0.22}>
            <a href={salesHref} className="lp-btn-secondary h-[58px] px-7 text-[17px]">
              <span className="grid size-[34px] place-items-center rounded-full border-2 border-[#c9d8fb] text-[var(--lp-blue)]">
                <MessageSquare size={15} />
              </span>
              Talk to sales
            </a>
          </PopIn>
        </div>
      </div>
    </div>
  );
}
