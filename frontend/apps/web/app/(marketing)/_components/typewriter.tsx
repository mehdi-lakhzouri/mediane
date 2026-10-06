"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion, useScrollReplay } from "./motion";

export type TypewriterSegment = { text: string; className?: string };
export type TypewriterLine = readonly TypewriterSegment[];

type Glyph = { char: string; line: number; at: number };

/** Milliseconds before the next character, for a natural typing rhythm. */
function pauseAfter(glyph: Glyph, next: Glyph | undefined) {
  if (next && next.line !== glyph.line) return 260;
  if (glyph.char === " ") return 70;
  return 38 + Math.random() * 34;
}

/**
 * A heading that types itself out, each character fading in from a soft
 * blur behind a moving caret. It replays every time it scrolls back into
 * view. Every character is laid out from the start (only hidden), so the
 * text never reflows while typing, and screen readers get the whole heading
 * at once. With reduced motion it simply shows the text.
 */
export function TypewriterHeading({
  id,
  className,
  lines,
  startDelay = 300,
}: {
  id?: string;
  className?: string;
  /** Keep this stable (a module constant): a new array restarts the typing. */
  lines: readonly TypewriterLine[];
  /** Milliseconds before the first character appears. */
  startDelay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  // Lines → segments → characters, each with its position in typing order.
  const layout = useMemo(() => {
    let at = 0;
    return lines.map((line, lineIndex) =>
      line.map((segment) => ({
        className: segment.className,
        glyphs: [...segment.text].map((char) => ({ char, line: lineIndex, at: at++ })),
      })),
    );
  }, [lines]);
  const glyphs = useMemo<Glyph[]>(() => layout.flat().flatMap((segment) => segment.glyphs), [layout]);
  const label = useMemo(() => lines.map((line) => line.map((s) => s.text).join("")).join(" "), [lines]);

  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const { ref, active } = useScrollReplay<HTMLHeadingElement>({
    playAt: 0.5,
    onLeave: () => {
      shownRef.current = 0;
      setShown(0);
    },
  });

  useEffect(() => {
    if (!active || reduced) return;
    let timer: number | undefined;
    const typeNext = () => {
      const index = shownRef.current;
      const glyph = glyphs[index];
      if (!glyph) return;
      shownRef.current = index + 1;
      setShown(index + 1);
      timer = window.setTimeout(typeNext, pauseAfter(glyph, glyphs[index + 1]));
    };
    timer = window.setTimeout(typeNext, shownRef.current === 0 ? startDelay : 0);
    return () => window.clearTimeout(timer);
  }, [active, reduced, glyphs, startDelay]);

  const visible = reduced ? glyphs.length : shown;
  const done = visible >= glyphs.length;
  // The caret sits after the last typed character (before the first while
  // nothing is typed yet) and blinks out once the line is complete.
  const caretAt = visible === 0 ? 0 : visible - 1;
  const caret = reduced ? null : (
    <span
      className={`lp-tw-caret ${visible === 0 ? "lp-tw-caret-before" : "lp-tw-caret-after"}`}
      data-done={done}
    />
  );

  return (
    <h1 ref={ref} id={id} className={className}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">
        {layout.map((line, lineIndex) => (
          <span key={lineIndex} className="block">
            {line.map((segment, segmentIndex) => (
              <span key={segmentIndex} className={segment.className}>
                {/* The caret is a sibling of the fading character, not a
                    child, so it stays crisp while the character fades in. */}
                {segment.glyphs.map(({ char, at }) => (
                  <span key={at} className={at === caretAt ? "relative" : undefined}>
                    <span className="lp-tw-char" data-on={at < visible}>
                      {char}
                    </span>
                    {at === caretAt ? caret : null}
                  </span>
                ))}
              </span>
            ))}
          </span>
        ))}
      </span>
    </h1>
  );
}
