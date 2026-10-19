"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock3, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import {
  logout,
  recordDashboardActivity,
  type WebSessionPolicy,
} from "../../../lib/api/auth";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    eyebrow: "Session protection",
    title: "Are you still there?",
    description: (minutes: number) =>
      `For your security, the dashboard signs you out after ${minutes} minutes without activity.`,
    warning: "Your session is about to end. Choose an option to continue.",
    countdownLabel: "Signing out in",
    seconds: (count: number) => `${count} second${count === 1 ? "" : "s"}`,
    stay: "Stay signed in",
    signOut: "Sign out now",
    securing: "Securing your session…",
  },
  fr: {
    eyebrow: "Protection de la session",
    title: "Êtes-vous toujours là ?",
    description: (minutes: number) =>
      `Pour votre sécurité, le tableau de bord vous déconnecte après ${minutes} minutes d’inactivité.`,
    warning:
      "Votre session va bientôt se terminer. Choisissez une option pour continuer.",
    countdownLabel: "Déconnexion dans",
    seconds: (count: number) => `${count} seconde${count === 1 ? "" : "s"}`,
    stay: "Rester connecté",
    signOut: "Se déconnecter",
    securing: "Sécurisation de votre session…",
  },
});

const DEFAULT_POLICY: WebSessionPolicy = {
  idleTimeoutSeconds: 30 * 60,
  warningSeconds: 20,
  countdownSeconds: 10,
  activityHeartbeatSeconds: 60,
};
const CHANNEL_NAME = "cabinguard-dashboard-session";

type SessionMessage =
  | { type: "activity"; userId: string; at: number }
  | { type: "logout"; userId: string; reason: "inactive" | "manual" };

function safePolicy(value: WebSessionPolicy | undefined): WebSessionPolicy {
  if (!value) return DEFAULT_POLICY;
  const idleTimeoutSeconds = Math.max(60, value.idleTimeoutSeconds);
  const warningSeconds = Math.min(
    Math.max(1, value.warningSeconds),
    idleTimeoutSeconds - 1,
  );
  return {
    idleTimeoutSeconds,
    warningSeconds,
    countdownSeconds: Math.min(
      Math.max(1, value.countdownSeconds),
      warningSeconds,
    ),
    activityHeartbeatSeconds: Math.min(
      Math.max(15, value.activityHeartbeatSeconds),
      Math.max(15, idleTimeoutSeconds - warningSeconds),
    ),
  };
}

function readTimestamp(key: string): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeTimestamp(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Cross-tab coordination is an enhancement; the local timer still works.
  }
}

export function IdleSessionGuard({
  userId,
  policy: policyInput,
}: {
  userId: string;
  policy?: WebSessionPolicy;
}) {
  const t = useMessages(messages);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const policy = useMemo(() => safePolicy(policyInput), [policyInput]);
  const idleMs = policy.idleTimeoutSeconds * 1000;
  const warningMs = policy.warningSeconds * 1000;
  const countdownMs = policy.countdownSeconds * 1000;
  const heartbeatMs = policy.activityHeartbeatSeconds * 1000;
  const activityKey = `cg.dashboard.last-activity.${userId}`;
  const heartbeatKey = `cg.dashboard.last-heartbeat.${userId}`;
  const logoutKey = `cg.dashboard.logout.${userId}`;
  const channelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const loggingOutRef = useRef(false);
  const warningOpenRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState(idleMs);
  const [loggingOut, setLoggingOut] = useState(false);

  const postMessage = useCallback((message: SessionMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

  const sendHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    const now = Date.now();
    writeTimestamp(heartbeatKey, now);
    void recordDashboardActivity().catch(() => {
      // Let the next interaction retry promptly after a transient outage.
      writeTimestamp(heartbeatKey, 0);
    });
  }, [heartbeatKey]);

  const heartbeat = useCallback(
    (force = false) => {
      const now = Date.now();
      const waitMs = heartbeatMs - (now - readTimestamp(heartbeatKey));
      if (force || waitMs <= 0) {
        sendHeartbeat();
        return;
      }
      // A trailing heartbeat keeps the server deadline aligned with the final
      // interaction, even when that interaction happened inside the throttle.
      if (heartbeatTimerRef.current === null) {
        heartbeatTimerRef.current = window.setTimeout(() => {
          heartbeatTimerRef.current = null;
          const remaining =
            heartbeatMs - (Date.now() - readTimestamp(heartbeatKey));
          if (remaining <= 0) {
            sendHeartbeat();
          } else {
            heartbeatTimerRef.current = window.setTimeout(
              sendHeartbeat,
              remaining,
            );
          }
        }, waitMs);
      }
    },
    [heartbeatKey, heartbeatMs, sendHeartbeat],
  );

  const applyActivity = useCallback(
    (at: number, broadcast: boolean, forceHeartbeat = false) => {
      if (loggingOutRef.current) return;
      lastActivityRef.current = at;
      warningOpenRef.current = false;
      setRemainingMs(idleMs);
      writeTimestamp(activityKey, at);
      if (broadcast) postMessage({ type: "activity", userId, at });
      heartbeat(forceHeartbeat);
    },
    [activityKey, heartbeat, idleMs, postMessage, userId],
  );

  const leaveDashboard = useCallback(
    async (reason: "inactive" | "manual", broadcast = true) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      setLoggingOut(true);
      if (broadcast) {
        try {
          localStorage.setItem(
            logoutKey,
            JSON.stringify({ at: Date.now(), reason }),
          );
        } catch {
          // BroadcastChannel still covers modern browsers.
        }
        postMessage({ type: "logout", userId, reason });
      }
      try {
        await logout();
      } catch {
        // The server-side inactivity deadline is authoritative; navigation must
        // not be held hostage by a lost connection at the exact expiry moment.
      } finally {
        router.replace(
          reason === "inactive" ? "/sign-in?reason=inactive" : "/sign-in",
        );
      }
    },
    [logoutKey, postMessage, router, userId],
  );

  useEffect(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    writeTimestamp(activityKey, now);
    heartbeat(true);

    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (event: MessageEvent<SessionMessage>) => {
        const message = event.data;
        if (!message || message.userId !== userId) return;
        if (message.type === "activity") {
          applyActivity(message.at, false);
        } else {
          void leaveDashboard(message.reason, false);
        }
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === activityKey && event.newValue) {
        const at = Number(event.newValue);
        if (Number.isFinite(at)) applyActivity(at, false);
      }
      if (event.key === logoutKey && event.newValue) {
        let reason: "inactive" | "manual" = "inactive";
        try {
          const saved = JSON.parse(event.newValue) as { reason?: string };
          if (saved.reason === "manual") reason = "manual";
        } catch {
          // Legacy timestamp-only values represent inactivity.
        }
        void leaveDashboard(reason, false);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channelRef.current?.close();
      channelRef.current = null;
      if (heartbeatTimerRef.current !== null) {
        window.clearTimeout(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [
    activityKey,
    applyActivity,
    heartbeat,
    leaveDashboard,
    logoutKey,
    userId,
  ]);

  useEffect(() => {
    const onActivity = () => {
      if (!warningOpenRef.current) applyActivity(Date.now(), true);
    };
    const options: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", onActivity, options);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, options);
    window.addEventListener("touchstart", onActivity, options);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [applyActivity]);

  useEffect(() => {
    const update = () => {
      if (loggingOutRef.current) return;
      const next = Math.max(0, lastActivityRef.current + idleMs - Date.now());
      warningOpenRef.current = next > 0 && next <= warningMs;
      if (next <= warningMs) setRemainingMs(next);
      if (next === 0) void leaveDashboard("inactive");
    };
    update();
    const timer = window.setInterval(update, 250);
    const onVisibilityChange = () => {
      update();
      if (document.visibilityState === "hidden" && !warningOpenRef.current) {
        heartbeat(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", update);
    };
  }, [heartbeat, idleMs, leaveDashboard, warningMs]);

  const open = remainingMs > 0 && remainingMs <= warningMs;
  const countdown = remainingMs <= countdownMs;
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const progress = Math.max(0, Math.min(1, remainingMs / warningMs));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const timeoutMinutes = Math.round(policy.idleTimeoutSeconds / 60);

  return (
    <AlertDialog open={open || loggingOut} onOpenChange={() => undefined}>
      <AlertDialogContent
        className="max-w-[31rem] overflow-hidden border-border/80 p-0 shadow-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div
          className={cn(
            "h-1.5 origin-left transition-[transform,background-color] duration-300 ease-linear",
            countdown ? "bg-destructive" : "bg-amber-500",
          )}
          style={{ transform: `scaleX(${progress})` }}
          aria-hidden="true"
        />
        <div className="grid gap-6 px-6 pt-5 pb-6 sm:px-7">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "relative grid size-24 shrink-0 place-items-center rounded-full transition-colors duration-500",
                countdown ? "bg-destructive/8" : "bg-amber-500/10",
              )}
              aria-hidden="true"
            >
              <svg
                className="absolute inset-0 size-24 -rotate-90"
                viewBox="0 0 96 96"
              >
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-border/70"
                />
                <motion.circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: circumference * (1 - progress) }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.25,
                    ease: "linear",
                  }}
                  className={cn(
                    "transition-colors duration-500",
                    countdown ? "text-destructive" : "text-amber-500",
                  )}
                />
              </svg>
              <AnimatePresence mode="wait" initial={false}>
                {countdown ? (
                  <motion.span
                    key={seconds}
                    initial={reduceMotion ? false : { opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: 5 }}
                    className="text-2xl font-extrabold tabular-nums text-destructive"
                  >
                    {seconds}
                  </motion.span>
                ) : (
                  <motion.span
                    key="clock"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Clock3
                      className="size-8 text-amber-600"
                      strokeWidth={1.8}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <AlertDialogHeader className="min-w-0 pt-1 text-left">
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] uppercase transition-colors",
                  countdown
                    ? "text-destructive"
                    : "text-amber-700 dark:text-amber-400",
                )}
              >
                <ShieldCheck className="size-3.5" />
                {t.eyebrow}
              </p>
              <AlertDialogTitle className="text-xl sm:text-2xl">
                {t.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6">
                {t.description(timeoutMinutes)}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <div
            className={cn(
              "rounded-xl border px-4 py-3.5 transition-colors duration-500",
              countdown
                ? "border-destructive/20 bg-destructive/[0.05]"
                : "border-amber-500/20 bg-amber-500/[0.06]",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {countdown ? (
                <motion.p
                  key="countdown"
                  role="timer"
                  aria-live="polite"
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm font-semibold text-destructive"
                >
                  {t.countdownLabel} {t.seconds(seconds)}
                </motion.p>
              ) : (
                <motion.p
                  key="warning"
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm text-muted-foreground"
                >
                  {t.warning}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {loggingOut ? (
            <div
              role="status"
              className="flex h-10 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {t.securing}
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void leaveDashboard("manual")}
              >
                <LogOut className="size-4" />
                {t.signOut}
              </Button>
              <Button
                type="button"
                className="min-w-40"
                onClick={() => applyActivity(Date.now(), true, true)}
                autoFocus
              >
                <ShieldCheck className="size-4" />
                {t.stay}
              </Button>
            </div>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
