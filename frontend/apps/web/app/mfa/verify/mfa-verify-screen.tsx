"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  Smartphone,
} from "lucide-react";
import { MfaCodeInput } from "../../components/mfa-code-input";
import { RecoveryShell } from "../../components/recovery-shell";
import { ApiError } from "../../../lib/api/client";
import { completeMfaChallenge, destinationFor } from "../../../lib/api/auth";
import {
  clearMfaChallenge,
  pendingMfaChallenge,
  type PendingMfaChallenge,
} from "../../../lib/mfa-challenge";

type Method = "app" | "recovery";

function remaining(challenge: PendingMfaChallenge): number {
  return Math.max(
    0,
    Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000),
  );
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Second sign-in step. The challenge comes from the sign-in form, in memory
 * only: reloading this page, or letting it expire, means signing in again.
 */
export function MfaVerifyScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [challenge, setChallenge] = useState<PendingMfaChallenge | null>(null);
  const [method, setMethod] = useState<Method>("app");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const current = pendingMfaChallenge();
    if (!current) {
      router.replace("/");
      return;
    }
    setChallenge(current);
    setSecondsLeft(remaining(current));
  }, [router]);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => {
      const left = remaining(challenge);
      setSecondsLeft(left);
      if (left === 0) {
        window.clearInterval(timer);
        clearMfaChallenge();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  async function verify(value: string) {
    if (!challenge || verifying || secondsLeft === 0) return;
    setVerifying(true);
    setError(null);
    try {
      const principal = await completeMfaChallenge(challenge.mfaToken, value);
      clearMfaChallenge();
      router.replace(destinationFor(principal.accountState));
    } catch (failure) {
      setVerifying(false);
      if (!(failure instanceof ApiError)) {
        setError("Something went wrong. Please try again.");
        return;
      }
      if (failure.code === "MFA_CHALLENGE_INVALID") {
        clearMfaChallenge();
        setSecondsLeft(0);
        return;
      }
      setCode("");
      setError(
        failure.code === "MFA_CODE_INVALID"
          ? method === "app"
            ? "That code didn't work. Wait for the next one in your app and try again."
            : "That recovery code is not valid or was already used."
          : failure.code === "RATE_LIMITED"
            ? "Too many attempts. Wait a few minutes, then sign in again."
            : failure.message,
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(method === "app" ? code : recovery.trim());
  }

  function switchMethod(next: Method) {
    setMethod(next);
    setError(null);
    setCode("");
    setRecovery("");
  }

  if (!challenge) {
    return (
      <RecoveryShell
        icon={LoaderCircle}
        eyebrow="Two-step verification"
        title="One moment"
        description="Preparing the verification step."
        footnote="Codes rotate every 30 seconds and are never accepted twice."
      >
        <LoaderCircle className="mx-auto size-6 animate-spin text-[var(--sx-accent)]" />
      </RecoveryShell>
    );
  }

  if (secondsLeft === 0) {
    return (
      <RecoveryShell
        icon={LockKeyhole}
        eyebrow="Two-step verification"
        title="Sign in again"
        description="This sign-in attempt expired or was stopped after too many wrong codes. Your account is safe."
        footnote="Codes rotate every 30 seconds and are never accepted twice."
      >
        <Link href="/" className="recovery-primary">
          <ArrowLeft className="size-5" />
          Back to sign in
        </Link>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      icon={method === "app" ? Smartphone : LifeBuoy}
      eyebrow="Two-step verification"
      title={method === "app" ? "Enter your code" : "Use a recovery code"}
      description={
        method === "app"
          ? "Open your authenticator app and type the six-digit code for CabinGuard."
          : "Type one of the recovery codes you saved when you set up two-step verification. Each one works once."
      }
      footnote="Codes rotate every 30 seconds and are never accepted twice."
    >
      <form onSubmit={handleSubmit} aria-busy={verifying}>
        <AnimatePresence mode="wait" initial={false}>
          {method === "app" ? (
            <motion.div
              key="app"
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
            >
              <MfaCodeInput
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error) setError(null);
                  // Submit as soon as the sixth digit is typed.
                  if (value.length === 6) void verify(value);
                }}
                disabled={verifying}
                hasError={Boolean(error)}
                autoFocus
              />
            </motion.div>
          ) : (
            <motion.div
              key="recovery"
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
            >
              <label
                htmlFor="recovery-code"
                className="text-sm font-bold text-[var(--sx-label)]"
              >
                Recovery code
              </label>
              <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
                <KeyRound className="size-5 shrink-0 text-[var(--sx-icon-muted)]" />
                <input
                  id="recovery-code"
                  value={recovery}
                  onChange={(event) => {
                    setRecovery(event.target.value.toUpperCase());
                    if (error) setError(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={12}
                  autoFocus
                  disabled={verifying}
                  placeholder="XXXXX-XXXXX"
                  className="h-full min-w-0 flex-1 bg-transparent px-4 font-mono text-[16px] tracking-[0.12em] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 min-h-6 text-center" aria-live="polite">
          {error ? (
            <p
              role="alert"
              className="inline-flex items-start gap-2 text-left text-sm font-semibold text-[var(--sx-error-text)]"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : (
            <p className="text-xs text-[var(--sx-muted)]">
              This sign-in attempt expires in {formatClock(secondsLeft)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            verifying ||
            (method === "app" ? code.length !== 6 : recovery.trim().length < 10)
          }
          className="recovery-primary mt-5"
        >
          {verifying ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <LockKeyhole className="size-5" />
          )}
          {verifying ? "Verifying…" : "Verify and sign in"}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-3 text-sm font-bold">
        <button
          type="button"
          onClick={() => switchMethod(method === "app" ? "recovery" : "app")}
          className="text-[var(--sx-accent)] transition hover:text-[var(--sx-accent-hover)]"
        >
          {method === "app"
            ? "Lost your phone? Use a recovery code"
            : "Use the authenticator app instead"}
        </button>
        <Link
          href="/"
          onClick={() => clearMfaChallenge()}
          className="flex items-center gap-2 text-[var(--sx-muted)] transition hover:text-[var(--sx-accent)]"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </div>
    </RecoveryShell>
  );
}
