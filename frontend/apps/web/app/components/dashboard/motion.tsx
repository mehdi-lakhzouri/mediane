"use client";

import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from "framer-motion";

/*
 * Motion vocabulary for the administrator console. Every page shares the same
 * easing and timing scale, but each one has its own entrance signature so the
 * sections feel distinct:
 *
 *   overview     "boot-up"  — a calm wave, panels cascade into the grid
 *   invitations  "dispatch" — cards flip down like letters, rows arrive from the right
 *   families     "gather"   — cards converge on the centre, rows rise together
 *   drivers      "sweep"    — skewed, blurred cards and rows rush in from the left
 *
 * Reduced motion is handled by `<MotionConfig reducedMotion="user">` in the
 * dashboard layout (transforms are dropped, opacity remains) plus explicit
 * checks around looping and imperative animations.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

/** Parent that only orchestrates: children carry the actual animation. */
export function stagger(staggerChildren: number, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  };
}

// --- Page headers ----------------------------------------------------------

export const headerMotion = {
  overview: {
    title: {
      hidden: { opacity: 0, y: 14 },
      show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
    },
    actions: {
      hidden: { opacity: 0, y: 8, scale: 0.96 },
      show: { opacity: 1, y: 0, scale: 1, transition: SPRING },
    },
  },
  invitations: {
    title: {
      hidden: { opacity: 0, x: -18 },
      show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
    },
    actions: {
      hidden: { opacity: 0, x: 22 },
      show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
    },
  },
  families: {
    title: {
      hidden: { opacity: 0, scale: 0.97, y: 6 },
      show: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.55, ease: EASE },
      },
    },
    actions: {
      hidden: { opacity: 0, scale: 0.92 },
      show: { opacity: 1, scale: 1, transition: SPRING },
    },
  },
  drivers: {
    title: {
      hidden: { opacity: 0, x: -32, filter: "blur(6px)" },
      show: {
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
        transition: { duration: 0.45, ease: EASE },
        transitionEnd: { filter: "none" },
      },
    },
    actions: {
      hidden: { opacity: 0, x: -16 },
      show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE } },
    },
  },
} satisfies Record<string, { title: Variants; actions: Variants }>;

// --- Stat cards ------------------------------------------------------------

export const statCardMotion = {
  /** Rises in a soft wave across the KPI row. */
  overview: {
    hidden: { opacity: 0, y: 22, scale: 0.97 },
    show: { opacity: 1, y: 0, scale: 1, transition: SPRING },
  },
  /** Flips down from the top edge like a letter landing on a desk. */
  invitations: {
    hidden: {
      opacity: 0,
      rotateX: -72,
      y: -10,
      transformPerspective: 900,
    },
    show: {
      opacity: 1,
      rotateX: 0,
      y: 0,
      transformPerspective: 900,
      transition: { type: "spring", stiffness: 210, damping: 20 },
    },
  },
  /** Starts spread outwards and converges on its slot. `custom` is the offset from the centre card. */
  families: {
    hidden: (offset: number) => ({
      opacity: 0,
      x: offset * 36,
      scale: 0.9,
    }),
    show: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 180, damping: 22 },
    },
  },
  /** Rushes in from the left with a motion-blur trail. */
  drivers: {
    hidden: { opacity: 0, x: -48, skewX: -8, filter: "blur(8px)" },
    show: {
      opacity: 1,
      x: 0,
      skewX: 0,
      filter: "blur(0px)",
      transition: { duration: 0.55, ease: EASE },
      transitionEnd: { filter: "none" },
    },
  },
} satisfies Record<string, Variants>;

/** Icon tile inside a stat card: lands a beat after its card. */
export const statIconMotion: Variants = {
  hidden: { scale: 0.4, rotate: -20, opacity: 0 },
  show: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 16,
      delay: 0.12,
    },
  },
};

/** A page block (table, panel group) settling in after the header. */
export const sectionMotion: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Hover and press feedback for a page's primary call to action. */
export const ctaMotion = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.96 },
  transition: { type: "spring", stiffness: 420, damping: 22 },
} as const;

/** Gentle lift for interactive cards. */
export const cardHover = {
  y: -3,
  boxShadow: "0 10px 26px rgba(16,24,40,.08), 0 2px 6px rgba(16,24,40,.04)",
  transition: { duration: 0.2, ease: EASE },
} as const;

// --- Table rows ------------------------------------------------------------
// Each row receives its position on the page as `custom`, so the stagger is
// computed per row and re-plays whenever a new page of results arrives.

const ROW_STEP = 0.045;

export const rowMotion = {
  /** Invitations: rows arrive from the right, like incoming mail. */
  dispatch: {
    hidden: { opacity: 0, x: 36 },
    show: (index: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 28,
        delay: index * ROW_STEP,
      },
    }),
  },
  /** Families: rows rise into place together. */
  gather: {
    hidden: { opacity: 0, y: 16, scale: 0.985 },
    show: (index: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.45, ease: EASE, delay: index * 0.06 },
    }),
  },
  /** Drivers: a fast blurred sweep from the left. */
  sweep: {
    hidden: { opacity: 0, x: -28, filter: "blur(6px)" },
    show: (index: number) => ({
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.4, ease: EASE, delay: index * ROW_STEP },
      transitionEnd: { filter: "none" },
    }),
  },
} satisfies Record<string, Variants>;

/** Simple list item stagger used inside panels. `custom` is the item index. */
export const listItemMotion: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: (index: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: EASE, delay: index * 0.05 },
  }),
};

// --- Animated number -------------------------------------------------------

/**
 * Counts from the previously shown value to `value`. Assistive technology
 * only ever reads the final figure; the moving digits are hidden from it.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1.1,
  delay = 0,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const current = useMotionValue(reduced ? value : 0);
  const text = useTransform(current, (latest) => format(latest, decimals));

  useEffect(() => {
    if (reduced) {
      current.set(value);
      return;
    }
    const controls = animate(current, value, { duration, delay, ease: EASE });
    return () => controls.stop();
  }, [current, decimals, delay, duration, reduced, value]);

  return (
    <>
      <span className="sr-only">{format(value, decimals)}</span>
      <motion.span aria-hidden="true" className="tabular-nums">
        {text}
      </motion.span>
    </>
  );
}

function format(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// --- Live indicator --------------------------------------------------------

/**
 * A status dot that emits a slow radar ping while `live` is true. The ping is
 * decorative and stops entirely for reduced motion.
 */
export function PulseDot({
  live,
  className,
  pingClassName,
}: {
  live: boolean;
  className: string;
  pingClassName?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <span className="relative grid size-2 shrink-0 place-items-center">
      {live && !reduced ? (
        <motion.span
          aria-hidden="true"
          className={`absolute inset-0 rounded-full ${pingClassName ?? className}`}
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{
            duration: 1.8,
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 0.6,
          }}
        />
      ) : null}
      {/* Keyed on colour so the dot pops each time its state changes. */}
      <motion.span
        key={className}
        className={`relative size-2 rounded-full ${className}`}
        initial={{ scale: 0.3 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
      />
    </span>
  );
}
