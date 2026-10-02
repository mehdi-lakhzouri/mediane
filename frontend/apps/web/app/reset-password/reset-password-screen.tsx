"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { RecoveryShell } from "../components/recovery-shell";
import { ApiError } from "../../lib/api/client";
import { resetPassword } from "../../lib/api/auth";

type ResetState =
  | { kind: "reading" }
  | { kind: "ready"; token: string }
  | { kind: "submitting"; token: string }
  | { kind: "error"; token: string; message: string }
  | { kind: "invalid" }
  | { kind: "success" };

function resetErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  if (error.code === "WEAK_PASSWORD") {
    return error.details[0]?.message ?? "Choose a stronger password.";
  }
  if (error.code === "RATE_LIMITED") {
    return "Too many attempts. Wait a moment, then try again.";
  }
  return error.code === "NETWORK_ERROR"
    ? error.message
    : "We couldn't update your password. Please try again.";
}

export function ResetPasswordScreen() {
  const [state, setState] = useState<ResetState>({ kind: "reading" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const reduceMotion = useReducedMotion();
  const tokenRead = useRef(false);

  useEffect(() => {
    if (tokenRead.current) return;
    tokenRead.current = true;
    const token = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    ).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    setState(token ? { kind: "ready", token } : { kind: "invalid" });
  }, []);

  const submitting = state.kind === "submitting";
  const longEnough = password.length >= 12;
  const passwordsMatch = password.length > 0 && password === confirmation;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || (state.kind !== "ready" && state.kind !== "error")) {
      return;
    }
    if (!longEnough) {
      setState({
        kind: "error",
        token: state.token,
        message: "Password must be at least 12 characters.",
      });
      return;
    }
    if (!passwordsMatch) {
      setState({
        kind: "error",
        token: state.token,
        message: "The passwords do not match.",
      });
      return;
    }

    const token = state.token;
    setState({ kind: "submitting", token });
    try {
      await resetPassword(token, password);
      setPassword("");
      setConfirmation("");
      setState({ kind: "success" });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "PASSWORD_RESET_TOKEN_INVALID"
      ) {
        setState({ kind: "invalid" });
      } else {
        setState({
          kind: "error",
          token,
          message: resetErrorMessage(error),
        });
      }
    }
  }

  if (state.kind === "reading") {
    return (
      <RecoveryShell
        icon={LoaderCircle}
        eyebrow="Secure verification"
        title="Checking your link"
        description="One moment while we verify your single-use recovery link."
        visual="password-reset"
      >
        <LoaderCircle className="mx-auto size-6 animate-spin text-[var(--sx-accent)]" />
      </RecoveryShell>
    );
  }

  if (state.kind === "invalid") {
    return (
      <RecoveryShell
        icon={RefreshCw}
        eyebrow="Link unavailable"
        title="Request a fresh link"
        description="This reset link is invalid, expired, or has already been used. Your current password has not changed."
        visual="password-reset"
      >
        <Link href="/forgot-password" className="recovery-primary">
          <RefreshCw className="size-5" />
          Send a new recovery link
        </Link>
        <Link
          href="/"
          className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-[var(--sx-accent)]"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </RecoveryShell>
    );
  }

  if (state.kind === "success") {
    return (
      <RecoveryShell
        icon={CheckCircle2}
        eyebrow="Password updated"
        title="You’re ready to sign in"
        description="Your new password is active and previous sessions have been securely signed out."
        visual="password-reset"
      >
        <div className="rounded-2xl border border-[var(--sx-success-border)] bg-[var(--sx-success-bg)] px-5 py-4 text-center text-sm leading-6 text-[var(--sx-success-text)]">
          Your account is protected with the new password. Use it the next time
          you sign in.
        </div>
        <Link href="/" className="recovery-primary mt-7">
          <ArrowRight className="size-5" />
          Continue to sign in
        </Link>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      icon={LockKeyhole}
      eyebrow="Secure recovery"
      title="Choose a new password"
      description="Use a memorable passphrase with at least 12 characters. All existing sessions will be signed out."
      visual="password-reset"
    >
      <form onSubmit={handleSubmit} aria-busy={submitting}>
        <label
          htmlFor="new-password"
          className="text-sm font-bold text-[var(--sx-label)]"
        >
          New password
        </label>
        <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
          <LockKeyhole className="size-5 shrink-0 text-[var(--sx-icon-muted)]" />
          <input
            id="new-password"
            name="newPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            autoFocus
            disabled={submitting}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 12 characters"
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="grid size-9 place-items-center rounded-lg text-[var(--sx-icon-muted)] transition hover:bg-[var(--sx-icon-hover-bg)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>

        <label
          htmlFor="confirm-password"
          className="mt-5 block text-sm font-bold text-[var(--sx-label)]"
        >
          Confirm password
        </label>
        <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
          <Check className="size-5 shrink-0 text-[var(--sx-icon-muted)]" />
          <input
            id="confirm-password"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            disabled={submitting}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Repeat your new password"
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
          />
        </div>

        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <PasswordCheck valid={longEnough} label="12 characters minimum" />
          <PasswordCheck valid={passwordsMatch} label="Passwords match" />
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
          {submitting ? "Updating password…" : "Set new password"}
        </motion.button>
      </form>
    </RecoveryShell>
  );
}

function PasswordCheck({ valid, label }: { valid: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-2 transition-colors ${
        valid ? "text-[var(--sx-success-text)]" : "text-[var(--sx-muted)]"
      }`}
    >
      <span
        className={`grid size-5 place-items-center rounded-full border transition-colors ${
          valid
            ? "border-[var(--sx-success-border)] bg-[var(--sx-success-bg)]"
            : "border-[var(--sx-border)] bg-[var(--sx-input-bg)]"
        }`}
      >
        {valid && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </span>
  );
}
