"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { RecoveryShell } from "../components/recovery-shell";
import { ApiError } from "../../lib/api/client";
import { requestPasswordReset } from "../../lib/api/auth";

type ForgotState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "sent"; email: string };

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  if (error.code === "VALIDATION_FAILED") {
    return "Enter a valid email address.";
  }
  if (error.code === "RATE_LIMITED") {
    return "Too many requests. Wait a moment, then try again.";
  }
  return error.code === "NETWORK_ERROR"
    ? error.message
    : "We couldn't send the request. Please try again.";
}

export function ForgotPasswordScreen() {
  const [state, setState] = useState<ForgotState>({ kind: "idle" });
  const reduceMotion = useReducedMotion();
  const submitting = state.kind === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    setState({ kind: "submitting" });
    try {
      await requestPasswordReset(email);
      setState({ kind: "sent", email });
    } catch (error) {
      setState({ kind: "error", message: errorMessage(error) });
    }
  }

  if (state.kind === "sent") {
    return (
      <RecoveryShell
        icon={CheckCircle2}
        eyebrow="Request received"
        title="Check your inbox"
        description="If an account matches that address, a secure reset link is already on its way."
      >
        <div className="rounded-2xl border border-[var(--sx-success-border)] bg-[var(--sx-success-bg)] px-5 py-4 text-center">
          <p className="text-sm font-semibold text-[var(--sx-success-text)]">
            Email instructions requested for
          </p>
          <p className="mt-1 break-all text-sm font-bold text-[var(--sx-ink)]">
            {state.email}
          </p>
        </div>
        <p className="mt-5 text-center text-[13px] leading-6 text-[var(--sx-muted)]">
          For your privacy, we show this confirmation whether or not the address
          exists. Check spam if the email does not arrive within a few minutes.
        </p>
        <Link href="/" className="recovery-primary mt-7">
          <ArrowLeft className="size-5" />
          Return to sign in
        </Link>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      icon={Mail}
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email linked to your CabinGuard account. We’ll send a single-use recovery link."
    >
      <form onSubmit={handleSubmit} aria-busy={submitting}>
        <label
          htmlFor="recovery-email"
          className="text-sm font-bold text-[var(--sx-label)]"
        >
          Email address
        </label>
        <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
          <Mail
            className="size-5 shrink-0 text-[var(--sx-icon-muted)]"
            strokeWidth={1.8}
          />
          <input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            autoFocus
            disabled={submitting}
            placeholder="you@company.com"
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
          />
        </div>

        <AnimatePresence initial={false}>
          {state.kind === "error" && (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--sx-error-border)] bg-[var(--sx-error-bg)] px-4 py-3 text-sm text-[var(--sx-error-text)]"
            >
              <AlertCircle className="mt-0.5 size-[18px] shrink-0" />
              {state.message}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={reduceMotion || submitting ? undefined : { y: -2 }}
          whileTap={reduceMotion || submitting ? undefined : { scale: 0.985 }}
          type="submit"
          disabled={submitting}
          className="recovery-primary mt-6"
        >
          {submitting ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <ArrowRight className="size-5" />
          )}
          {submitting ? "Sending secure link…" : "Send recovery link"}
        </motion.button>
      </form>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--sx-divider)] pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sx-accent)] transition hover:text-[var(--sx-accent-hover)]"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--sx-muted)]">
          <ShieldCheck className="size-4" />
          Private by design
        </span>
      </div>
    </RecoveryShell>
  );
}
