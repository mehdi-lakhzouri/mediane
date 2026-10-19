"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { AlertDialogAction } from "@repo/ui/components/ui/alert-dialog";

const DEFAULT_HOLD_DURATION_MS = 1_200;

interface HoldToConfirmActionProps {
  label: string;
  runningLabel: string;
  disabled?: boolean;
  running?: boolean;
  durationMs?: number;
  onConfirm: () => void;
}

/**
 * A destructive dialog action that only fires after an uninterrupted press.
 * Pointer, touch and keyboard users all get the same hold duration. Releasing,
 * moving away, losing focus or closing the dialog cancels the action.
 */
export function HoldToConfirmAction({
  label,
  runningLabel,
  disabled = false,
  running = false,
  durationMs = DEFAULT_HOLD_DURATION_MS,
  onConfirm,
}: HoldToConfirmActionProps) {
  const [holding, setHolding] = useState(false);
  const [completed, setCompleted] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const completedRef = useRef(false);

  const stopFrame = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const resetProgress = useCallback(() => {
    stopFrame();
    if (completedRef.current) return;

    setHolding(false);
    if (progressRef.current) {
      progressRef.current.style.transition = "width 180ms ease-out";
      progressRef.current.style.width = "0%";
    }
  }, [stopFrame]);

  const finish = useCallback(() => {
    stopFrame();
    completedRef.current = true;
    setHolding(false);
    setCompleted(true);
    if (progressRef.current) {
      progressRef.current.style.transition = "none";
      progressRef.current.style.width = "100%";
    }
    onConfirm();
  }, [onConfirm, stopFrame]);

  const tick = useCallback(
    (now: number) => {
      const progress = Math.min((now - startedAtRef.current) / durationMs, 1);
      if (progressRef.current) {
        progressRef.current.style.width = `${progress * 100}%`;
      }

      if (progress === 1) {
        finish();
        return;
      }
      frameRef.current = window.requestAnimationFrame(tick);
    },
    [durationMs, finish],
  );

  const start = useCallback(() => {
    if (disabled || running || holding || completedRef.current) return;

    stopFrame();
    setHolding(true);
    startedAtRef.current = window.performance.now();
    if (progressRef.current) {
      progressRef.current.style.transition = "none";
      progressRef.current.style.width = "0%";
    }
    frameRef.current = window.requestAnimationFrame(tick);
  }, [disabled, holding, running, stopFrame, tick]);

  useEffect(
    () => () => {
      stopFrame();
    },
    [stopFrame],
  );

  useEffect(() => {
    if (disabled && !running) resetProgress();
  }, [disabled, resetProgress, running]);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start();
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetProgress();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key !== " " && event.key !== "Enter") || event.repeat) return;
    event.preventDefault();
    start();
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    resetProgress();
  }

  const done = completed || running;

  return (
    <AlertDialogAction
      type="button"
      variant="destructive"
      disabled={disabled || running}
      data-holding={holding || undefined}
      data-complete={done || undefined}
      aria-label={label}
      className="relative min-w-40 touch-none overflow-hidden border border-destructive/30 px-4 select-none hover:brightness-95 data-[holding]:cursor-progress"
      style={{
        backgroundColor: done
          ? "var(--destructive)"
          : "color-mix(in srgb, var(--destructive) 12%, var(--card))",
        color: done ? "var(--destructive-foreground)" : "var(--destructive)",
      }}
      onBlur={resetProgress}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerLeave={resetProgress}
      onPointerUp={handlePointerEnd}
      onClick={(event) => {
        // Radix actions normally close on click. Completion is controlled by
        // the hold timer so a short click must leave the dialog untouched.
        event.preventDefault();
      }}
    >
      <span
        ref={progressRef}
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-0 w-0 bg-destructive/40"
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {running ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" />
        )}
        <span>{running ? runningLabel : label}</span>
      </span>
    </AlertDialogAction>
  );
}
