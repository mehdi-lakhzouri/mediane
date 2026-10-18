"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChartColumn, Quote } from "lucide-react";
import Image from "next/image";
import { areaPath, lastPoint, smoothPath, toPoints } from "../_lib/chart";
import { useMemo } from "react";
import { INTL_LOCALE } from "../../../lib/i18n/config";
import { useLocale, useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import type { MarketingContent } from "../_lib/content";
import { useContent } from "../_lib/use-content";
import { type ChartColor, Columns, Sparkline } from "./charts";
import { RangePill } from "./console-chrome";
import { Icon } from "./icons";
import { CountUp, EASE, Reveal, useSeen } from "./motion";

/** PLACEHOLDER: illustrative trend lines for the mockup metrics. */
const TRENDS = {
  blue: [10, 11, 13, 12, 15, 16, 19, 18, 22, 25, 24, 28],
  violet: [8, 9, 11, 10, 13, 13, 16, 18, 17, 21, 23, 25],
  red: [24, 21, 22, 18, 19, 15, 16, 13, 14, 11, 12, 9],
  uptime: [14, 15, 15, 17, 16, 18, 20, 19, 21, 22, 21, 24],
  bars: [3, 4, 5, 5.5, 6.5, 7.5, 8.5, 9.5, 10],
} as const satisfies Record<string, readonly number[]>;

const messages = defineMessages({
  en: {
    eyebrow: "Our impact & trust",
    title: "Trusted to protect",
    accent: "drivers, families",
    titleEnd: ", and fleets.",
    lead: "CabinGuard is relied on by forward-thinking organizations to keep drivers safer, families more informed, and operations running smoothly — every mile, every day.",
    trusted: "Trusted by forward-thinking organizations",
    customers: "Customers",
    results: "Real results. Safer journeys.",
    range: "Last 12 months",
  },
  fr: {
    eyebrow: "Notre impact et la confiance",
    title: "La confiance pour protéger",
    accent: "conducteurs, familles",
    titleEnd: " et flottes.",
    lead: "Des organisations tournées vers l’avenir comptent sur CabinGuard pour protéger leurs conducteurs, informer les familles et assurer la bonne marche de leurs opérations — à chaque kilomètre, chaque jour.",
    trusted: "Ils nous font confiance",
    customers: "Clients",
    results: "Des résultats concrets. Des trajets plus sûrs.",
    range: "12 derniers mois",
  },
});

export function Impact() {
  const t = useMessages(messages);
  const { IMPACT_STATS, CUSTOMERS } = useContent();
  return (
    <section id="impact" className="relative scroll-mt-20 overflow-hidden bg-[linear-gradient(180deg,#f9fbff_0%,#f4f8fe_100%)]" aria-labelledby="impact-title">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 hidden w-[47%] lg:block"
        style={{ aspectRatio: "1574 / 606" }}
      >
        <Image
          src="/landing/scene-impact.webp"
          alt=""
          fill
          sizes="47vw"
          className="object-cover"
          style={{
            maskImage: "linear-gradient(90deg, transparent 0%, #000 26%), linear-gradient(180deg, #000 70%, transparent 100%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />
      </div>

      <div className="lp-container relative pb-[clamp(48px,4vw,64px)] pt-[clamp(40px,3vw,50px)]">
        <Reveal className="max-w-[820px]">
          <p className="lp-eyebrow pl-[clamp(0px,1vw,14px)]">{t.eyebrow}</p>
          <h2 id="impact-title" className="lp-title mt-[clamp(18px,2vw,32px)] pl-[clamp(0px,1vw,14px)]">
            {t.title}
            <br />
            <span className="lp-accent">{t.accent}</span>
            {t.titleEnd}
          </h2>
          <p className="lp-lead mt-[clamp(14px,1.2vw,20px)] max-w-[720px] pl-[clamp(0px,1vw,14px)]">{t.lead}</p>
        </Reveal>

        <ul className="mt-[clamp(24px,2vw,32px)] grid gap-[13px] sm:grid-cols-2 lg:grid-cols-3 xl:-mx-[clamp(0px,1.4vw,24px)] 2xl:grid-cols-5">
          {IMPACT_STATS.map((stat, index) => (
            <li key={index}>
              <Reveal delay={index * 0.07} y={22} className="h-full">
                <StatCard stat={stat} index={index} />
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="mt-[clamp(14px,1.2vw,20px)] grid gap-[14px] xl:-mx-[clamp(0px,1.4vw,24px)] xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <Reveal y={24}>
            <TestimonialCard />
          </Reveal>
          <Reveal y={24} delay={0.1}>
            <ResultsCard />
          </Reveal>
        </div>

        <Reveal className="mt-[clamp(20px,1.8vw,28px)]">
          <p className="text-center text-[clamp(11px,0.82vw,13.5px)] font-semibold uppercase tracking-[0.3em] text-[var(--lp-muted)]">
            {t.trusted}
          </p>
          <ul className="mt-5 grid grid-cols-2 items-center gap-y-6 sm:grid-cols-4 xl:grid-cols-8" aria-label={t.customers}>
            {CUSTOMERS.map((name, index) => (
              <li
                key={name}
                className="text-center text-[clamp(20px,1.75vw,30px)] tracking-[-0.03em] text-[#4c5873] opacity-90 transition-opacity hover:opacity-100"
                style={{ fontWeight: index % 3 === 1 ? 800 : index % 3 === 2 ? 500 : 700, fontStyle: index === 5 || index === 7 ? "italic" : undefined }}
              >
                {name}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

const STAT_TILE: Record<string, string> = { siren: "lp-tile-red" };

function StatCard({ stat, index }: { stat: MarketingContent["IMPACT_STATS"][number]; index: number }) {
  const chartKey = stat.chart === "blue" && index === 3 ? "uptime" : stat.chart;
  return (
    <article className="flex h-full flex-col rounded-[20px] border border-white/90 bg-white/90 p-[clamp(16px,1.2vw,20px)] shadow-[var(--lp-shadow-card)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className={`lp-tile size-[clamp(46px,3.3vw,56px)] rounded-[14px] ${STAT_TILE[stat.icon] ?? ""}`}>
          <Icon name={stat.icon} size={28} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="whitespace-nowrap text-[clamp(22px,1.6vw,27px)] font-extrabold leading-none tracking-[-0.03em] text-[var(--lp-ink)]">
            <CountUp value={stat.value} decimals={"decimals" in stat ? stat.decimals : 0} suffix={stat.suffix} />
          </p>
          <p className="mt-2 text-[clamp(12.5px,0.86vw,14.5px)] leading-[1.25] text-[var(--lp-body)]">{stat.label}</p>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="lp-pill lp-pill-green rounded-[8px] px-2 py-1 text-[clamp(12px,0.86vw,14.5px)]">
            {stat.trend === "up" ? "↑" : "↓"} {stat.delta}
          </span>
          <span className="mt-1 text-[11.5px] text-[var(--lp-muted)]">{stat.note}</span>
        </div>
      </div>
      <div className="mt-auto pt-5">
        {chartKey === "bars" ? (
          <Columns values={TRENDS.bars} width={260} height={56} className="h-auto w-full" />
        ) : (
          <Sparkline
            values={TRENDS[chartKey]}
            color={(chartKey === "uptime" ? "blue" : chartKey) as ChartColor}
            width={260}
            height={60}
            jagged={chartKey === "red"}
            markers
            dot
            delay={0.2 + index * 0.08}
            className="h-auto w-full"
          />
        )}
      </div>
      <p className="mt-4 text-[clamp(13px,0.9vw,15px)] text-[var(--lp-body)]">{stat.caption}</p>
    </article>
  );
}

function TestimonialCard() {
  const { TESTIMONIAL } = useContent();
  return (
    <figure className="grid h-full gap-6 rounded-[22px] border border-white/90 bg-white/90 p-[clamp(18px,1.5vw,26px)] shadow-[var(--lp-shadow-card)] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="flex gap-5">
        <div className="flex flex-none flex-col gap-3">
          <span className="lp-tile size-[56px] rounded-[14px]">
            <Quote size={26} fill="currentColor" strokeWidth={0} className="rotate-180" />
          </span>
          <Image
            src="/landing/avatar-mike.webp"
            alt=""
            width={98}
            height={98}
            className="size-[clamp(72px,5.8vw,98px)] rounded-full object-cover shadow-[0_10px_20px_-10px_rgba(16,40,94,0.5)]"
          />
        </div>
        <div className="pt-[clamp(20px,2.4vw,40px)]">
          <blockquote className="text-[clamp(15px,1.06vw,17.5px)] leading-[1.5] text-[var(--lp-ink-soft)]">
            “{TESTIMONIAL.quote}”
          </blockquote>
          <figcaption className="mt-5">
            <span className="block text-[clamp(16px,1.15vw,19px)] font-bold text-[var(--lp-ink)]">{TESTIMONIAL.name}</span>
            <span className="block text-[clamp(13px,0.92vw,15px)] text-[var(--lp-muted)]">{TESTIMONIAL.role}</span>
          </figcaption>
        </div>
      </div>
      <div className="flex flex-col justify-center rounded-[18px] bg-[#f2f6fd] p-[clamp(14px,1vw,16px)]">
        <p className="py-4 text-center font-serif text-[clamp(26px,2.2vw,36px)] font-bold tracking-[-0.02em] text-[#2b3550]">
          {TESTIMONIAL.company}
        </p>
        <dl className="grid grid-cols-3 divide-x divide-[var(--lp-line)] rounded-[14px] bg-white py-4 shadow-[0_8px_18px_-14px_rgba(16,40,94,0.35)]">
          {TESTIMONIAL.results.map((result, index) => (
            <div key={index} className="px-[clamp(8px,1vw,14px)]">
              <dt className="sr-only">{result.label}</dt>
              <dd className="text-[clamp(18px,1.4vw,23px)] font-extrabold tracking-[-0.02em] text-[var(--lp-ink)]">
                {result.value}
              </dd>
              <dd className="text-[clamp(11.5px,0.82vw,13.5px)] text-[var(--lp-muted)]">{result.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </figure>
  );
}

const PROACTIVE = [30, 36, 40, 44, 41, 46, 45, 49, 47, 52, 55, 60];
const ENGAGEMENT = [14, 18, 16, 20, 23, 21, 25, 24, 30, 28, 33, 40];

function ResultsCard() {
  const t = useMessages(messages);
  const { RESULTS } = useContent();
  const locale = useLocale();
  // "Jan, Feb…" / "janv., févr.…" from the reader's locale.
  const months = useMemo(() => {
    const format = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      month: "short",
    });
    return Array.from({ length: 12 }, (_, month) =>
      format.format(new Date(2025, month, 1)),
    );
  }, [locale]);
  const { ref, seen } = useSeen<HTMLDivElement>(0.3);
  const show = seen;
  const w = 520;
  const h = 84;
  const a = toPoints(PROACTIVE, w, h, { min: 0, max: 64, padY: 4 });
  const b = toPoints(ENGAGEMENT, w, h, { min: 0, max: 64, padY: 4 });
  const lineA = smoothPath(a);
  const lineB = smoothPath(b);

  return (
    <div ref={ref} className="flex h-full flex-col rounded-[22px] border border-white/90 bg-white/90 p-[clamp(18px,1.4vw,24px)] shadow-[var(--lp-shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-3 text-[clamp(15px,1.06vw,17.5px)] font-bold tracking-[-0.015em] text-[var(--lp-ink)]">
          <ChartColumn size={22} className="text-[var(--lp-blue)]" /> {t.results}
        </p>
        <RangePill label={t.range} />
      </div>
      <ul className="mt-5 grid grid-cols-3 divide-x divide-[var(--lp-line)]">
        {RESULTS.map((result, index) => {
          const down = result.trend === "down";
          return (
            <li key={index} className="flex items-center justify-between gap-2 px-[clamp(8px,1vw,16px)] first:pl-0">
              <span>
                <span className="block text-[clamp(17px,1.3vw,22px)] font-extrabold tracking-[-0.02em] text-[var(--lp-ink)]">
                  {result.value}
                </span>
                <span className="block whitespace-nowrap text-[clamp(11px,0.76vw,13px)] text-[var(--lp-muted)]">{result.label}</span>
              </span>
              <span
                className={`grid size-[clamp(28px,2.2vw,38px)] flex-none place-items-center rounded-full ${
                  down ? "bg-[var(--lp-green-bg)] text-[var(--lp-green)]" : "bg-[var(--lp-blue-soft)] text-[var(--lp-blue)]"
                }`}
              >
                {down ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto pt-6">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" overflow="visible" aria-hidden="true">
          <defs>
            <linearGradient id="lp-results-a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b8bff" stopOpacity="0.28" />
              <stop offset="1" stopColor="#3b8bff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lp-results-b" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8b6cff" stopOpacity="0.2" />
              <stop offset="1" stopColor="#8b6cff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={areaPath(lineA, a, h)}
            fill="url(#lp-results-a)"
            initial={{ opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.9, delay: 0.8 }}
          />
          <motion.path
            d={areaPath(lineB, b, h)}
            fill="url(#lp-results-b)"
            initial={{ opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.9, delay: 1 }}
          />
          {[
            { d: lineA, color: "#2c7bff", delay: 0.2 },
            { d: lineB, color: "#8a6cf5", delay: 0.35 },
          ].map((line) => (
            <motion.path
              key={line.color}
              d={line.d}
              fill="none"
              stroke={line.color}
              strokeWidth="2.2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={show ? { pathLength: 1 } : undefined}
              transition={{ duration: 1.4, delay: line.delay, ease: EASE }}
            />
          ))}
          <circle cx={lastPoint(a).x} cy={lastPoint(a).y} r="4" fill="#2c7bff" stroke="#fff" strokeWidth="2" />
          <circle cx={lastPoint(b).x} cy={lastPoint(b).y} r="4" fill="#8a6cf5" stroke="#fff" strokeWidth="2" />
        </svg>
        <div className="mt-3 flex justify-between text-[clamp(10.5px,0.72vw,12px)] text-[var(--lp-muted)]">
          {months.map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
