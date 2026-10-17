"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HeartPulse, CircleGauge, ShieldCheck } from "lucide-react";
import { Lines } from "../../lib/i18n/lines";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";
import { BrandLogo } from "./brand-logo";
import { FeatureCard } from "./feature-card";

const messages = defineMessages({
  en: {
    eyebrow: "Safer drivers. Brighter tomorrows.",
    // The headline types itself out in three runs; the last one is accented.
    headline: ["Health awareness,", "built into ", "every journey."],
    intro: [
      "Secure access to your medical incident history,",
      "emergency contacts, and trusted family support —",
      "so you’re never alone on the road.",
    ],
    features: [
      {
        title: "Health",
        description: [
          "Monitor wellbeing",
          "and see incident history",
          "in one place.",
        ],
      },
      {
        title: "Mobility",
        description: [
          "Smarter, safer journeys",
          "with real-time driver",
          "intelligence.",
        ],
      },
      {
        title: "Security",
        description: [
          "Your data, your family,",
          "and your journey",
          "always protected.",
        ],
      },
    ],
    values: ["People", "Technology", "Safer roads", "Stronger tomorrows"],
  },
  fr: {
    eyebrow: "Des conducteurs protégés. Un avenir plus serein.",
    headline: ["La santé en éveil,", "à chaque ", "trajet."],
    intro: [
      "Un accès sécurisé à votre historique d’incidents médicaux,",
      "à vos contacts d’urgence et au soutien de vos proches —",
      "pour ne jamais être seul sur la route.",
    ],
    features: [
      {
        title: "Santé",
        description: [
          "Suivez votre bien-être et l’historique des incidents au même endroit.",
        ],
      },
      {
        title: "Mobilité",
        description: [
          "Des trajets plus sûrs et plus intelligents grâce au suivi en temps réel.",
        ],
      },
      {
        title: "Sécurité",
        description: [
          "Vos données, votre famille et votre trajet, toujours protégés.",
        ],
      },
    ],
    values: ["Humain", "Technologie", "Routes plus sûres", "Avenir plus fort"],
  },
});

const FEATURE_LOOK = [
  { icon: HeartPulse, accent: "#31baff" },
  { icon: CircleGauge, accent: "#21e1df" },
  { icon: ShieldCheck, accent: "#6e83ff" },
] as const;

const TYPEWRITER_STEP = 0.03;

function AnimatedCharacters({
  className,
  startIndex,
  text,
  style,
}: {
  className?: string;
  startIndex: number;
  text: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={className} style={style} aria-hidden="true">
      {Array.from(text).map((character, index) => (
        <motion.span
          key={`${character}-${index}`}
          className="inline-block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.18 + (startIndex + index) * TYPEWRITER_STEP,
            duration: 0.01,
          }}
        >
          {character === " " ? " " : character}
        </motion.span>
      ))}
    </span>
  );
}

export function HeroPanel() {
  const reduceMotion = useReducedMotion();
  const t = useMessages(messages);
  const [lead = "", middle = "", accent = ""] = t.headline;
  const features = t.features.map((feature, index) => ({
    title: feature.title,
    description: <Lines lines={feature.description} />,
    ...FEATURE_LOOK[index % FEATURE_LOOK.length]!,
  }));

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="relative hidden min-w-0 flex-col pt-2 xl:flex xl:pt-2"
    >
      <div className="xl:ml-5">
        <BrandLogo />
      </div>
      <p
        className="mt-4 text-[10px] font-semibold uppercase tracking-[0.46em] sm:text-[11px] xl:ml-5"
        style={{ color: "var(--sx-eyebrow)" }}
      >
        {t.eyebrow}
      </p>

      <div className="mt-9 max-w-[590px] sm:mt-10 xl:ml-4 xl:mt-9">
        <h1
          className="text-[clamp(38px,3.25vw,56px)] font-extrabold leading-[1.05] tracking-[-0.045em] [text-shadow:0_2px_20px_rgba(255,255,255,.72)]"
          style={{ color: "var(--sx-ink)" }}
        >
          <span className="sr-only">{`${lead} ${middle}${accent}`}</span>
          {reduceMotion ? (
            <span aria-hidden="true">
              {lead}
              <br />
              {middle}
              <span
                className="block sm:inline"
                style={{ color: "var(--sx-accent)" }}
              >
                {accent}
              </span>
            </span>
          ) : (
            <>
              <AnimatedCharacters text={lead} startIndex={0} />
              <br />
              <AnimatedCharacters text={middle} startIndex={lead.length} />
              <AnimatedCharacters
                text={accent}
                startIndex={lead.length + middle.length}
                className="block sm:inline"
                style={{ color: "var(--sx-accent)" }}
              />
              <motion.span
                aria-hidden="true"
                className="ml-1 inline-block h-[0.88em] w-[3px] translate-y-[0.08em]"
                style={{ background: "var(--sx-accent)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{
                  delay: 1.45,
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </>
          )}
        </h1>
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.45, duration: 0.75, ease: "easeOut" }}
          className="mt-5 max-w-[520px] text-[clamp(16px,1.15vw,19px)] leading-[1.52] [text-shadow:0_1px_10px_rgba(255,255,255,.8)]"
          style={{ color: "var(--sx-body)" }}
        >
          <Lines lines={t.intro} breakClassName="hidden sm:block" />
        </motion.p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-[.85fr_1fr_1fr] xl:mt-auto xl:max-w-[840px] xl:translate-y-8">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: 1.65 + index * 0.2,
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex min-w-0"
          >
            <FeatureCard {...feature} />
          </motion.div>
        ))}
      </div>

      <div
        className="mt-7 flex max-w-[840px] flex-wrap items-center gap-x-6 gap-y-2 px-1 text-[9px] font-semibold uppercase tracking-[0.34em] sm:gap-x-7 xl:mt-8 xl:translate-y-8"
        style={{ color: "var(--sx-eyebrow)" }}
      >
        {t.values.map((value, index) => (
          <div key={value} className="flex items-center gap-6 sm:gap-7">
            {index > 0 && (
              <span
                className="h-4 w-px"
                style={{ background: "var(--sx-divider-soft)" }}
                aria-hidden="true"
              />
            )}
            <span>{value}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
