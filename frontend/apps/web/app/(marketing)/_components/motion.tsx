"use client";

import { animate, motion, MotionGlobalConfig } from "framer-motion";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useInView } from "react-intersection-observer";

export const EASE = [0.22, 1, 0.36, 1] as const;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/*
 * For people who ask their device for less motion, every framer-motion
 * animation finishes instantly. Set when this module loads in the browser,
 * before anything mounts, so even entrance animations never play. It mirrors
 * the device setting, so it rightly holds for the rest of the app too.
 */
if (typeof window !== "undefined") {
  const query = window.matchMedia(REDUCED_MOTION);
  MotionGlobalConfig.skipAnimations = query.matches;
  query.addEventListener("change", (event) => {
    MotionGlobalConfig.skipAnimations = event.matches;
  });
}

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the device asks for reduced motion. Reads "no preference" while
 * the server renders and while the page hydrates, so the markup always
 * matches; the real value follows straight after.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

// Measures before paint in the browser; plain effect during server render.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Fades and rises into place the first time it scrolls into view. With
 * reduced motion it appears at once.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "0px 0px -12% 0px",
  });
  // The server renders the hidden start state, so the client always animates
  // out of it; with reduced motion it does so instantly, without waiting.
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : undefined}
      transition={reduced ? { duration: 0 } : { duration: 0.75, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** True once the element has been seen (never resets). */
export function useSeen<T extends Element>(threshold = 0.25) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold });
  return { ref: ref as (node?: T | null) => void, seen: inView };
}

/**
 * Plays an animation every time the element scrolls into view, from either
 * direction. `active` turns on once `playAt` of the element is visible and
 * off only when it has left the viewport completely, so a reset is never
 * seen and a half-visible element does not flicker between states.
 */
export function useScrollReplay<T extends Element>({
  playAt = 0.5,
  onLeave,
}: {
  /** Share of the element that must be visible to play (0 to 1). */
  playAt?: number;
  /** Called when the element has fully left the viewport. */
  onLeave?: () => void;
} = {}) {
  const [active, setActive] = useState(false);
  const { ref } = useInView({
    threshold: [0, playAt],
    onChange: (_inView, entry) => {
      if (entry.isIntersecting && entry.intersectionRatio >= playAt) {
        setActive(true);
      } else if (!entry.isIntersecting) {
        setActive(false);
        onLeave?.();
      }
    },
  });
  return { ref: ref as (node?: T | null) => void, active };
}

const POP = {
  hidden: { opacity: 0, scale: 0.6, y: 12, transition: { duration: 0 } },
  shown: (delay: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 520, damping: 17, mass: 0.8, delay },
  }),
};

/**
 * Pops a button into place with a little overshoot each time it scrolls into
 * view, and gives it a small pop under the pointer. Set `className` for the
 * wrapper's display (it defaults to `inline-flex`).
 */
export function PopIn({
  children,
  delay = 0,
  className = "inline-flex",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, active } = useScrollReplay<HTMLSpanElement>({ playAt: 0.6 });
  return (
    <motion.span
      ref={ref}
      className={className}
      custom={delay}
      variants={POP}
      initial="hidden"
      animate={active ? "shown" : "hidden"}
      whileHover={{ scale: 1.045 }}
      whileTap={{ scale: 0.96 }}
    >
      {children}
    </motion.span>
  );
}

/**
 * Counts up to `value` when first seen. Renders the final number on the
 * server and for reduced motion, so the figure is always readable.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.6 });
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || reduced || started.current) return;
    started.current = true;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: setShown,
    });
    return () => controls.stop();
  }, [inView, reduced, value, duration]);

  const formatted = shown.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref} className="lp-tabular">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Renders fixed-size artwork (a console mock drawn at `width` x `height`)
 * scaled to the width it is given, so every proportion matches the design
 * at any screen size.
 */
export function ScaledCanvas({
  width,
  height,
  children,
  className,
}: {
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useIsomorphicLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const update = () => setScale(node.clientWidth / width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={box}
      className={className}
      style={{ position: "relative", aspectRatio: `${width} / ${height}` }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
